import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/core/auth/auth_session_store.dart';
import 'package:trustbite_mobile/src/core/config/mobile_runtime_config.dart';
import 'package:trustbite_mobile/src/features/auth/profile_management_service.dart';

void main() {
  const config = MobileRuntimeConfig(
    apiBaseUrl: 'http://localhost:5000',
    awsRegion: 'ap-southeast-1',
    cognitoUserPoolId: '',
    cognitoClientId: '',
  );

  test('updates the current profile with allowlisted fields', () async {
    final transport = _ProfileTransport([
      const ApiTransportResponse(
        statusCode: 200,
        body:
            '{"displayName":"Nguyen Son","phoneNumber":"+84395665937","dateOfBirth":"2004-11-20","avatarUrl":null,"profileComplete":true}',
      ),
    ]);
    final service = ProfileManagementService(
      apiClient: _client(config, transport),
    );

    final profile = await service.updateProfile(
      displayName: ' Nguyen Son ',
      phoneNumber: '0395665937',
      dateOfBirth: '2004-11-20',
    );

    expect(transport.requests.single.method, 'PATCH');
    expect(transport.requests.single.uri.path, '/api/v1/users/me');
    expect(jsonDecode(transport.requests.single.body!), {
      'displayName': 'Nguyen Son',
      'phoneNumber': '0395665937',
      'dateOfBirth': '2004-11-20',
    });
    expect(profile['displayName'], 'Nguyen Son');
  });

  test('loads backend-owned gamification progress', () async {
    final transport = _ProfileTransport([
      const ApiTransportResponse(
        statusCode: 200,
        body:
            '{"expPoints":120,"verifiedReviewCount":3,"level":{"code":"APPRENTICE","label":"Tập sự","minExp":100,"minVerifiedReviews":2},"nextLevel":{"code":"FOODIE","label":"Foodie","minExp":500,"minVerifiedReviews":10,"expToNext":380,"verifiedReviewsToNext":7},"badges":[]}',
      ),
    ]);
    final service = ProfileManagementService(
      apiClient: _client(config, transport),
    );

    final summary = await service.fetchGamification();

    expect(summary.expPoints, 120);
    expect(summary.level.code, 'APPRENTICE');
    expect(summary.nextLevel?.expToNext, 380);
  });

  test('uploads avatar bytes then persists the returned avatar URL', () async {
    final transport = _ProfileTransport([
      const ApiTransportResponse(
        statusCode: 200,
        body:
            '{"uploadUrl":"https://upload.example/avatar","avatarUrl":"https://cdn.example/avatar.webp","expiresAt":"2026-07-19T12:00:00.000Z"}',
      ),
      const ApiTransportResponse(
        statusCode: 200,
        body:
            '{"displayName":"Nguyen Son","avatarUrl":"https://cdn.example/avatar.webp","profileComplete":true}',
      ),
    ]);
    final uploader = _AvatarUploader();
    final service = ProfileManagementService(
      apiClient: _client(config, transport),
      avatarUploader: uploader,
    );

    final profile = await service.updateAvatar(
      bytes: [1, 2, 3],
      contentType: 'image/webp',
    );

    expect(uploader.uploadUrl.toString(), 'https://upload.example/avatar');
    expect(uploader.bytes, [1, 2, 3]);
    expect(uploader.contentType, 'image/webp');
    expect(jsonDecode(transport.requests.last.body!), {
      'avatarUrl': 'https://cdn.example/avatar.webp',
    });
    expect(profile['avatarUrl'], 'https://cdn.example/avatar.webp');
  });

  test(
    'submits report and review-author block without exposing a user id',
    () async {
      final transport = _ProfileTransport([
        const ApiTransportResponse(
          statusCode: 201,
          body: '{"reportId":"report-id","status":"SUBMITTED"}',
        ),
        const ApiTransportResponse(
          statusCode: 201,
          body: '{"success":true,"blockedAt":"2026-07-19T10:00:00.000Z"}',
        ),
      ]);
      final service = ProfileManagementService(
        apiClient: _client(config, transport),
      );

      await service.submitReport(
        entityType: ReportEntityType.review,
        entityId: 'review-id',
        reasonCode: 'SPAM_OR_FAKE',
        description: 'Nội dung lặp lại',
      );
      await service.blockReviewAuthor('review-id');

      expect(
        jsonDecode(transport.requests.first.body!),
        containsPair('entityType', 'REVIEW'),
      );
      expect(
        transport.requests.last.uri.path,
        '/api/v1/reviews/review-id/block-author',
      );
    },
  );

  test('treats an already-blocked review author as blocked', () async {
    final transport = _ProfileTransport([
      const ApiTransportResponse(
        statusCode: 409,
        body:
            '{"error":{"code":"USER_ALREADY_BLOCKED","message":"User is already blocked"}}',
      ),
    ]);
    final service = ProfileManagementService(
      apiClient: _client(config, transport),
    );

    await expectLater(service.blockReviewAuthor('review-id'), completes);
  });

  test('creates and cancels an account deletion request', () async {
    final transport = _ProfileTransport([
      const ApiTransportResponse(
        statusCode: 202,
        body:
            '{"deletionRequestId":"request-id","status":"REQUESTED","requestedAt":"2026-07-19T10:00:00.000Z","scheduledDeletionAt":"2026-08-18T10:00:00.000Z"}',
      ),
      const ApiTransportResponse(
        statusCode: 200,
        body:
            '{"deletionRequestId":"request-id","status":"CANCELLED","requestedAt":"2026-07-19T10:00:00.000Z","cancelledAt":"2026-07-19T11:00:00.000Z"}',
      ),
    ]);
    final service = ProfileManagementService(
      apiClient: _client(config, transport),
    );

    final created = await service.requestAccountDeletion(reason: 'Không dùng');
    final cancelled = await service.cancelAccountDeletion();

    expect(created.status, 'REQUESTED');
    expect(jsonDecode(transport.requests.first.body!), {
      'confirmationText': 'XÓA TÀI KHOẢN',
      'reason': 'Không dùng',
    });
    expect(cancelled.status, 'CANCELLED');
  });
}

TrustBiteApiClient _client(MobileRuntimeConfig config, ApiTransport transport) {
  return TrustBiteApiClient(
    config: config,
    sessionStore: InMemoryAuthSessionStore(),
    transport: transport,
  );
}

class _ProfileTransport implements ApiTransport {
  _ProfileTransport(this.responses);

  final List<ApiTransportResponse> responses;
  final List<ApiTransportRequest> requests = [];

  @override
  Future<ApiTransportResponse> send(ApiTransportRequest request) async {
    requests.add(request);
    return responses.removeAt(0);
  }
}

class _AvatarUploader implements AvatarBinaryUploader {
  Uri? uploadUrl;
  List<int>? bytes;
  String? contentType;

  @override
  Future<void> upload({
    required Uri uploadUrl,
    required List<int> bytes,
    required String contentType,
  }) async {
    this.uploadUrl = uploadUrl;
    this.bytes = bytes;
    this.contentType = contentType;
  }
}
