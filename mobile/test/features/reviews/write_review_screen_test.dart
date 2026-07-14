import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/core/auth/auth_session_store.dart';
import 'package:trustbite_mobile/src/core/config/mobile_runtime_config.dart';
import 'package:trustbite_mobile/src/features/reviews/data/review_service.dart';
import 'package:trustbite_mobile/src/features/reviews/services/review_evidence_services.dart';
import 'package:trustbite_mobile/src/features/reviews/write_review_screen.dart';

void main() {
  const restaurant = RestaurantSummary(
    id: 'restaurant-1',
    name: 'Phở Thìn Bờ Hồ',
    address: 'Hà Nội',
    trustScore: 4.9,
    canVerifyLocation: true,
  );

  testWidgets('requires comment, receipt, and GPS before submission', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: WriteReviewScreen(
          restaurant: restaurant,
          reviewService: _FakeReviewService(),
          receiptPicker: _FakeReceiptPicker(),
          locationProvider: _FakeLocationProvider(),
        ),
      ),
    );

    final pageScroll = find.byType(Scrollable).first;
    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('submit-review')),
      300,
      scrollable: pageScroll,
    );
    await tester.tap(find.byKey(const ValueKey('submit-review')));
    await tester.pump();

    expect(
      find.text('Nội dung đánh giá cần ít nhất 50 ký tự.'),
      findsOneWidget,
    );
  });

  testWidgets('submits receipt and GPS then shows verified backend status', (
    tester,
  ) async {
    final service = _FakeReviewService();
    await tester.pumpWidget(
      MaterialApp(
        home: WriteReviewScreen(
          restaurant: restaurant,
          reviewService: service,
          receiptPicker: _FakeReceiptPicker(),
          locationProvider: _FakeLocationProvider(),
        ),
      ),
    );

    final pageScroll = find.byType(Scrollable).first;
    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('review-comment-field')),
      250,
      scrollable: pageScroll,
    );
    await tester.enterText(
      find.byKey(const ValueKey('review-comment-field')),
      'Món ăn rất ngon, phục vụ nhanh, giá hợp lý và không gian sạch sẽ.',
    );
    await tester.scrollUntilVisible(
      find.text('Thư viện'),
      250,
      scrollable: pageScroll,
    );
    await tester.tap(find.text('Thư viện'));
    await tester.pump();
    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('capture-review-location')),
      250,
      scrollable: pageScroll,
    );
    await tester.tap(find.byKey(const ValueKey('capture-review-location')));
    await tester.pump();
    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('submit-review')),
      250,
      scrollable: pageScroll,
    );
    await tester.tap(find.byKey(const ValueKey('submit-review')));
    await tester.pumpAndSettle();

    expect(service.createCalls, 1);
    expect(service.uploadCalls, 1);
    expect(service.lastLocation?.accuracyMeters, 12);
    expect(find.text('Đánh giá đã được xác minh'), findsOneWidget);
    expect(
      find.text(
        'Đánh giá của bạn đã đủ bằng chứng và có thể hiển thị công khai.',
      ),
      findsOneWidget,
    );
  });
}

class _FakeReviewService extends ReviewService {
  _FakeReviewService() : super(apiClient: _DummyApiClient());

  int createCalls = 0;
  int uploadCalls = 0;
  ReviewLocation? lastLocation;

  @override
  Future<String> createReview({
    required String restaurantId,
    required int foodRating,
    required int priceRating,
    required int serviceRating,
    required int ambienceRating,
    required String comment,
  }) async {
    createCalls += 1;
    return 'review-1';
  }

  @override
  Future<Map<String, dynamic>> uploadReceipt({
    required String reviewId,
    required String restaurantId,
    required String receiptPath,
    required ReviewLocation location,
    required String idempotencyKey,
  }) async {
    uploadCalls += 1;
    lastLocation = location;
    return {'status': 'UPLOADED'};
  }

  @override
  String createIdempotencyKey() => '11111111-1111-4111-8111-111111111111';

  @override
  Future<Map<String, dynamic>> getReviewStatus(String reviewId) async {
    return {
      'reviewId': reviewId,
      'status': 'VERIFIED',
      'publicVisibility': 'PUBLIC',
    };
  }
}

class _FakeReceiptPicker implements ReceiptImagePicker {
  @override
  Future<String?> pickFromCamera() async => 'receipt.jpg';

  @override
  Future<String?> pickFromGallery() async => 'receipt.jpg';
}

class _FakeLocationProvider implements ReviewLocationProvider {
  @override
  Future<ReviewLocation> getCurrentLocation() async {
    return const ReviewLocation(
      latitude: 10.7769,
      longitude: 106.7009,
      accuracyMeters: 12,
    );
  }
}

class _DummyApiClient extends TrustBiteApiClient {
  _DummyApiClient()
    : super(
        config: const MobileRuntimeConfig(
          apiBaseUrl: 'http://localhost:5000',
          awsRegion: '',
          cognitoUserPoolId: '',
          cognitoClientId: '',
        ),
        sessionStore: InMemoryAuthSessionStore(),
      );
}
