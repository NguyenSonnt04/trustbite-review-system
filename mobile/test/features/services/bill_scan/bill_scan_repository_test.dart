import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/core/auth/auth_session_store.dart';
import 'package:trustbite_mobile/src/core/config/mobile_runtime_config.dart';
import 'package:trustbite_mobile/src/features/home/data/restaurant_discovery_service.dart';
import 'package:trustbite_mobile/src/features/home/models/home_models.dart';
import 'package:trustbite_mobile/src/features/services/bill_scan/bill_scan_models.dart';
import 'package:trustbite_mobile/src/features/services/bill_scan/bill_scan_repository.dart';

void main() {
  const config = MobileRuntimeConfig(
    apiBaseUrl: 'http://localhost:5000',
    awsRegion: 'ap-southeast-1',
    cognitoUserPoolId: '',
    cognitoClientId: '',
  );

  test('maps active restaurants and parses branch address and area', () async {
    final transport = _SequencedTransport([
      const ApiTransportResponse(
        statusCode: 200,
        body:
            '{"items":[{"id":"branch-1","restaurantId":"restaurant-1","name":"Chi nhánh Nguyễn Huệ","address":"12 Nguyễn Huệ, Quận 1","area":null,"latitude":10.77,"longitude":106.70}]}',
      ),
    ]);
    final repository = ApiBillScanRepository(
      apiClient: TrustBiteApiClient(
        config: config,
        sessionStore: InMemoryAuthSessionStore(),
        transport: transport,
      ),
      restaurantRepository: const _RestaurantRepository([
        HomeRestaurant(
          id: 'restaurant-1',
          name: 'Phở TrustBite',
          rating: '4.8',
          distance: null,
          status: 'Đang mở',
          image: null,
          featured: false,
        ),
        HomeRestaurant(
          id: null,
          name: 'Dữ liệu mẫu không hoạt động',
          rating: 'Mới',
          distance: null,
          status: 'Mẫu',
          image: null,
          featured: false,
        ),
      ]),
    );

    final restaurants = await repository.fetchRestaurants();
    final branches = await repository.fetchBranches('restaurant-1');

    expect(restaurants, hasLength(1));
    expect(restaurants.single.name, 'Phở TrustBite');
    expect(
      transport.requests.single.uri.path,
      '/api/v1/restaurants/restaurant-1/branches',
    );
    expect(branches.single.address, '12 Nguyễn Huệ, Quận 1');
    expect(branches.single.area, 'Quận 1');
  });

  test('submits JPG multipart and parses normalized comparison result', () async {
    final transport = _SequencedTransport([
      const ApiTransportResponse(
        statusCode: 201,
        body:
            '{"id":"scan-1","status":"COMPLETED","overallResult":"PRICE_MISMATCH","restaurant":{"id":"restaurant-1","name":"Phở TrustBite"},"branch":{"id":"branch-1","restaurantId":"restaurant-1","name":"Chi nhánh Nguyễn Huệ","address":"12 Nguyễn Huệ","area":null},"items":[{"observedName":"Phở tái","menuItem":{"id":"menu-1","name":"Phở bò tái"},"observedUnitPrice":70000,"expectedUnitPrice":65000,"priceDifference":5000,"mappingConfidence":0.94,"result":"PRICE_MISMATCH"},{"observedName":"Khăn lạnh","menuItem":null,"observedUnitPrice":3000,"expectedUnitPrice":null,"priceDifference":null,"mappingConfidence":0.31,"result":"INCONCLUSIVE"}]}',
      ),
    ]);
    final repository = ApiBillScanRepository(
      apiClient: TrustBiteApiClient(
        config: config,
        sessionStore: InMemoryAuthSessionStore(),
        transport: transport,
      ),
      restaurantRepository: const _RestaurantRepository([]),
      idempotencyKeyFactory: () => '11111111-1111-4111-8111-111111111111',
    );

    final result = await repository.submitScan(
      restaurantId: 'restaurant-1',
      branchId: 'branch-1',
      receipt: const BillReceiptFile(
        fileName: 'bill.jpg',
        contentType: 'image/jpeg',
        bytes: [255, 216, 255, 224, 1, 2],
      ),
    );

    final request = transport.requests.single;
    expect(request.method, 'POST');
    expect(request.uri.path, '/api/v1/bill-scans');
    expect(
      request.headers['Idempotency-Key'],
      '11111111-1111-4111-8111-111111111111',
    );
    final multipart = utf8.decode(request.bodyBytes!, allowMalformed: true);
    expect(multipart, contains('name="restaurantId"'));
    expect(multipart, contains('restaurant-1'));
    expect(multipart, contains('name="branchId"'));
    expect(multipart, contains('name="receiptImage"; filename="bill.jpg"'));
    expect(result.overallResult, 'PRICE_MISMATCH');
    expect(result.items, hasLength(2));
    expect(result.items.first.matchedName, 'Phở bò tái');
    expect(result.items.first.confidence, 0.94);
    expect(result.items.first.priceDifference, 5000);
    expect(result.items.last.isUnmatched, isTrue);
  });

  test(
    'rejects malformed branch ownership and unsupported image types',
    () async {
      final transport = _SequencedTransport([
        const ApiTransportResponse(
          statusCode: 200,
          body:
              '{"items":[{"id":"branch-1","restaurantId":"other","name":"Sai quán","address":"1 A","area":"Quận 1"}]}',
        ),
      ]);
      final repository = ApiBillScanRepository(
        apiClient: TrustBiteApiClient(
          config: config,
          sessionStore: InMemoryAuthSessionStore(),
          transport: transport,
        ),
        restaurantRepository: const _RestaurantRepository([]),
      );

      await expectLater(
        repository.fetchBranches('restaurant-1'),
        throwsA(isA<FormatException>()),
      );
      await expectLater(
        repository.submitScan(
          restaurantId: 'restaurant-1',
          branchId: 'branch-1',
          receipt: const BillReceiptFile(
            fileName: 'bill.webp',
            contentType: 'image/webp',
            bytes: [1, 2, 3],
          ),
        ),
        throwsA(isA<FormatException>()),
      );
      expect(transport.requests, hasLength(1));
    },
  );
}

class _SequencedTransport implements ApiTransport {
  _SequencedTransport(this.responses);

  final List<ApiTransportResponse> responses;
  final List<ApiTransportRequest> requests = [];

  @override
  Future<ApiTransportResponse> send(ApiTransportRequest request) async {
    requests.add(request);
    return responses.removeAt(0);
  }
}

class _RestaurantRepository implements RestaurantDiscoveryRepository {
  const _RestaurantRepository(this.restaurants);

  final List<HomeRestaurant> restaurants;

  @override
  Future<List<HomeRestaurant>> fetchRestaurants() async => restaurants;

  @override
  Future<HomeRestaurantDetail> fetchRestaurantDetail(String restaurantId) {
    throw UnimplementedError();
  }

  @override
  Future<List<HomeMenuItem>> fetchRestaurantMenu(String restaurantId) {
    throw UnimplementedError();
  }

  @override
  Future<HomeRestaurantReviewPage> fetchRestaurantReviews(String restaurantId) {
    throw UnimplementedError();
  }
}
