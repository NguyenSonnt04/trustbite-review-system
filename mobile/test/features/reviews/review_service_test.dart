import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/core/auth/auth_session_store.dart';
import 'package:trustbite_mobile/src/core/config/mobile_runtime_config.dart';
import 'package:trustbite_mobile/src/features/reviews/data/review_service.dart';

void main() {
  test('maps active restaurants from the backend response', () async {
    final api = _FakeApiClient()
      ..getResponse = {
        'items': [
          {
            'id': 'restaurant-1',
            'name': 'Phở Thìn',
            'address': 'Hà Nội',
            'trustScore': 4.8,
            'latitude': 21.0285,
            'longitude': 105.8542,
          },
        ],
      };
    final service = ReviewService(apiClient: api);

    final restaurants = await service.listRestaurants();

    expect(restaurants.single.id, 'restaurant-1');
    expect(restaurants.single.name, 'Phở Thìn');
    expect(restaurants.single.canVerifyLocation, isTrue);
    expect(api.lastPath, '/restaurants');
    expect(api.lastQuery?['status'], 'ACTIVE');
  });

  test('creates a private review with four ratings and comment', () async {
    final api = _FakeApiClient()..postResponse = {'reviewId': 'review-1'};
    final service = ReviewService(apiClient: api);

    final reviewId = await service.createReview(
      restaurantId: 'restaurant-1',
      foodRating: 5,
      priceRating: 4,
      serviceRating: 5,
      ambienceRating: 4,
      comment: 'Món ăn ngon, phục vụ nhanh, giá hợp lý và không gian sạch sẽ.',
    );

    expect(reviewId, 'review-1');
    expect(api.lastPath, '/reviews');
    expect(api.lastBody?['restaurantId'], 'restaurant-1');
    expect(api.lastBody?['foodRating'], 5);
  });

  test('uploads receipt with mandatory GPS evidence', () async {
    final api = _FakeApiClient()
      ..multipartResponse = {
        'receiptVerificationId': 'receipt-1',
        'status': 'UPLOADED',
      };
    final service = ReviewService(apiClient: api);

    await service.uploadReceipt(
      reviewId: 'review-1',
      restaurantId: 'restaurant-1',
      receiptPath: '/tmp/receipt.jpg',
      location: const ReviewLocation(
        latitude: 10.7769,
        longitude: 106.7009,
        accuracyMeters: 12,
      ),
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
    );

    expect(api.lastPath, '/receipts');
    expect(api.lastFields?['latitude'], '10.7769');
    expect(api.lastFields?['longitude'], '106.7009');
    expect(api.lastFields?['gpsAccuracyMeters'], '12.0');
    expect(api.lastFileField, 'receiptImage');
  });
}

class _FakeApiClient extends TrustBiteApiClient {
  _FakeApiClient()
    : super(
        config: const MobileRuntimeConfig(
          apiBaseUrl: 'http://localhost:5000',
          awsRegion: '',
          cognitoUserPoolId: '',
          cognitoClientId: '',
        ),
        sessionStore: InMemoryAuthSessionStore(),
      );

  Map<String, dynamic> getResponse = {};
  Map<String, dynamic> postResponse = {};
  Map<String, dynamic> multipartResponse = {};
  String? lastPath;
  Map<String, String?>? lastQuery;
  Map<String, dynamic>? lastBody;
  Map<String, String>? lastFields;
  String? lastFileField;

  @override
  Future<Map<String, dynamic>> getJson(
    String path, [
    Map<String, String?>? queryParameters,
  ]) async {
    lastPath = path;
    lastQuery = queryParameters;
    return getResponse;
  }

  @override
  Future<Map<String, dynamic>> postJson(
    String path,
    Map<String, dynamic> body,
  ) async {
    lastPath = path;
    lastBody = body;
    return postResponse;
  }

  @override
  Future<Map<String, dynamic>> postMultipart({
    required String path,
    required Map<String, String> fields,
    required String fileField,
    required String filePath,
    required String idempotencyKey,
  }) async {
    lastPath = path;
    lastFields = fields;
    lastFileField = fileField;
    return multipartResponse;
  }
}
