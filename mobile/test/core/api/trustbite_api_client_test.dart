import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/core/auth/auth_session.dart';
import 'package:trustbite_mobile/src/core/auth/auth_session_store.dart';
import 'package:trustbite_mobile/src/core/auth/cognito_session_provider.dart';
import 'package:trustbite_mobile/src/core/config/mobile_runtime_config.dart';

void main() {
  const config = MobileRuntimeConfig(
    apiBaseUrl: 'http://localhost:5000',
    awsRegion: 'ap-southeast-1',
    cognitoUserPoolId: 'pool-id',
    cognitoClientId: 'client-id',
  );

  group('TrustBiteApiClient', () {
    test('sends Cognito access token as backend bearer auth', () async {
      final transport = _FakeApiTransport(
        response: const ApiTransportResponse(
          statusCode: 200,
          body: '{"id":"user-1","displayName":"An"}',
        ),
      );
      final sessionStore = InMemoryAuthSessionStore();
      final cognitoSession = _FakeCognitoSessionProvider('access-token');
      final client = TrustBiteApiClient(
        config: config,
        transport: transport,
        sessionStore: sessionStore,
        cognitoSessionProvider: cognitoSession,
      );

      final body = await client.getJson('/users/me');

      expect(body, {'id': 'user-1', 'displayName': 'An'});
      expect(
        transport.lastUri.toString(),
        'http://localhost:5000/api/v1/users/me',
      );
      expect(transport.lastHeaders['Authorization'], 'Bearer access-token');
      expect(transport.lastHeaders['Content-Type'], 'application/json');
      expect(cognitoSession.accessTokenReads, 1);
    });

    test(
      'clears session and throws auth error when backend rejects auth',
      () async {
        final transport = _FakeApiTransport(
          response: const ApiTransportResponse(
            statusCode: 401,
            body: '{"error":{"message":"missing credentials"}}',
          ),
        );
        final sessionStore = InMemoryAuthSessionStore();
        final cognitoSession = _FakeCognitoSessionProvider('expired-token');
        final client = TrustBiteApiClient(
          config: config,
          transport: transport,
          sessionStore: sessionStore,
          cognitoSessionProvider: cognitoSession,
        );

        await expectLater(
          () => client.getJson('/users/me'),
          throwsA(isA<AuthRequiredException>()),
        );
        expect(await sessionStore.read(), isNull);
        expect(cognitoSession.signOutCalls, 1);
      },
    );

    test(
      'surfaces backend error message without logging token values',
      () async {
        final transport = _FakeApiTransport(
          response: const ApiTransportResponse(
            statusCode: 403,
            body: '{"message":"insufficient permission"}',
          ),
        );
        final client = TrustBiteApiClient(
          config: config,
          transport: transport,
          sessionStore: InMemoryAuthSessionStore(),
          cognitoSessionProvider: _FakeCognitoSessionProvider('secret-token'),
        );

        await expectLater(
          () => client.getJson('/admin/users'),
          throwsA(
            isA<ApiException>()
                .having(
                  (error) => error.message,
                  'message',
                  'insufficient permission',
                )
                .having(
                  (error) => error.toString(),
                  'string',
                  isNot(contains('secret-token')),
                ),
          ),
        );
      },
    );

    test('sends trusted local headers for development auth sessions', () async {
      final transport = _FakeApiTransport(
        response: const ApiTransportResponse(
          statusCode: 200,
          body: '{"id":"local-user"}',
        ),
      );
      final client = TrustBiteApiClient(
        config: config,
        transport: transport,
        sessionStore: InMemoryAuthSessionStore(
          const AuthSession.trustedLocal(
            userId: '00000000-0000-4000-8000-000000000001',
            subject: 'local:00000000-0000-4000-8000-000000000001',
            phoneNumber: '+84901234567',
          ),
        ),
      );

      await client.getJson('/users/me');

      expect(transport.lastHeaders['Authorization'], isNull);
      expect(
        transport.lastHeaders['x-trustbite-user-id'],
        '00000000-0000-4000-8000-000000000001',
      );
      expect(
        transport.lastHeaders['x-trustbite-subject'],
        'local:00000000-0000-4000-8000-000000000001',
      );
      expect(transport.lastHeaders['x-trustbite-phone-number'], '+84901234567');
    });

    test('reads a fresh Cognito access token for every request', () async {
      final transport = _FakeApiTransport(
        response: const ApiTransportResponse(statusCode: 200, body: '{}'),
      );
      final cognitoSession = _QueueCognitoSessionProvider([
        'access-token-1',
        'access-token-2',
      ]);
      final client = TrustBiteApiClient(
        config: config,
        transport: transport,
        sessionStore: InMemoryAuthSessionStore(),
        cognitoSessionProvider: cognitoSession,
      );

      await client.getJson('/users/me');
      expect(transport.lastHeaders['Authorization'], 'Bearer access-token-1');
      await client.getJson('/users/me');
      expect(transport.lastHeaders['Authorization'], 'Bearer access-token-2');
    });

    test('maps a refused backend connection to a safe API error', () async {
      final client = TrustBiteApiClient(
        config: config,
        transport: const _ThrowingApiTransport(
          SocketException('Connection refused'),
        ),
        sessionStore: InMemoryAuthSessionStore(),
        cognitoSessionProvider: _FakeCognitoSessionProvider('access-token'),
      );

      await expectLater(
        () => client.getJson('/users/me'),
        throwsA(
          isA<ApiException>()
              .having((error) => error.statusCode, 'statusCode', 503)
              .having(
                (error) => error.message,
                'message',
                contains('bật backend'),
              ),
        ),
      );
    });

    test(
      'sends profile updates with PATCH and Cognito authorization',
      () async {
        final transport = _FakeApiTransport(
          response: const ApiTransportResponse(
            statusCode: 200,
            body: '{"profileComplete":true}',
          ),
        );
        final client = TrustBiteApiClient(
          config: config,
          transport: transport,
          sessionStore: InMemoryAuthSessionStore(),
          cognitoSessionProvider: _FakeCognitoSessionProvider('access-token'),
        );

        final result = await client.patchJson('/users/me', {
          'displayName': 'Nguyen Son',
          'dateOfBirth': '2004-11-20',
          'phoneNumber': '0395665937',
        });

        expect(result['profileComplete'], isTrue);
        expect(transport.lastMethod, 'PATCH');
        expect(transport.lastBody, contains('2004-11-20'));
        expect(transport.lastHeaders['Authorization'], 'Bearer access-token');
      },
    );

    test('sends authenticated multipart receipt evidence', () async {
      final tempDirectory = await Directory.systemTemp.createTemp(
        'trustbite-receipt-test',
      );
      final receipt = File('${tempDirectory.path}/receipt.jpg');
      await receipt.writeAsBytes([0xff, 0xd8, 0xff, 0xe0]);
      final multipartClient = _RecordingMultipartClient();
      final client = TrustBiteApiClient(
        config: config,
        multipartClient: multipartClient,
        sessionStore: InMemoryAuthSessionStore(),
        cognitoSessionProvider: _FakeCognitoSessionProvider('access-token'),
      );

      try {
        final result = await client.postMultipart(
          path: '/receipts',
          fields: {
            'reviewId': 'review-1',
            'restaurantId': 'restaurant-1',
            'latitude': '10.7769',
            'longitude': '106.7009',
            'gpsAccuracyMeters': '12',
          },
          fileField: 'receiptImage',
          filePath: receipt.path,
          idempotencyKey: '11111111-1111-4111-8111-111111111111',
        );

        expect(result['status'], 'UPLOADED');
        final request = multipartClient.lastRequest!;
        expect(request.url.path, '/api/v1/receipts');
        expect(request.headers['Authorization'], 'Bearer access-token');
        expect(
          request.headers['Idempotency-Key'],
          '11111111-1111-4111-8111-111111111111',
        );
        expect(request.fields['gpsAccuracyMeters'], '12');
        expect(request.files.single.field, 'receiptImage');
        expect(request.files.single.contentType.toString(), 'image/jpeg');
      } finally {
        await tempDirectory.delete(recursive: true);
      }
    });
  });
}

class _RecordingMultipartClient extends http.BaseClient {
  http.MultipartRequest? lastRequest;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    lastRequest = request as http.MultipartRequest;
    return http.StreamedResponse(
      Stream.value(utf8.encode('{"status":"UPLOADED"}')),
      202,
      headers: {'content-type': 'application/json'},
    );
  }
}

class _ThrowingApiTransport implements ApiTransport {
  const _ThrowingApiTransport(this.error);

  final Object error;

  @override
  Future<ApiTransportResponse> send(ApiTransportRequest request) async {
    throw error;
  }
}

class _FakeApiTransport implements ApiTransport {
  _FakeApiTransport({required this.response});

  final ApiTransportResponse response;
  Uri? lastUri;
  String? lastMethod;
  String? lastBody;
  Map<String, String> lastHeaders = const {};

  @override
  Future<ApiTransportResponse> send(ApiTransportRequest request) async {
    lastUri = request.uri;
    lastMethod = request.method;
    lastBody = request.body;
    lastHeaders = request.headers;
    return response;
  }
}

class _FakeCognitoSessionProvider implements CognitoSessionProvider {
  _FakeCognitoSessionProvider(this.accessToken);

  final String? accessToken;
  int accessTokenReads = 0;
  int signOutCalls = 0;

  @override
  Future<String?> getAccessToken() async {
    accessTokenReads += 1;
    return accessToken;
  }

  @override
  Future<void> initialize() async {}

  @override
  Future<bool> isSignedIn() async => accessToken != null;

  @override
  Future<void> signOut() async {
    signOutCalls += 1;
  }
}

class _QueueCognitoSessionProvider extends _FakeCognitoSessionProvider {
  _QueueCognitoSessionProvider(List<String> tokens)
    : _tokens = List.of(tokens),
      super(null);

  final List<String> _tokens;

  @override
  Future<String?> getAccessToken() async => _tokens.removeAt(0);
}
