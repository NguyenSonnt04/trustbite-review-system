import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:trustbite_mobile/src/core/auth/auth_session_store.dart';
import 'package:trustbite_mobile/src/core/auth/cognito_session_provider.dart';
import 'package:trustbite_mobile/src/core/config/mobile_runtime_config.dart';

class ApiTransportRequest {
  const ApiTransportRequest({
    required this.method,
    required this.uri,
    required this.headers,
    this.body,
  });

  final String method;
  final Uri uri;
  final Map<String, String> headers;
  final String? body;
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

    final body = request.body;
    if (body != null) {
      httpRequest.write(body);
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

class TrustBiteApiClient {
  TrustBiteApiClient({
    required MobileRuntimeConfig config,
    required AuthSessionStore sessionStore,
    CognitoSessionProvider? cognitoSessionProvider,
    ApiTransport? transport,
    http.Client? multipartClient,
  }) : _config = config,
       _sessionStore = sessionStore,
       _cognitoSessionProvider = cognitoSessionProvider,
       _transport = transport ?? HttpApiTransport(),
       _multipartClient = multipartClient ?? http.Client();

  final MobileRuntimeConfig _config;
  final AuthSessionStore _sessionStore;
  final CognitoSessionProvider? _cognitoSessionProvider;
  final ApiTransport _transport;
  final http.Client _multipartClient;

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

  Future<Map<String, dynamic>> postMultipart({
    required String path,
    required Map<String, String> fields,
    required String fileField,
    required String filePath,
    required String idempotencyKey,
  }) async {
    final request = http.MultipartRequest('POST', _config.apiUri(path))
      ..headers.addAll(await _buildHeaders(includeContentType: false))
      ..headers['Idempotency-Key'] = idempotencyKey
      ..fields.addAll(fields)
      ..files.add(
        await http.MultipartFile.fromPath(
          fileField,
          filePath,
          contentType: _receiptMediaType(filePath),
        ),
      );

    late final http.StreamedResponse streamed;
    try {
      streamed = await _multipartClient.send(request);
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

    final response = ApiTransportResponse(
      statusCode: streamed.statusCode,
      body: await streamed.stream.bytesToString(),
    );
    if (response.statusCode == HttpStatus.unauthorized) {
      await _clearRejectedSession();
      throw AuthRequiredException(
        response.statusCode,
        _readErrorMessage(response),
      );
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(response.statusCode, _readErrorMessage(response));
    }

    if (response.body.trim().isEmpty) return <String, dynamic>{};
    final decoded = jsonDecode(response.body);
    if (decoded is Map<String, dynamic>) return decoded;
    throw const ApiException(
      HttpStatus.internalServerError,
      'Backend returned an unexpected response shape.',
    );
  }

  Future<Map<String, dynamic>> _requestJson({
    required String method,
    required String path,
    Map<String, String?>? queryParameters,
    String? body,
  }) async {
    late final ApiTransportResponse response;
    try {
      response = await _transport.send(
        ApiTransportRequest(
          method: method,
          uri: _config.apiUri(path, queryParameters),
          headers: await _buildHeaders(),
          body: body,
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
      await _clearRejectedSession();
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
    bool includeContentType = true,
  }) async {
    final headers = <String, String>{'Accept': 'application/json'};
    if (includeContentType) headers['Content-Type'] = 'application/json';

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

  Future<void> _clearRejectedSession() async {
    await _sessionStore.clear();
    try {
      await _cognitoSessionProvider?.signOut();
    } on Exception {
      // Backend rejection remains authoritative if provider cleanup fails.
    }
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

  MediaType _receiptMediaType(String path) {
    final extension = path.toLowerCase().split('.').last;
    return switch (extension) {
      'jpg' || 'jpeg' => MediaType('image', 'jpeg'),
      'png' => MediaType('image', 'png'),
      'heic' => MediaType('image', 'heic'),
      'heif' => MediaType('image', 'heif'),
      _ => throw const ApiException(
        HttpStatus.unsupportedMediaType,
        'Hóa đơn phải là ảnh JPG, PNG, HEIC hoặc HEIF.',
      ),
    };
  }
}
