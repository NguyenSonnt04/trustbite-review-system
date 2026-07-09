import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/core/auth/auth_session.dart';
import 'package:trustbite_mobile/src/core/auth/auth_session_store.dart';
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
      final sessionStore = InMemoryAuthSessionStore(
        const AuthSession.cognito(accessToken: 'access-token'),
      );
      final client = TrustBiteApiClient(
        config: config,
        transport: transport,
        sessionStore: sessionStore,
      );

      final body = await client.getJson('/users/me');

      expect(body, {'id': 'user-1', 'displayName': 'An'});
      expect(transport.lastUri.toString(),
          'http://localhost:5000/api/v1/users/me');
      expect(transport.lastHeaders['Authorization'], 'Bearer access-token');
      expect(transport.lastHeaders['Content-Type'], 'application/json');
    });

    test('clears session and throws auth error when backend rejects auth',
        () async {
      final transport = _FakeApiTransport(
        response: const ApiTransportResponse(
          statusCode: 401,
          body: '{"error":{"message":"missing credentials"}}',
        ),
      );
      final sessionStore = InMemoryAuthSessionStore(
        const AuthSession.cognito(accessToken: 'expired-token'),
      );
      final client = TrustBiteApiClient(
        config: config,
        transport: transport,
        sessionStore: sessionStore,
      );

      await expectLater(
        () => client.getJson('/users/me'),
        throwsA(isA<AuthRequiredException>()),
      );
      expect(await sessionStore.read(), isNull);
    });

    test('surfaces backend error message without logging token values',
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
        sessionStore: InMemoryAuthSessionStore(
          const AuthSession.cognito(accessToken: 'secret-token'),
        ),
      );

      await expectLater(
        () => client.getJson('/admin/users'),
        throwsA(
          isA<ApiException>()
              .having((error) => error.message, 'message',
                  'insufficient permission')
              .having((error) => error.toString(), 'string',
                  isNot(contains('secret-token'))),
        ),
      );
    });

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
  });
}

class _FakeApiTransport implements ApiTransport {
  _FakeApiTransport({required this.response});

  final ApiTransportResponse response;
  Uri? lastUri;
  Map<String, String> lastHeaders = const {};

  @override
  Future<ApiTransportResponse> send(ApiTransportRequest request) async {
    lastUri = request.uri;
    lastHeaders = request.headers;
    return response;
  }
}
