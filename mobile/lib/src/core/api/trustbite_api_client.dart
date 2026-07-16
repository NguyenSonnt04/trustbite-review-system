import 'dart:convert';
import 'dart:io';

import 'package:trustbite_mobile/src/core/auth/auth_session_store.dart';
import 'package:trustbite_mobile/src/core/auth/cognito_session_provider.dart';
import 'package:trustbite_mobile/src/core/config/mobile_runtime_config.dart';

class ApiTransportRequest {
  const ApiTransportRequest({
    required this.method,
    required this.uri,
    required this.headers,
    this.body,
    this.bodyBytes,
  });

  final String method;
  final Uri uri;
  final Map<String, String> headers;
  final String? body;
  final List<int>? bodyBytes;
}

class ApiTransportResponse {
  const ApiTransportResponse({required this.statusCode, required this.body});

  final int statusCode;
  final String body;
}

abstract class ApiTransport {
  Future<ApiTransportResponse> send(ApiTransportRequest request);
}

class HttpApiTransport implements ApiTransport {
  HttpApiTransport({HttpClient? httpClient})
    : _httpClient = httpClient ?? HttpClient();

  final HttpClient _httpClient;

  @override
  Future<ApiTransportResponse> send(ApiTransportRequest request) async {
    final httpRequest = await _httpClient.openUrl(request.method, request.uri);
    for (final header in request.headers.entries) {
      httpRequest.headers.set(header.key, header.value);
    }

    if (request.bodyBytes != null) {
      httpRequest.add(request.bodyBytes!);
    } else if (request.body != null) {
      httpRequest.add(utf8.encode(request.body!));
    }

    final response = await httpRequest.close();
    return ApiTransportResponse(
      statusCode: response.statusCode,
      body: await utf8.decodeStream(response),
    );
  }
}

class ApiException implements Exception {
  const ApiException(this.statusCode, this.message);

  final int statusCode;
  final String message;

  @override
  String toString() => 'ApiException($statusCode): $message';
}

class AuthRequiredException extends ApiException {
  const AuthRequiredException(super.statusCode, super.message);
}

class ApiMultipartFile {
  const ApiMultipartFile({
    required this.fieldName,
    required this.fileName,
    required this.contentType,
    required this.bytes,
  });

  final String fieldName;
  final String fileName;
  final String contentType;
  final List<int> bytes;
}

class TrustBiteApiClient {
  TrustBiteApiClient({
    required MobileRuntimeConfig config,
    required AuthSessionStore sessionStore,
    CognitoSessionProvider? cognitoSessionProvider,
    ApiTransport? transport,
  }) : _config = config,
       _sessionStore = sessionStore,
       _cognitoSessionProvider = cognitoSessionProvider,
       _transport = transport ?? HttpApiTransport();

  final MobileRuntimeConfig _config;
  final AuthSessionStore _sessionStore;
  final CognitoSessionProvider? _cognitoSessionProvider;
  final ApiTransport _transport;

  Future<Map<String, dynamic>> getJson(
    String path, [
    Map<String, String?>? queryParameters,
  ]) {
    return _requestJson(
      method: 'GET',
      path: path,
      queryParameters: queryParameters,
    );
  }

  Future<Map<String, dynamic>> postJson(
    String path,
    Map<String, dynamic> body,
  ) {
    return _requestJson(method: 'POST', path: path, body: jsonEncode(body));
  }

  Future<Map<String, dynamic>> patchJson(
    String path,
    Map<String, dynamic> body,
  ) {
    return _requestJson(method: 'PATCH', path: path, body: jsonEncode(body));
  }

  Future<Map<String, dynamic>> putJson(String path, Map<String, dynamic> body) {
    return _requestJson(method: 'PUT', path: path, body: jsonEncode(body));
  }

  Future<Map<String, dynamic>> deleteJson(String path) {
    return _requestJson(method: 'DELETE', path: path);
  }

  Future<Map<String, dynamic>> postMultipart(
    String path, {
    required Map<String, String> fields,
    required ApiMultipartFile file,
    Map<String, String>? headers,
  }) async {
    final boundary =
        'trustbite-${DateTime.now().microsecondsSinceEpoch.toRadixString(16)}';
    final bytes = <int>[];

    void addText(String value) {
      bytes.addAll(utf8.encode(value));
    }

    for (final field in fields.entries) {
      addText('--$boundary\r\n');
      addText('Content-Disposition: form-data; name="${field.key}"\r\n\r\n');
      addText('${field.value}\r\n');
    }

    addText('--$boundary\r\n');
    addText(
      'Content-Disposition: form-data; name="${file.fieldName}"; '
      'filename="${file.fileName}"\r\n',
    );
    addText('Content-Type: ${file.contentType}\r\n\r\n');
    bytes.addAll(file.bytes);
    addText('\r\n--$boundary--\r\n');

    return _requestJson(
      method: 'POST',
      path: path,
      bodyBytes: bytes,
      contentType: 'multipart/form-data; boundary=$boundary',
      extraHeaders: headers,
    );
  }

  Future<Map<String, dynamic>> _requestJson({
    required String method,
    required String path,
    Map<String, String?>? queryParameters,
    String? body,
    List<int>? bodyBytes,
    String contentType = 'application/json',
    Map<String, String>? extraHeaders,
  }) async {
    late final ApiTransportResponse response;
    try {
      response = await _transport.send(
        ApiTransportRequest(
          method: method,
          uri: _config.apiUri(path, queryParameters),
          headers: {
            ...await _buildHeaders(contentType: contentType),
            ...?extraHeaders,
          },
          body: body,
          bodyBytes: bodyBytes,
        ),
      );
    } on SocketException {
      throw const ApiException(
        HttpStatus.serviceUnavailable,
        'Không thể kết nối máy chủ TrustBite. Vui lòng bật backend rồi thử lại.',
      );
    } on HttpException {
      throw const ApiException(
        HttpStatus.serviceUnavailable,
        'Máy chủ TrustBite không phản hồi. Vui lòng thử lại.',
      );
    }

    if (response.statusCode == HttpStatus.unauthorized) {
      await _sessionStore.clear();
      try {
        await _cognitoSessionProvider?.signOut();
      } on Exception {
        // The backend rejection remains authoritative even if provider
        // cleanup is temporarily unavailable.
      }
      throw AuthRequiredException(
        response.statusCode,
        _readErrorMessage(response),
      );
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(response.statusCode, _readErrorMessage(response));
    }

    if (response.statusCode == HttpStatus.noContent ||
        response.body.trim().isEmpty) {
      return <String, dynamic>{};
    }

    final decoded = jsonDecode(response.body);
    if (decoded is Map<String, dynamic>) {
      return decoded;
    }

    throw const ApiException(
      HttpStatus.internalServerError,
      'Backend returned an unexpected response shape.',
    );
  }

  Future<Map<String, String>> _buildHeaders({
    String contentType = 'application/json',
  }) async {
    final headers = <String, String>{
      'Accept': 'application/json',
      'Content-Type': contentType,
    };

    final session = await _sessionStore.read();
    final trustedLocalUserId = session?.trustedLocalUserId?.trim();
    if (trustedLocalUserId != null && trustedLocalUserId.isNotEmpty) {
      headers['x-trustbite-user-id'] = trustedLocalUserId;

      final trustedLocalSubject = session?.trustedLocalSubject?.trim();
      if (trustedLocalSubject != null && trustedLocalSubject.isNotEmpty) {
        headers['x-trustbite-subject'] = trustedLocalSubject;
      }

      final trustedLocalPhoneNumber = session?.trustedLocalPhoneNumber?.trim();
      if (trustedLocalPhoneNumber != null &&
          trustedLocalPhoneNumber.isNotEmpty) {
        headers['x-trustbite-phone-number'] = trustedLocalPhoneNumber;
      }
    } else {
      final token = (await _cognitoSessionProvider?.getAccessToken())?.trim();
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
    }

    return headers;
  }

  String _readErrorMessage(ApiTransportResponse response) {
    final fallback = 'HTTP error! status: ${response.statusCode}';

    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) {
        final error = decoded['error'];
        final nestedMessage = error is Map<String, dynamic>
            ? error['message']
            : null;
        final message = nestedMessage ?? decoded['message'];
        if (message is String && message.trim().isNotEmpty) {
          return message;
        }
      }
    } on FormatException {
      return fallback;
    }

    return fallback;
  }
}
