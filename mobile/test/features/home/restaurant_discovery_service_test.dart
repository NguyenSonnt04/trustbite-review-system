import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/core/auth/auth_session_store.dart';
import 'package:trustbite_mobile/src/core/config/mobile_runtime_config.dart';
import 'package:trustbite_mobile/src/features/home/data/restaurant_discovery_service.dart';

void main() {
  const config = MobileRuntimeConfig(
    apiBaseUrl: 'http://localhost:5000',
    awsRegion: 'ap-southeast-1',
    cognitoUserPoolId: '',
    cognitoClientId: '',
  );

  test('loads real restaurant summaries and primary image URLs', () async {
    final transport = _RestaurantTransport(
      body: '''
        {
          "items": [
            {
              "id": "restaurant-1",
              "name": "Phở Thìn Bờ Hồ",
              "trustScore": 4.9,
              "distanceMeters": 420.0,
              "verifiedReviewCount": 18,
              "primaryImageUrl": "https://cdn.example.test/pho.jpg"
            }
          ],
          "page": 1,
          "pageSize": 10,
          "total": 1
        }
      ''',
    );
    final service = RestaurantDiscoveryService(
      apiClient: TrustBiteApiClient(
        config: config,
        sessionStore: InMemoryAuthSessionStore(),
        transport: transport,
      ),
    );

    final restaurants = await service.fetchRestaurants();

    expect(transport.lastUri.toString(), contains('/api/v1/restaurants'));
    expect(transport.lastUri.queryParameters, {
      'sort': 'trustScoreDesc',
      'pageSize': '10',
    });
    expect(restaurants, hasLength(1));
    expect(restaurants.single.id, 'restaurant-1');
    expect(restaurants.single.name, 'Phở Thìn Bờ Hồ');
    expect(restaurants.single.rating, '4.9');
    expect(restaurants.single.distance, '0.4 km');
    expect(restaurants.single.image, 'https://cdn.example.test/pho.jpg');
    expect(restaurants.single.status, '18 review xác thực');
  });

  test('keeps missing optional backend fields display-safe', () async {
    final service = RestaurantDiscoveryService(
      apiClient: TrustBiteApiClient(
        config: config,
        sessionStore: InMemoryAuthSessionStore(),
        transport: _RestaurantTransport(
          body: '''
            {
              "items": [
                {
                  "id": "restaurant-2",
                  "name": "Bếp Việt",
                  "trustScore": null,
                  "verifiedReviewCount": 0,
                  "primaryImageUrl": null
                }
              ],
              "page": 1,
              "pageSize": 10,
              "total": 1
            }
          ''',
        ),
      ),
    );

    final restaurant = (await service.fetchRestaurants()).single;

    expect(restaurant.rating, 'Mới');
    expect(restaurant.distance, isNull);
    expect(restaurant.image, isNull);
    expect(restaurant.status, 'Chưa có review xác thực');
  });

  test('rejects malformed restaurant list envelopes', () async {
    final service = RestaurantDiscoveryService(
      apiClient: TrustBiteApiClient(
        config: config,
        sessionStore: InMemoryAuthSessionStore(),
        transport: _RestaurantTransport(body: '{"items":"invalid"}'),
      ),
    );

    await expectLater(
      service.fetchRestaurants(),
      throwsA(isA<FormatException>()),
    );
  });

  test('loads the selected restaurant detail by backend id', () async {
    final transport = _RestaurantTransport(
      body: '''
        {
          "id": "restaurant-9",
          "name": "Bún Bò Chi Tiết",
          "description": "Nước dùng ninh trong ngày.",
          "address": "12 Nguyễn Huệ, Quận 1",
          "phoneNumber": "0909123456",
          "trustScore": 4.7,
          "verifiedReviewCount": 21,
          "primaryImageUrl": "https://cdn.example.test/bun-bo.jpg",
          "ratingBreakdown": {
            "avgFood": 4.8,
            "avgPrice": 4.1,
            "avgService": 4.5,
            "avgAmbience": 4.0,
            "avgOverall": 4.4,
            "reviewCount": 24
          }
        }
      ''',
    );
    final service = RestaurantDiscoveryService(
      apiClient: TrustBiteApiClient(
        config: config,
        sessionStore: InMemoryAuthSessionStore(),
        transport: transport,
      ),
    );

    final detail = await service.fetchRestaurantDetail('restaurant-9');

    expect(
      transport.lastUri.toString(),
      'http://localhost:5000/api/v1/restaurants/restaurant-9',
    );
    expect(detail.id, 'restaurant-9');
    expect(detail.name, 'Bún Bò Chi Tiết');
    expect(detail.imageUrl, 'https://cdn.example.test/bun-bo.jpg');
    expect(detail.trustScore, 4.7);
    expect(detail.ratingBreakdown.reviewCount, 24);
    expect(detail.ratingBreakdown.averageFood, 4.8);
  });

  test(
    'loads active restaurant menu items from the public menu endpoint',
    () async {
      final transport = _RestaurantTransport(
        body: '''
        {
          "items": [
            {
              "id": "menu-1",
              "name": "Phở bò tái",
              "price": 65000,
              "currency": "VND"
            }
          ],
          "page": 1,
          "pageSize": 50,
          "total": 1
        }
      ''',
      );
      final service = RestaurantDiscoveryService(
        apiClient: TrustBiteApiClient(
          config: config,
          sessionStore: InMemoryAuthSessionStore(),
          transport: transport,
        ),
      );

      final items = await service.fetchRestaurantMenu('restaurant-9');

      expect(
        transport.lastUri.toString(),
        'http://localhost:5000/api/v1/restaurants/restaurant-9/menu?page=1&pageSize=50',
      );
      expect(items, hasLength(1));
      expect(items.single.name, 'Phở bò tái');
      expect(items.single.price, 65000);
      expect(items.single.currency, 'VND');
    },
  );

  test('rejects malformed restaurant menu envelopes', () async {
    final service = RestaurantDiscoveryService(
      apiClient: TrustBiteApiClient(
        config: config,
        sessionStore: InMemoryAuthSessionStore(),
        transport: _RestaurantTransport(body: '{"items":"invalid"}'),
      ),
    );

    await expectLater(
      service.fetchRestaurantMenu('restaurant-9'),
      throwsA(isA<FormatException>()),
    );
  });

  test('loads public restaurant reviews with display names only', () async {
    final transport = _RestaurantTransport(
      body: '''
        {
          "items": [
            {
              "id": "review-1",
              "restaurantId": "restaurant-9",
              "branchId": null,
              "foodRating": 5,
              "priceRating": 4,
              "serviceRating": 5,
              "ambienceRating": 4,
              "averageRating": 4.5,
              "reviewerDisplayName": "Nguyễn An",
              "comment": "Món ăn ngon và phục vụ rất nhiệt tình.",
              "status": "VERIFIED",
              "verificationStatus": "VERIFIED",
              "trustLabel": "RECEIPT_VERIFIED",
              "visitedAt": "2026-07-12T10:00:00.000Z",
              "createdAt": "2026-07-13T10:00:00.000Z",
              "updatedAt": "2026-07-13T10:00:00.000Z"
            }
          ],
          "page": 1,
          "pageSize": 20,
          "total": 1
        }
      ''',
    );
    final service = RestaurantDiscoveryService(
      apiClient: TrustBiteApiClient(
        config: config,
        sessionStore: InMemoryAuthSessionStore(),
        transport: transport,
      ),
    );

    final page = await service.fetchRestaurantReviews('restaurant-9');

    expect(
      transport.lastUri.toString(),
      'http://localhost:5000/api/v1/restaurants/restaurant-9/reviews?status=ALL&page=1&pageSize=20',
    );
    expect(page.total, 1);
    expect(page.items.single.comment, contains('Món ăn ngon'));
    expect(page.items.single.averageRating, 4.5);
    expect(page.items.single.reviewerDisplayName, 'Nguyễn An');
    expect(page.items.single.status, 'VERIFIED');
    expect(page.items.single.visitedAt, DateTime.utc(2026, 7, 12, 10));
  });

  test('rejects malformed public review envelopes', () async {
    final service = RestaurantDiscoveryService(
      apiClient: TrustBiteApiClient(
        config: config,
        sessionStore: InMemoryAuthSessionStore(),
        transport: _RestaurantTransport(body: '{"items":"invalid"}'),
      ),
    );

    await expectLater(
      service.fetchRestaurantReviews('restaurant-9'),
      throwsA(isA<FormatException>()),
    );
  });
}

class _RestaurantTransport implements ApiTransport {
  _RestaurantTransport({required this.body});

  final String body;
  Uri lastUri = Uri();

  @override
  Future<ApiTransportResponse> send(ApiTransportRequest request) async {
    lastUri = request.uri;
    return ApiTransportResponse(statusCode: 200, body: body);
  }
}
