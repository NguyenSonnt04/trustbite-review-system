import 'dart:math';

import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';

class ReceiptFileData {
  const ReceiptFileData({
    required this.fileName,
    required this.contentType,
    required this.bytes,
  });

  final String fileName;
  final String contentType;
  final List<int> bytes;
}

class ReviewIntent {
  const ReviewIntent({
    required this.reviewId,
    required this.status,
    required this.nextStep,
  });

  final String reviewId;
  final String status;
  final String nextStep;
}

class ReceiptUploadResult {
  const ReceiptUploadResult({
    required this.receiptVerificationId,
    required this.status,
    required this.processingStatus,
  });

  final String receiptVerificationId;
  final String status;
  final String processingStatus;
}

class ReviewVerificationState {
  const ReviewVerificationState({
    required this.reviewId,
    required this.status,
    required this.verificationStatus,
    required this.trustLabel,
    required this.publicVisibility,
    required this.decisionReason,
  });

  final String reviewId;
  final String status;
  final String verificationStatus;
  final String trustLabel;
  final String publicVisibility;
  final String? decisionReason;

  bool get isTerminal => {
    'VERIFIED',
    'REFERENCE_ONLY',
    'SKIPPED',
    'REJECTED',
    'DUPLICATE_REJECTED',
    'PENDING_ADMIN_REVIEW',
  }.contains(verificationStatus);
}

abstract interface class ReviewSubmissionRepository {
  String createIdempotencyKey();

  Future<ReviewIntent> createReview({
    required String restaurantId,
    required int foodRating,
    required int priceRating,
    required int serviceRating,
    required int ambienceRating,
    required String comment,
    DateTime? visitedAt,
  });

  Future<ReceiptUploadResult> uploadReceipt({
    required String reviewId,
    required String restaurantId,
    required ReceiptFileData receipt,
    required String idempotencyKey,
  });

  Future<void> skipReceiptVerification(String reviewId);

  Future<ReviewVerificationState> fetchStatus(String reviewId);
}

class ReviewSubmissionService implements ReviewSubmissionRepository {
  ReviewSubmissionService({
    required TrustBiteApiClient apiClient,
    String Function()? idempotencyKeyFactory,
  }) : _apiClient = apiClient,
       _idempotencyKeyFactory = idempotencyKeyFactory ?? _generateUuidV4;

  final TrustBiteApiClient _apiClient;
  final String Function() _idempotencyKeyFactory;

  @override
  String createIdempotencyKey() => _idempotencyKeyFactory();

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
    final normalizedComment = comment.trim();
    if (normalizedComment.length < 50) {
      throw const FormatException(
        'Nội dung đánh giá phải có ít nhất 50 ký tự.',
      );
    }
    for (final rating in [
      foodRating,
      priceRating,
      serviceRating,
      ambienceRating,
    ]) {
      if (rating < 1 || rating > 5) {
        throw const FormatException('Điểm đánh giá phải từ 1 đến 5.');
      }
    }

    final response = await _apiClient.postJson('/reviews', {
      'restaurantId': restaurantId,
      'foodRating': foodRating,
      'priceRating': priceRating,
      'serviceRating': serviceRating,
      'ambienceRating': ambienceRating,
      'comment': normalizedComment,
      if (visitedAt != null) 'visitedAt': visitedAt.toUtc().toIso8601String(),
    });

    return ReviewIntent(
      reviewId: _requiredString(response['reviewId'], 'reviewId'),
      status: _requiredString(response['status'], 'status'),
      nextStep: _requiredString(response['nextStep'], 'nextStep'),
    );
  }

  @override
  Future<ReceiptUploadResult> uploadReceipt({
    required String reviewId,
    required String restaurantId,
    required ReceiptFileData receipt,
    required String idempotencyKey,
  }) async {
    if (receipt.bytes.isEmpty) {
      throw const FormatException('Hóa đơn không được để trống.');
    }
    if (receipt.bytes.length > 10 * 1024 * 1024) {
      throw const FormatException('Hóa đơn không được vượt quá 10 MB.');
    }
    if (!const {
      'image/jpeg',
      'image/png',
      'image/heic',
      'image/heif',
    }.contains(receipt.contentType)) {
      throw const FormatException('Định dạng hóa đơn không được hỗ trợ.');
    }

    final response = await _apiClient.postMultipart(
      '/receipts',
      fields: {'reviewId': reviewId, 'restaurantId': restaurantId},
      file: ApiMultipartFile(
        fieldName: 'receiptImage',
        fileName: receipt.fileName,
        contentType: receipt.contentType,
        bytes: receipt.bytes,
      ),
      headers: {'Idempotency-Key': idempotencyKey},
    );

    return ReceiptUploadResult(
      receiptVerificationId: _requiredString(
        response['receiptVerificationId'],
        'receiptVerificationId',
      ),
      status: _requiredString(response['status'], 'status'),
      processingStatus: _requiredString(
        response['processingStatus'],
        'processingStatus',
      ),
    );
  }

  @override
  Future<void> skipReceiptVerification(String reviewId) async {
    await _apiClient.postJson('/reviews/$reviewId/skip-verification', {
      'reason': 'USER_SKIPPED_RECEIPT',
    });
  }

  @override
  Future<ReviewVerificationState> fetchStatus(String reviewId) async {
    final response = await _apiClient.getJson('/reviews/$reviewId/status');
    final receipt = response['receipt'];
    final receiptMap = receipt is Map<String, dynamic> ? receipt : null;

    return ReviewVerificationState(
      reviewId: _requiredString(response['reviewId'], 'reviewId'),
      status: _requiredString(response['status'], 'status'),
      verificationStatus: _requiredString(
        response['verificationStatus'],
        'verificationStatus',
      ),
      trustLabel: _requiredString(response['trustLabel'], 'trustLabel'),
      publicVisibility: _requiredString(
        response['publicVisibility'],
        'publicVisibility',
      ),
      decisionReason: _optionalString(receiptMap?['decisionReason']),
    );
  }

  static String _requiredString(Object? value, String field) {
    final normalized = _optionalString(value);
    if (normalized == null) {
      throw FormatException('$field is required.');
    }
    return normalized;
  }

  static String? _optionalString(Object? value) {
    if (value == null) return null;
    if (value is! String) {
      throw const FormatException('Backend text field is invalid.');
    }
    final normalized = value.trim();
    return normalized.isEmpty ? null : normalized;
  }

  static String _generateUuidV4() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes
        .map((byte) => byte.toRadixString(16).padLeft(2, '0'))
        .join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
        '${hex.substring(12, 16)}-${hex.substring(16, 20)}-'
        '${hex.substring(20)}';
  }
}
