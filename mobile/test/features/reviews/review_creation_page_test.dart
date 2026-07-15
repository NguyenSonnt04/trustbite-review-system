import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/features/reviews/review_creation_page.dart';
import 'package:trustbite_mobile/src/features/reviews/review_submission_service.dart';

void main() {
  testWidgets('requires four ratings and a long comment', (tester) async {
    final repository = _FakeReviewRepository();
    await tester.pumpWidget(
      MaterialApp(
        home: ReviewCreationPage(
          restaurantId: 'restaurant-1',
          restaurantName: 'Quán kiểm thử',
          repository: repository,
          receiptPicker: const _FakeReceiptPicker(),
        ),
      ),
    );

    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('submit-review-button')),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.byKey(const ValueKey('submit-review-button')));
    await tester.pump();

    expect(find.text('Vui lòng chấm đủ bốn tiêu chí.'), findsOneWidget);
    expect(repository.createCalls, 0);
  });

  testWidgets('submits a reference review without a receipt', (tester) async {
    final repository = _FakeReviewRepository();
    await tester.pumpWidget(
      MaterialApp(
        home: ReviewCreationPage(
          restaurantId: 'restaurant-1',
          restaurantName: 'Quán kiểm thử',
          repository: repository,
          receiptPicker: const _FakeReceiptPicker(),
        ),
      ),
    );

    for (final label in ['Món ăn', 'Giá cả', 'Phục vụ', 'Không gian']) {
      await tester.tap(find.byKey(ValueKey('rating-$label-5')));
    }
    await tester.enterText(
      find.byKey(const ValueKey('review-comment-field')),
      'Món ăn rất ngon, phục vụ nhiệt tình và không gian sạch sẽ, đáng quay lại.',
    );
    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('submit-review-button')),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.byKey(const ValueKey('submit-review-button')));
    await tester.pumpAndSettle();

    expect(find.text('Đánh giá được công khai tham khảo'), findsOneWidget);
    expect(repository.createCalls, 1);
    expect(repository.skipCalls, 1);
    expect(repository.uploadCalls, 0);
    expect(repository.statusCalls, 1);
  });

  testWidgets('stops loading when transport throws a non-Exception error', (
    tester,
  ) async {
    final repository = _FakeReviewRepository(
      createError: ArgumentError('invalid request encoding'),
    );
    await tester.pumpWidget(
      MaterialApp(
        home: ReviewCreationPage(
          restaurantId: 'restaurant-1',
          restaurantName: 'Quán kiểm thử',
          repository: repository,
          receiptPicker: const _FakeReceiptPicker(),
        ),
      ),
    );

    for (final label in ['Món ăn', 'Giá cả', 'Phục vụ', 'Không gian']) {
      await tester.tap(find.byKey(ValueKey('rating-$label-5')));
    }
    await tester.enterText(
      find.byKey(const ValueKey('review-comment-field')),
      'Nội dung Unicode: tiếng Việt, AWS’s AI và biểu tượng 🚀 vẫn gửi được.',
    );
    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('submit-review-button')),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.byKey(const ValueKey('submit-review-button')));
    await tester.pump();

    expect(find.byKey(const ValueKey('review-form-error')), findsOneWidget);
    final button = tester.widget<FilledButton>(
      find.byKey(const ValueKey('submit-review-button')),
    );
    expect(button.onPressed, isNotNull);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });

  testWidgets('submits review, receipt, and displays backend status', (
    tester,
  ) async {
    final repository = _FakeReviewRepository();
    await tester.pumpWidget(
      MaterialApp(
        home: ReviewCreationPage(
          restaurantId: 'restaurant-1',
          restaurantName: 'Quán kiểm thử',
          repository: repository,
          receiptPicker: const _FakeReceiptPicker(),
        ),
      ),
    );

    for (final label in ['Món ăn', 'Giá cả', 'Phục vụ', 'Không gian']) {
      await tester.tap(find.byKey(ValueKey('rating-$label-5')));
    }
    await tester.enterText(
      find.byKey(const ValueKey('review-comment-field')),
      'Món ăn rất ngon, phục vụ nhiệt tình và không gian sạch sẽ, đáng quay lại.',
    );
    await tester.tap(find.byKey(const ValueKey('receipt-picker-button')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Chọn từ thư viện'));
    await tester.pumpAndSettle();

    expect(find.text('receipt.jpg'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('submit-review-button')),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.byKey(const ValueKey('submit-review-button')));
    await tester.pumpAndSettle();

    expect(find.text('Đánh giá đã được xác thực'), findsOneWidget);
    expect(repository.createCalls, 1);
    expect(repository.uploadCalls, 1);
    expect(repository.statusCalls, 1);
    expect(repository.lastIdempotencyKey, 'fixed-idempotency-key');
  });

  testWidgets('retries receipt upload with the same review and key', (
    tester,
  ) async {
    final repository = _FakeReviewRepository(failFirstUpload: true);
    await tester.pumpWidget(
      MaterialApp(
        home: ReviewCreationPage(
          restaurantId: 'restaurant-1',
          restaurantName: 'Quán kiểm thử',
          repository: repository,
          receiptPicker: const _FakeReceiptPicker(),
        ),
      ),
    );

    for (final label in ['Món ăn', 'Giá cả', 'Phục vụ', 'Không gian']) {
      await tester.tap(find.byKey(ValueKey('rating-$label-5')));
    }
    await tester.enterText(
      find.byKey(const ValueKey('review-comment-field')),
      'Món ăn rất ngon, phục vụ nhiệt tình và không gian sạch sẽ, đáng quay lại.',
    );
    await tester.tap(find.byKey(const ValueKey('receipt-picker-button')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Chọn từ thư viện'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('submit-review-button')),
      300,
      scrollable: find.byType(Scrollable).first,
    );

    await tester.tap(find.byKey(const ValueKey('submit-review-button')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('review-form-error')), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('submit-review-button')));
    await tester.pumpAndSettle();

    expect(find.text('Đánh giá đã được xác thực'), findsOneWidget);
    expect(repository.createCalls, 1);
    expect(repository.uploadCalls, 2);
    expect(repository.uploadIdempotencyKeys, [
      'fixed-idempotency-key',
      'fixed-idempotency-key',
    ]);
  });

  testWidgets('stops automatic status polling after the configured limit', (
    tester,
  ) async {
    final repository = _FakeReviewRepository(pendingStatus: true);
    await tester.pumpWidget(
      MaterialApp(
        home: ReviewCreationPage(
          restaurantId: 'restaurant-1',
          restaurantName: 'Quán kiểm thử',
          repository: repository,
          receiptPicker: const _FakeReceiptPicker(),
          pollInterval: const Duration(milliseconds: 1),
          maxPollAttempts: 2,
        ),
      ),
    );

    for (final label in ['Món ăn', 'Giá cả', 'Phục vụ', 'Không gian']) {
      await tester.tap(find.byKey(ValueKey('rating-$label-5')));
    }
    await tester.enterText(
      find.byKey(const ValueKey('review-comment-field')),
      'Món ăn rất ngon, phục vụ nhiệt tình và không gian sạch sẽ, đáng quay lại.',
    );
    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('submit-review-button')),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.byKey(const ValueKey('submit-review-button')));
    await tester.pumpAndSettle(const Duration(milliseconds: 1));

    expect(repository.statusCalls, 3);
    expect(
      find.text('Trạng thái đang được xử lý, vui lòng kiểm tra lại sau.'),
      findsOneWidget,
    );
  });
}

class _FakeReceiptPicker implements ReceiptPicker {
  const _FakeReceiptPicker();

  @override
  Future<ReceiptFileData?> pick(ReceiptSource source) async {
    return const ReceiptFileData(
      fileName: 'receipt.jpg',
      contentType: 'image/jpeg',
      bytes: [255, 216, 255, 224],
    );
  }
}

class _FakeReviewRepository implements ReviewSubmissionRepository {
  _FakeReviewRepository({
    this.failFirstUpload = false,
    this.createError,
    this.pendingStatus = false,
  });

  final bool failFirstUpload;
  final Object? createError;
  final bool pendingStatus;
  int createCalls = 0;
  int skipCalls = 0;
  int uploadCalls = 0;
  int statusCalls = 0;
  String? lastIdempotencyKey;
  final List<String> uploadIdempotencyKeys = [];

  @override
  String createIdempotencyKey() => 'fixed-idempotency-key';

  @override
  Future<void> skipReceiptVerification(String reviewId) async {
    skipCalls += 1;
  }

  @override
  Future<ReviewIntent> createReview({
    required String restaurantId,
    required int foodRating,
    required int priceRating,
    required int serviceRating,
    required int ambienceRating,
    required String comment,
    DateTime? visitedAt,
  }) async {
    createCalls += 1;
    if (createError != null) throw createError!;
    return const ReviewIntent(
      reviewId: 'review-1',
      status: 'SUBMITTED',
      nextStep: 'UPLOAD_RECEIPT',
    );
  }

  @override
  Future<ReceiptUploadResult> uploadReceipt({
    required String reviewId,
    required String restaurantId,
    required ReceiptFileData receipt,
    required String idempotencyKey,
  }) async {
    uploadCalls += 1;
    lastIdempotencyKey = idempotencyKey;
    uploadIdempotencyKeys.add(idempotencyKey);
    if (failFirstUpload && uploadCalls == 1) {
      throw Exception('temporary upload failure');
    }
    return const ReceiptUploadResult(
      receiptVerificationId: 'receipt-1',
      status: 'UPLOADED',
      processingStatus: 'HASH_CHECKING',
    );
  }

  @override
  Future<ReviewVerificationState> fetchStatus(String reviewId) async {
    statusCalls += 1;
    if (pendingStatus) {
      return const ReviewVerificationState(
        reviewId: 'review-1',
        status: 'SUBMITTED',
        verificationStatus: 'HASH_CHECKING',
        trustLabel: 'PENDING',
        publicVisibility: 'PRIVATE',
        decisionReason: null,
      );
    }
    if (skipCalls > 0) {
      return const ReviewVerificationState(
        reviewId: 'review-1',
        status: 'REFERENCE_ONLY',
        verificationStatus: 'SKIPPED',
        trustLabel: 'REFERENCE_ONLY',
        publicVisibility: 'PUBLIC',
        decisionReason: null,
      );
    }
    return const ReviewVerificationState(
      reviewId: 'review-1',
      status: 'VERIFIED',
      verificationStatus: 'VERIFIED',
      trustLabel: 'RECEIPT_VERIFIED',
      publicVisibility: 'PUBLIC',
      decisionReason: null,
    );
  }
}
