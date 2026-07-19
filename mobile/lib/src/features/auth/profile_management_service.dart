import 'dart:io';

import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';

enum ReportEntityType {
  review('REVIEW'),
  restaurant('RESTAURANT');

  const ReportEntityType(this.apiValue);

  final String apiValue;
}

class GamificationLevel {
  const GamificationLevel({
    required this.code,
    required this.label,
    required this.minExp,
    required this.minVerifiedReviews,
  });

  final String code;
  final String label;
  final int minExp;
  final int minVerifiedReviews;
}

class GamificationNextLevel extends GamificationLevel {
  const GamificationNextLevel({
    required super.code,
    required super.label,
    required super.minExp,
    required super.minVerifiedReviews,
    required this.expToNext,
    required this.verifiedReviewsToNext,
  });

  final int expToNext;
  final int verifiedReviewsToNext;
}

class GamificationBadge {
  const GamificationBadge({
    required this.code,
    required this.label,
    required this.iconUrl,
    required this.category,
    required this.awardedAt,
  });

  final String code;
  final String label;
  final String? iconUrl;
  final String? category;
  final DateTime awardedAt;
}

class GamificationSummary {
  const GamificationSummary({
    required this.expPoints,
    required this.verifiedReviewCount,
    required this.level,
    required this.nextLevel,
    required this.badges,
  });

  final int expPoints;
  final int verifiedReviewCount;
  final GamificationLevel level;
  final GamificationNextLevel? nextLevel;
  final List<GamificationBadge> badges;
}

class AccountDeletionRequest {
  const AccountDeletionRequest({
    required this.id,
    required this.status,
    required this.requestedAt,
    required this.scheduledDeletionAt,
    required this.cancelledAt,
  });

  final String id;
  final String status;
  final DateTime requestedAt;
  final DateTime? scheduledDeletionAt;
  final DateTime? cancelledAt;
}

abstract interface class AvatarBinaryUploader {
  Future<void> upload({
    required Uri uploadUrl,
    required List<int> bytes,
    required String contentType,
  });
}

class HttpAvatarBinaryUploader implements AvatarBinaryUploader {
  HttpAvatarBinaryUploader({HttpClient? httpClient}) : _httpClient = httpClient;

  final HttpClient? _httpClient;

  @override
  Future<void> upload({
    required Uri uploadUrl,
    required List<int> bytes,
    required String contentType,
  }) async {
    final httpClient = _httpClient ?? HttpClient();
    try {
      final request = await httpClient.putUrl(uploadUrl);
      request.headers.contentType = ContentType.parse(contentType);
      request.headers.contentLength = bytes.length;
      request.add(bytes);
      final response = await request.close();
      await response.drain<void>();
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw ApiException(
          response.statusCode,
          'Không thể tải ảnh đại diện lên kho lưu trữ.',
        );
      }
    } finally {
      if (_httpClient == null) httpClient.close(force: true);
    }
  }
}

abstract interface class ProfileManagementRepository {
  Future<Map<String, dynamic>> updateProfile({
    required String displayName,
    required String phoneNumber,
    required String dateOfBirth,
  });

  Future<Map<String, dynamic>> updateAvatar({
    required List<int> bytes,
    required String contentType,
  });

  Future<GamificationSummary> fetchGamification();

  Future<void> submitReport({
    required ReportEntityType entityType,
    required String entityId,
    required String reasonCode,
    String? description,
  });

  Future<void> blockReviewAuthor(String reviewId);

  Future<void> unblockReviewAuthor(String reviewId);

  Future<AccountDeletionRequest?> fetchAccountDeletionRequest();

  Future<AccountDeletionRequest> requestAccountDeletion({String? reason});

  Future<AccountDeletionRequest> cancelAccountDeletion();
}

class ProfileManagementService implements ProfileManagementRepository {
  ProfileManagementService({
    required TrustBiteApiClient apiClient,
    AvatarBinaryUploader? avatarUploader,
  }) : _apiClient = apiClient,
       _avatarUploader = avatarUploader ?? HttpAvatarBinaryUploader();

  final TrustBiteApiClient _apiClient;
  final AvatarBinaryUploader _avatarUploader;

  @override
  Future<Map<String, dynamic>> updateProfile({
    required String displayName,
    required String phoneNumber,
    required String dateOfBirth,
  }) {
    return _apiClient.patchJson('/users/me', {
      'displayName': displayName.trim(),
      'phoneNumber': phoneNumber.trim(),
      'dateOfBirth': dateOfBirth,
    });
  }

  @override
  Future<Map<String, dynamic>> updateAvatar({
    required List<int> bytes,
    required String contentType,
  }) async {
    if (bytes.isEmpty) {
      throw ArgumentError.value(bytes, 'bytes', 'must not be empty');
    }
    final upload = await _apiClient.postJson('/users/me/avatar-upload-url', {
      'contentType': contentType,
      'fileSizeBytes': bytes.length,
    });
    final uploadUrl = Uri.tryParse(_requiredString(upload['uploadUrl']));
    final avatarUrl = _requiredString(upload['avatarUrl']);
    if (uploadUrl == null || !uploadUrl.hasScheme) {
      throw const FormatException('Avatar upload URL is invalid.');
    }
    await _avatarUploader.upload(
      uploadUrl: uploadUrl,
      bytes: bytes,
      contentType: contentType,
    );
    return _apiClient.patchJson('/users/me', {'avatarUrl': avatarUrl});
  }

  @override
  Future<GamificationSummary> fetchGamification() async {
    final response = await _apiClient.getJson('/users/me/gamification');
    final level = _requiredMap(response['level'], 'level');
    final nextLevelValue = response['nextLevel'];
    final badges = response['badges'];
    if (badges is! List) {
      throw const FormatException('Gamification badges must be an array.');
    }
    return GamificationSummary(
      expPoints: _requiredInt(response['expPoints'], 'expPoints'),
      verifiedReviewCount: _requiredInt(
        response['verifiedReviewCount'],
        'verifiedReviewCount',
      ),
      level: _parseLevel(level),
      nextLevel: nextLevelValue == null
          ? null
          : _parseNextLevel(_requiredMap(nextLevelValue, 'nextLevel')),
      badges: badges.map(_parseBadge).toList(growable: false),
    );
  }

  @override
  Future<void> submitReport({
    required ReportEntityType entityType,
    required String entityId,
    required String reasonCode,
    String? description,
  }) async {
    await _apiClient.postJson('/moderation/reports', {
      'entityType': entityType.apiValue,
      'entityId': entityId.trim(),
      'reasonCode': reasonCode.trim(),
      if (description != null && description.trim().isNotEmpty)
        'description': description.trim(),
    });
  }

  @override
  Future<void> blockReviewAuthor(String reviewId) async {
    try {
      await _apiClient.postJson(
        '/reviews/${reviewId.trim()}/block-author',
        const {},
      );
    } on ApiException catch (error) {
      if (error.statusCode != HttpStatus.conflict) rethrow;
    }
  }

  @override
  Future<void> unblockReviewAuthor(String reviewId) async {
    await _apiClient.deleteJson('/reviews/${reviewId.trim()}/block-author');
  }

  @override
  Future<AccountDeletionRequest?> fetchAccountDeletionRequest() async {
    try {
      final response = await _apiClient.getJson('/users/me/deletion-request');
      return _parseDeletionRequest(response);
    } on ApiException catch (error) {
      if (error.statusCode == HttpStatus.notFound) return null;
      rethrow;
    }
  }

  @override
  Future<AccountDeletionRequest> requestAccountDeletion({
    String? reason,
  }) async {
    final response = await _apiClient.postJson('/users/me/deletion-request', {
      'confirmationText': 'XÓA TÀI KHOẢN',
      if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
    });
    return _parseDeletionRequest(response);
  }

  @override
  Future<AccountDeletionRequest> cancelAccountDeletion() async {
    final response = await _apiClient.postJson(
      '/users/me/deletion-request/cancel',
      const {},
    );
    return _parseDeletionRequest(response);
  }

  GamificationLevel _parseLevel(Map<String, dynamic> value) {
    return GamificationLevel(
      code: _requiredString(value['code']),
      label: _requiredString(value['label']),
      minExp: _requiredInt(value['minExp'], 'minExp'),
      minVerifiedReviews: _requiredInt(
        value['minVerifiedReviews'],
        'minVerifiedReviews',
      ),
    );
  }

  GamificationNextLevel _parseNextLevel(Map<String, dynamic> value) {
    return GamificationNextLevel(
      code: _requiredString(value['code']),
      label: _requiredString(value['label']),
      minExp: _requiredInt(value['minExp'], 'minExp'),
      minVerifiedReviews: _requiredInt(
        value['minVerifiedReviews'],
        'minVerifiedReviews',
      ),
      expToNext: _requiredInt(value['expToNext'], 'expToNext'),
      verifiedReviewsToNext: _requiredInt(
        value['verifiedReviewsToNext'],
        'verifiedReviewsToNext',
      ),
    );
  }

  GamificationBadge _parseBadge(Object? value) {
    final badge = _requiredMap(value, 'badge');
    return GamificationBadge(
      code: _requiredString(badge['code']),
      label: _requiredString(badge['label']),
      iconUrl: _optionalString(badge['iconUrl']),
      category: _optionalString(badge['category']),
      awardedAt: _requiredDate(badge['awardedAt'], 'awardedAt'),
    );
  }

  AccountDeletionRequest _parseDeletionRequest(Map<String, dynamic> value) {
    return AccountDeletionRequest(
      id: _requiredString(value['deletionRequestId']),
      status: _requiredString(value['status']),
      requestedAt: _requiredDate(value['requestedAt'], 'requestedAt'),
      scheduledDeletionAt: _optionalDate(
        value['scheduledDeletionAt'],
        'scheduledDeletionAt',
      ),
      cancelledAt: _optionalDate(value['cancelledAt'], 'cancelledAt'),
    );
  }

  Map<String, dynamic> _requiredMap(Object? value, String field) {
    if (value is Map<String, dynamic>) return value;
    throw FormatException('$field must be an object.');
  }

  String _requiredString(Object? value) {
    final result = _optionalString(value);
    if (result == null) {
      throw const FormatException('Required text is missing.');
    }
    return result;
  }

  String? _optionalString(Object? value) {
    if (value == null) return null;
    if (value is! String) throw const FormatException('Text is invalid.');
    final text = value.trim();
    return text.isEmpty ? null : text;
  }

  int _requiredInt(Object? value, String field) {
    if (value is int) return value;
    if (value is num && value == value.roundToDouble()) return value.toInt();
    throw FormatException('$field must be an integer.');
  }

  DateTime _requiredDate(Object? value, String field) {
    final result = _optionalDate(value, field);
    if (result == null) throw FormatException('$field is required.');
    return result;
  }

  DateTime? _optionalDate(Object? value, String field) {
    if (value == null) return null;
    final raw = _requiredString(value);
    final parsed = DateTime.tryParse(raw);
    if (parsed == null) throw FormatException('$field is invalid.');
    return parsed.toUtc();
  }
}
