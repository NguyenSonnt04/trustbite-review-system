import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/core/auth/auth_session.dart';
import 'package:trustbite_mobile/src/core/auth/auth_session_store.dart';
import 'package:trustbite_mobile/src/core/config/mobile_runtime_config.dart';
import 'package:trustbite_mobile/src/features/notifications/notification_service.dart';

void main() {
  test('fetches and parses notification pagination', () async {
    final transport = _FakeTransport([
      const ApiTransportResponse(
        statusCode: 200,
        body:
            '{"items":[{"id":"11111111-1111-4111-8111-111111111111","type":"REVIEW_VERIFIED","title":"Verified","body":"Done","payload":{"reviewId":"22222222-2222-4222-8222-222222222222"},"readAt":null,"createdAt":"2026-07-14T10:00:00.000Z"}],"page":1,"pageSize":20,"total":1,"unreadCount":1}',
      ),
    ]);
    final repository = ApiNotificationRepository(
      apiClient: TrustBiteApiClient(
        config: const MobileRuntimeConfig(
          apiBaseUrl: 'https://api.trustbite.test/api/v1',
          awsRegion: 'ap-southeast-1',
          cognitoUserPoolId: 'pool',
          cognitoClientId: 'client',
        ),
        sessionStore: _SessionStore(),
        transport: transport,
      ),
    );

    final result = await repository.fetchNotifications();

    expect(result.total, 1);
    expect(result.unreadCount, 1);
    expect(result.items.single.payload['reviewId'], isNotNull);
    expect(transport.requests.single.uri.queryParameters, {
      'page': '1',
      'pageSize': '20',
    });
  });
}

class _FakeTransport implements ApiTransport {
  _FakeTransport(this.responses);

  final List<ApiTransportResponse> responses;
  final List<ApiTransportRequest> requests = [];

  @override
  Future<ApiTransportResponse> send(ApiTransportRequest request) async {
    requests.add(request);
    return responses.removeAt(0);
  }
}

class _SessionStore implements AuthSessionStore {
  @override
  Future<void> clear() async {}

  @override
  Future<AuthSession?> read() async => const AuthSession(
    trustedLocalUserId: '11111111-1111-4111-8111-111111111111',
  );

  @override
  Future<void> write(AuthSession session) async {}
}
