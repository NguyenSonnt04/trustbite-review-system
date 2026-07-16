import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/core/api/restaurant_api.dart';
import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/core/auth/auth_session_store.dart';
import 'package:trustbite_mobile/src/core/config/mobile_runtime_config.dart';

void main() {
  test('nearby uses viewport bounds and clamps the page size', () async {
    final transport = _FakeTransport(
      const ApiTransportResponse(
        statusCode: 200,
        body:
            '{"items":[{"id":"restaurant-1","name":"Pho","latitude":10.78,"longitude":106.7,"trustScore":4.8}]}',
      ),
    );
    final api = RestaurantApi(
      apiClient: TrustBiteApiClient(
        config: const MobileRuntimeConfig(
          apiBaseUrl: 'http://localhost:5000',
          awsRegion: 'ap-southeast-1',
          cognitoUserPoolId: '',
          cognitoClientId: '',
        ),
        sessionStore: InMemoryAuthSessionStore(),
        transport: transport,
      ),
    );

    final items = await api.nearbyRestaurants(
      northEastLatitude: 10.9,
      northEastLongitude: 106.9,
      southWestLatitude: 10.6,
      southWestLongitude: 106.5,
      pageSize: 500,
    );

    expect(items.single.name, 'Pho');
    expect(transport.lastUri.path, '/api/v1/restaurants/nearby');
    expect(transport.lastUri.queryParameters['northEastLat'], '10.9');
    expect(transport.lastUri.queryParameters['southWestLng'], '106.5');
    expect(transport.lastUri.queryParameters['pageSize'], '250');
  });
}

class _FakeTransport implements ApiTransport {
  _FakeTransport(this.response);

  final ApiTransportResponse response;
  late Uri lastUri;

  @override
  Future<ApiTransportResponse> send(ApiTransportRequest request) async {
    lastUri = request.uri;
    return response;
  }
}
