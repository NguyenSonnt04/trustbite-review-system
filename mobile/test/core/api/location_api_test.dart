import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/core/api/location_api.dart';
import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/core/auth/auth_session_store.dart';
import 'package:trustbite_mobile/src/core/config/mobile_runtime_config.dart';

void main() {
  const config = MobileRuntimeConfig(
    apiBaseUrl: 'http://localhost:5000',
    awsRegion: 'ap-southeast-1',
    cognitoUserPoolId: '',
    cognitoClientId: '',
  );

  group('LocationApi', () {
    test('search sends an optional position bias and parses places', () async {
      final transport = _FakeTransport(
        const ApiTransportResponse(
          statusCode: 200,
          body:
              '{"items":[{"label":"Ben Thanh Market","latitude":10.772,"longitude":106.698,"country":"VNM","categories":["Market"]}]}',
        ),
      );
      final api = _api(config, transport);

      final places = await api.searchPlaces(
        '  Ben Thanh  ',
        latitude: 10.77,
        longitude: 106.69,
      );

      expect(places.single.label, 'Ben Thanh Market');
      expect(places.single.categories, ['Market']);
      expect(transport.lastUri.path, '/api/v1/location/search');
      expect(transport.lastUri.queryParameters, {
        'q': 'Ben Thanh',
        'lat': '10.77',
        'lng': '106.69',
      });
    });

    test('reverse geocode accepts a null place', () async {
      final transport = _FakeTransport(
        const ApiTransportResponse(statusCode: 200, body: '{"place":null}'),
      );

      expect(await _api(config, transport).reverseGeocode(10, 106), isNull);
    });

    test('route preserves AWS geometry order as longitude then latitude', () async {
      final transport = _FakeTransport(
        const ApiTransportResponse(
          statusCode: 200,
          body:
              '{"route":{"distanceMeters":1200,"durationSeconds":420,"geometry":[[106.7,10.7],[106.8,10.8]],"legs":[]}}',
        ),
      );

      final route = await _api(config, transport).calculateRoute(
        origin: const LocationCoordinate(latitude: 10.7, longitude: 106.7),
        destination:
            const LocationCoordinate(latitude: 10.8, longitude: 106.8),
      );

      expect(route.geometry.first.longitude, 106.7);
      expect(route.geometry.first.latitude, 10.7);
      expect(transport.lastUri.queryParameters['mode'], 'car');
    });

    test('nearby uses viewport bounds and clamps the page size', () async {
      final transport = _FakeTransport(
        const ApiTransportResponse(
          statusCode: 200,
          body:
              '{"items":[{"id":"restaurant-1","name":"Pho","latitude":10.78,"longitude":106.7,"trustScore":4.8}]}',
        ),
      );

      final items = await _api(config, transport).nearbyRestaurants(
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

    test('rejects a one-sided search position bias before transport', () async {
      final transport = _FakeTransport(
        const ApiTransportResponse(statusCode: 200, body: '{"items":[]}'),
      );

      await expectLater(
        _api(config, transport).searchPlaces('coffee', latitude: 10),
        throwsArgumentError,
      );
      expect(transport.requests, 0);
    });
  });
}

LocationApi _api(MobileRuntimeConfig config, ApiTransport transport) {
  return LocationApi(
    apiClient: TrustBiteApiClient(
      config: config,
      sessionStore: InMemoryAuthSessionStore(),
      transport: transport,
    ),
  );
}

class _FakeTransport implements ApiTransport {
  _FakeTransport(this.response);

  final ApiTransportResponse response;
  late Uri lastUri;
  int requests = 0;

  @override
  Future<ApiTransportResponse> send(ApiTransportRequest request) async {
    requests += 1;
    lastUri = request.uri;
    return response;
  }
}
