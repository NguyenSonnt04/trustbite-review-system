import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/core/auth/auth_session_store.dart';
import 'package:trustbite_mobile/src/core/config/mobile_runtime_config.dart';
import 'package:trustbite_mobile/src/features/reviews/review_submission_service.dart';

void main() {
  const config = MobileRuntimeConfig(
    apiBaseUrl: 'http://localhost:5000',
    awsRegion: 'ap-southeast-1',
    cognitoUserPoolId: '',
    cognitoClientId: '',
  );

  test('creates a private review intent with the backend contract', () async {
    final transport = _SequencedTransport([
      const ApiTransportResponse(
        statusCode: 201,
        body:
            '{"reviewId":"11111111-1111-4111-8111-111111111111","status":"SUBMITTED","nextStep":"UPLOAD_RECEIPT"}',
      ),
    ]);
    final service = ReviewSubmissionService(
      apiClient: TrustBiteApiClient(
        config: config,
        sessionStore: InMemoryAuthSessionStore(),
        transport: transport,
      ),
      idempotencyKeyFactory: () => '22222222-2222-4222-8222-222222222222',
    );

    final intent = await service.createReview(
      restaurantId: '33333333-3333-4333-8333-333333333333',
      foodRating: 5,
      priceRating: 4,
      serviceRating: 5,
      ambienceRating: 4,
      comment:
          'Món ăn ngon, phục vụ nhanh và không gian sạch sẽ, mình sẽ quay lại.',
    );

    final request = transport.requests.single;
    expect(request.method, 'POST');
    expect(request.uri.path, '/api/v1/reviews');
    expect(jsonDecode(request.body!), {
      'restaurantId': '33333333-3333-4333-8333-333333333333',
      'foodRating': 5,
      'priceRating': 4,
      'serviceRating': 5,
      'ambienceRating': 4,
      'comment':
          'Món ăn ngon, phục vụ nhanh và không gian sạch sẽ, mình sẽ quay lại.',
    });
    expect(intent.nextStep, 'UPLOAD_RECEIPT');
  });

  test('uploads receipt multipart with a stable idempotency key', () async {
    final transport = _SequencedTransport([
      const ApiTransportResponse(
        statusCode: 202,
        body:
            '{"receiptVerificationId":"44444444-4444-4444-8444-444444444444","status":"UPLOADED","processingStatus":"HASH_CHECKING"}',
      ),
    ]);
    final service = ReviewSubmissionService(
      apiClient: TrustBiteApiClient(
        config: config,
        sessionStore: InMemoryAuthSessionStore(),
        transport: transport,
      ),
      idempotencyKeyFactory: () => '22222222-2222-4222-8222-222222222222',
    );

    await service.uploadReceipt(
      reviewId: '11111111-1111-4111-8111-111111111111',
      restaurantId: '33333333-3333-4333-8333-333333333333',
      receipt: const ReceiptFileData(
        fileName: 'receipt"\r\nX-Injected: yes.jpg',
        contentType: 'image/jpeg',
        bytes: [255, 216, 255, 224, 1, 2, 3],
      ),
      idempotencyKey: service.createIdempotencyKey(),
    );

    final request = transport.requests.single;
    expect(
      request.headers['Idempotency-Key'],
      '22222222-2222-4222-8222-222222222222',
    );
    expect(request.headers['Content-Type'], startsWith('multipart/form-data'));
    final body = utf8.decode(request.bodyBytes!, allowMalformed: true);
    expect(body, contains('name="reviewId"'));
    expect(body, contains('11111111-1111-4111-8111-111111111111'));
    expect(body, contains('name="restaurantId"'));
    expect(
      body,
      contains('name="receiptImage"; filename="receipt___X-Injected: yes.jpg"'),
    );
    expect(body, isNot(contains('\r\nX-Injected:')));
  });

  test('skips receipt verification for a reference-only review', () async {
    final transport = _SequencedTransport([
      const ApiTransportResponse(
        statusCode: 200,
        body:
            '{"reviewId":"11111111-1111-4111-8111-111111111111","status":"REFERENCE_ONLY","verificationStatus":"SKIPPED","trustLabel":"REFERENCE_ONLY","publicVisibility":"PUBLIC","trustWeightBucket":"LOW"}',
      ),
    ]);
    final service = ReviewSubmissionService(
      apiClient: TrustBiteApiClient(
        config: config,
        sessionStore: InMemoryAuthSessionStore(),
        transport: transport,
      ),
    );

    await service.skipReceiptVerification(
      '11111111-1111-4111-8111-111111111111',
    );

    final request = transport.requests.single;
    expect(request.method, 'POST');
    expect(
      request.uri.path,
      '/api/v1/reviews/11111111-1111-4111-8111-111111111111/skip-verification',
    );
    expect(jsonDecode(request.body!), {'reason': 'USER_SKIPPED_RECEIPT'});
  });

  test('loads owner-scoped verification status', () async {
    final transport = _SequencedTransport([
      const ApiTransportResponse(
        statusCode: 200,
        body:
            '{"reviewId":"11111111-1111-4111-8111-111111111111","restaurantId":"33333333-3333-4333-8333-333333333333","branchId":null,"status":"SUBMITTED","verificationStatus":"PROCESSING","trustLabel":"PROCESSING","publicVisibility":"PRIVATE_UNTIL_DECISION","trustWeightBucket":"NONE","visitedAt":null,"createdAt":"2026-07-16T00:00:00.000Z","updatedAt":"2026-07-16T00:00:00.000Z","receipt":{"receiptVerificationId":"44444444-4444-4444-8444-444444444444","status":"PROCESSING","decision":null,"decisionReason":null,"capturedAt":null,"decidedAt":null,"createdAt":"2026-07-16T00:00:00.000Z","updatedAt":"2026-07-16T00:00:00.000Z"}}',
      ),
    ]);
    final service = ReviewSubmissionService(
      apiClient: TrustBiteApiClient(
        config: config,
        sessionStore: InMemoryAuthSessionStore(),
        transport: transport,
      ),
    );

    final status = await service.fetchStatus(
      '11111111-1111-4111-8111-111111111111',
    );

    expect(transport.requests.single.method, 'GET');
    expect(
      transport.requests.single.uri.path,
      '/api/v1/reviews/11111111-1111-4111-8111-111111111111/status',
    );
    expect(status.verificationStatus, 'PROCESSING');
    expect(status.isTerminal, isFalse);
  });
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
