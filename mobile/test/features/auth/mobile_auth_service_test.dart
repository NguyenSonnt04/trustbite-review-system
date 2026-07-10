import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/core/auth/auth_session_store.dart';
import 'package:trustbite_mobile/src/core/auth/cognito_session_provider.dart';
import 'package:trustbite_mobile/src/core/config/mobile_runtime_config.dart';
import 'package:trustbite_mobile/src/features/auth/mobile_auth_service.dart';

void main() {
  const config = MobileRuntimeConfig(
    apiBaseUrl: 'http://localhost:5000',
    awsRegion: 'ap-southeast-1',
    cognitoUserPoolId: 'pool-id',
    cognitoClientId: 'client-id',
  );

  group('MobileAuthService', () {
    test('loads backend user from the current Cognito session', () async {
      final sessionStore = InMemoryAuthSessionStore();
      final cognitoSession = _FakeCognitoSessionProvider();
      final transport = _FakeApiTransport(
        response: const ApiTransportResponse(
          statusCode: 200,
          body: '{"id":"user-1","email":"user@example.test"}',
        ),
      );
      final apiClient = TrustBiteApiClient(
        config: config,
        transport: transport,
        sessionStore: sessionStore,
        cognitoSessionProvider: cognitoSession,
      );
      final authService = MobileAuthService(
        apiClient: apiClient,
        sessionStore: sessionStore,
        cognitoSessionProvider: cognitoSession,
      );

      final user = await authService.completeCognitoSignIn();

      expect(user, {'id': 'user-1', 'email': 'user@example.test'});
      expect(
        transport.lastHeaders['Authorization'],
        'Bearer cognito-access-token',
      );
      expect(await sessionStore.read(), isNull);
      expect(cognitoSession.signOutCalls, 0);
    });

    test('keeps Cognito session on a transient backend failure', () async {
      final sessionStore = InMemoryAuthSessionStore();
      final cognitoSession = _FakeCognitoSessionProvider();
      final apiClient = TrustBiteApiClient(
        config: config,
        transport: _FakeApiTransport(
          response: const ApiTransportResponse(
            statusCode: 503,
            body: '{"message":"temporarily unavailable"}',
          ),
        ),
        sessionStore: sessionStore,
        cognitoSessionProvider: cognitoSession,
      );
      final authService = MobileAuthService(
        apiClient: apiClient,
        sessionStore: sessionStore,
        cognitoSessionProvider: cognitoSession,
      );

      await expectLater(
        authService.completeCognitoSignIn(),
        throwsA(isA<ApiException>()),
      );
      expect(cognitoSession.signOutCalls, 0);
    });

    test(
      'creates local development user and stores trusted local session',
      () async {
        final sessionStore = InMemoryAuthSessionStore();
        final transport = _QueueApiTransport([
          const ApiTransportResponse(
            statusCode: 201,
            body:
                '{"trustedLocal":{"userId":"00000000-0000-4000-8000-000000000001","subject":"local:00000000-0000-4000-8000-000000000001","phoneNumber":"+84901234567"}}',
          ),
          const ApiTransportResponse(
            statusCode: 200,
            body:
                '{"id":"00000000-0000-4000-8000-000000000001","phoneNumber":"+84901234567"}',
          ),
        ]);
        final apiClient = TrustBiteApiClient(
          config: config,
          transport: transport,
          sessionStore: sessionStore,
          cognitoSessionProvider: _FakeCognitoSessionProvider(),
        );
        final authService = MobileAuthService(
          apiClient: apiClient,
          sessionStore: sessionStore,
          cognitoSessionProvider: _FakeCognitoSessionProvider(),
        );

        final user = await authService.completeLocalDevelopmentSignUp(
          phoneNumber: '+84901234567',
          displayName: 'Local User',
        );

        final session = await sessionStore.read();
        expect(user['phoneNumber'], '+84901234567');
        expect(
          session?.trustedLocalUserId,
          '00000000-0000-4000-8000-000000000001',
        );
        expect(
          transport.requests.first.uri.toString(),
          'http://localhost:5000/api/v1/auth/dev/local-signup',
        );
        expect(
          transport.requests.last.headers['x-trustbite-user-id'],
          '00000000-0000-4000-8000-000000000001',
        );
      },
    );
  });
}

class _FakeCognitoSessionProvider implements CognitoSessionProvider {
  int signOutCalls = 0;

  @override
  Future<String?> getAccessToken() async => 'cognito-access-token';

  @override
  Future<void> initialize() async {}

  @override
  Future<bool> isSignedIn() async => true;

  @override
  Future<void> signOut() async {
    signOutCalls += 1;
  }
}

class _FakeApiTransport implements ApiTransport {
  _FakeApiTransport({required this.response});

  final ApiTransportResponse response;
  Map<String, String> lastHeaders = const {};

  @override
  Future<ApiTransportResponse> send(ApiTransportRequest request) async {
    lastHeaders = request.headers;
    return response;
  }
}

class _QueueApiTransport implements ApiTransport {
  _QueueApiTransport(List<ApiTransportResponse> responses)
    : _responses = List.of(responses);

  final List<ApiTransportResponse> _responses;
  final List<ApiTransportRequest> requests = [];

  @override
  Future<ApiTransportResponse> send(ApiTransportRequest request) async {
    requests.add(request);
    return _responses.removeAt(0);
  }
}
