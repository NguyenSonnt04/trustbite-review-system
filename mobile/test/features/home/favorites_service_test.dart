import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/core/auth/auth_session_store.dart';
import 'package:trustbite_mobile/src/core/config/mobile_runtime_config.dart';
import 'package:trustbite_mobile/src/features/home/data/favorites_service.dart';

void main() {
  const config = MobileRuntimeConfig(
    apiBaseUrl: 'http://localhost:5000',
    awsRegion: 'ap-southeast-1',
    cognitoUserPoolId: '',
    cognitoClientId: '',
  );
  const restaurantId = '11111111-1111-4111-8111-111111111111';

  test('loads favorite restaurant cards from the authenticated API', () async {
    final transport = _FavoritesTransport([
      const ApiTransportResponse(
        statusCode: 200,
        body:
            '{"items":[{"id":"11111111-1111-4111-8111-111111111111","name":"Phở thật","primaryImageUrl":"https://cdn.example/pho.webp","trustScore":4.7,"verifiedReviewCount":8,"addedAt":"2026-07-19T10:00:00.000Z"}]}',
      ),
    ]);
    final service = FavoritesService(
      apiClient: TrustBiteApiClient(
        config: config,
        sessionStore: InMemoryAuthSessionStore(),
        transport: transport,
      ),
    );

    final favorites = await service.fetchFavorites();

    expect(transport.requests.single.method, 'GET');
    expect(transport.requests.single.uri.path, '/api/v1/users/me/favorites');
    expect(favorites.single.restaurant.name, 'Phở thật');
    expect(favorites.single.restaurant.rating, '4.7');
    expect(favorites.single.restaurant.status, '8 review xác thực');
    expect(favorites.single.addedAt, DateTime.utc(2026, 7, 19, 10));
  });

  test('saves and removes a restaurant idempotently', () async {
    final transport = _FavoritesTransport([
      const ApiTransportResponse(statusCode: 201, body: '{"saved":true}'),
      const ApiTransportResponse(statusCode: 200, body: '{"success":true}'),
    ]);
    final service = FavoritesService(
      apiClient: TrustBiteApiClient(
        config: config,
        sessionStore: InMemoryAuthSessionStore(),
        transport: transport,
      ),
    );

    await service.saveFavorite(restaurantId);
    await service.removeFavorite(restaurantId);

    expect(transport.requests[0].method, 'PUT');
    expect(
      transport.requests[0].uri.path,
      '/api/v1/users/me/favorites/$restaurantId',
    );
    expect(transport.requests[1].method, 'DELETE');
    expect(
      transport.requests[1].uri.path,
      '/api/v1/users/me/favorites/$restaurantId',
    );
  });
}

class _FavoritesTransport implements ApiTransport {
  _FavoritesTransport(this.responses);

  final List<ApiTransportResponse> responses;
  final List<ApiTransportRequest> requests = [];

  @override
  Future<ApiTransportResponse> send(ApiTransportRequest request) async {
    requests.add(request);
    return responses.removeAt(0);
  }
}
