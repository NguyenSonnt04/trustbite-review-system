import 'dart:convert';
import 'dart:io';

import 'package:trustbite_mobile/src/core/auth/auth_session_store.dart';
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
  const ApiTransportResponse({
    required this.statusCode,
    required this.body,
  });

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
    ApiTransport? transport,
  })  : _config = config,
        _sessionStore = sessionStore,
        _transport = transport ?? HttpApiTransport();

  final MobileRuntimeConfig _config;
  final AuthSessionStore _sessionStore;
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
    return _requestJson(
      method: 'POST',
      path: path,
      body: jsonEncode(body),
    );
  }

  Future<Map<String, dynamic>> _requestJson({
    required String method,
    required String path,
    Map<String, String?>? queryParameters,
    String? body,
  }) async {
    final response = await _transport.send(
      ApiTransportRequest(
        method: method,
        uri: _config.apiUri(path, queryParameters),
        headers: await _buildHeaders(),
        body: body,
      ),
    );

    if (response.statusCode == HttpStatus.unauthorized) {
      await _sessionStore.clear();
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

  Future<Map<String, String>> _buildHeaders() async {
    final headers = <String, String>{
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    final session = await _sessionStore.read();
    final token = session?.accessToken?.trim();
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }

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
    }

    return headers;
  }

  String _readErrorMessage(ApiTransportResponse response) {
    final fallback = 'HTTP error! status: ${response.statusCode}';

    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) {
        final error = decoded['error'];
        final nestedMessage =
            error is Map<String, dynamic> ? error['message'] : null;
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
