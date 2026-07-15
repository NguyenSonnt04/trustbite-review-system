import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/features/home/models/home_models.dart';

class ReviewReactionResult {
  const ReviewReactionResult({
    required this.reviewId,
    required this.myReaction,
    required this.reactionCounts,
  });

  final String reviewId;
  final ReviewReactionType? myReaction;
  final ReviewReactionCounts reactionCounts;
}

abstract interface class ReviewReactionRepository {
  Future<ReviewReactionResult> setReaction({
    required String reviewId,
    required ReviewReactionType reaction,
  });

  Future<ReviewReactionResult> removeReaction(String reviewId);
}

class ReviewReactionService implements ReviewReactionRepository {
  ReviewReactionService({required TrustBiteApiClient apiClient})
    : _apiClient = apiClient;

  final TrustBiteApiClient _apiClient;

  @override
  Future<ReviewReactionResult> setReaction({
    required String reviewId,
    required ReviewReactionType reaction,
  }) async {
    final response = await _apiClient.putJson('/reviews/$reviewId/reaction', {
      'reactionType': reaction.apiValue,
    });
    return _parseResult(response);
  }

  @override
  Future<ReviewReactionResult> removeReaction(String reviewId) async {
    final response = await _apiClient.deleteJson('/reviews/$reviewId/reaction');
    return _parseResult(response);
  }

  ReviewReactionResult _parseResult(Map<String, dynamic> response) {
    final reviewId = _requiredString(response['reviewId'], 'reviewId');
    final myReactionValue = response['myReaction'];
    final myReaction = myReactionValue == null
        ? null
        : ReviewReactionType.values
              .where((type) => type.apiValue == myReactionValue)
              .firstOrNull;
    if (myReactionValue != null && myReaction == null) {
      throw const FormatException('Backend reaction type is invalid.');
    }

    final counts = response['reactionCounts'];
    if (counts is! Map<String, dynamic>) {
      throw const FormatException('Backend reaction counts are invalid.');
    }
    return ReviewReactionResult(
      reviewId: reviewId,
      myReaction: myReaction,
      reactionCounts: ReviewReactionCounts(
        love: _requiredCount(counts['LOVE'], 'LOVE'),
        haha: _requiredCount(counts['HAHA'], 'HAHA'),
        angry: _requiredCount(counts['ANGRY'], 'ANGRY'),
      ),
    );
  }

  String _requiredString(Object? value, String field) {
    if (value is! String || value.trim().isEmpty) {
      throw FormatException('$field is required.');
    }
    return value.trim();
  }

  int _requiredCount(Object? value, String field) {
    if (value is! int || value < 0) {
      throw FormatException('$field reaction count is invalid.');
    }
    return value;
  }
}
