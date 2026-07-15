import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/core/auth/auth_session_store.dart';
import 'package:trustbite_mobile/src/core/config/mobile_runtime_config.dart';
import 'package:trustbite_mobile/src/features/home/models/home_models.dart';
import 'package:trustbite_mobile/src/features/reviews/review_reaction_service.dart';

void main() {
  const config = MobileRuntimeConfig(
    apiBaseUrl: 'http://localhost:5000',
    awsRegion: 'ap-southeast-1',
    cognitoUserPoolId: '',
    cognitoClientId: '',
  );
  const reviewId = '11111111-1111-4111-8111-111111111111';

  test('sets an authenticated review reaction with the backend enum', () async {
    final transport = _ReactionTransport([
      const ApiTransportResponse(
        statusCode: 200,
        body:
            '{"reviewId":"11111111-1111-4111-8111-111111111111","myReaction":"HAHA","reactionCounts":{"LOVE":2,"HAHA":3,"ANGRY":1}}',
      ),
    ]);
    final service = ReviewReactionService(
      apiClient: TrustBiteApiClient(
        config: config,
        sessionStore: InMemoryAuthSessionStore(),
        transport: transport,
      ),
    );

    final result = await service.setReaction(
      reviewId: reviewId,
      reaction: ReviewReactionType.haha,
    );

    expect(transport.requests.single.method, 'PUT');
    expect(
      transport.requests.single.uri.path,
      '/api/v1/reviews/$reviewId/reaction',
    );
    expect(jsonDecode(transport.requests.single.body!), {
      'reactionType': 'HAHA',
    });
    expect(result.myReaction, ReviewReactionType.haha);
    expect(result.reactionCounts.haha, 3);
  });

  test('removes only the current authenticated user reaction', () async {
    final transport = _ReactionTransport([
      const ApiTransportResponse(
        statusCode: 200,
        body:
            '{"reviewId":"11111111-1111-4111-8111-111111111111","myReaction":null,"reactionCounts":{"LOVE":0,"HAHA":0,"ANGRY":0}}',
      ),
    ]);
    final service = ReviewReactionService(
      apiClient: TrustBiteApiClient(
        config: config,
        sessionStore: InMemoryAuthSessionStore(),
        transport: transport,
      ),
    );

    final result = await service.removeReaction(reviewId);

    expect(transport.requests.single.method, 'DELETE');
    expect(transport.requests.single.body, isNull);
    expect(result.myReaction, isNull);
  });
}

class _ReactionTransport implements ApiTransport {
  _ReactionTransport(this.responses);

  final List<ApiTransportResponse> responses;
  final List<ApiTransportRequest> requests = [];

  @override
  Future<ApiTransportResponse> send(ApiTransportRequest request) async {
    requests.add(request);
    return responses.removeAt(0);
  }
}
