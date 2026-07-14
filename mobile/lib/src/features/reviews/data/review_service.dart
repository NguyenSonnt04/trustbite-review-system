import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:uuid/uuid.dart';

class RestaurantSummary {
  const RestaurantSummary({
    required this.id,
    required this.name,
    required this.address,
    required this.trustScore,
    required this.canVerifyLocation,
  });

  final String id;
  final String name;
  final String address;
  final double? trustScore;
  final bool canVerifyLocation;

  factory RestaurantSummary.fromJson(Map<String, dynamic> json) {
    return RestaurantSummary(
      id: json['id'] as String,
      name: json['name'] as String? ?? 'Quán ăn',
      address: json['address'] as String? ?? 'Chưa có địa chỉ',
      trustScore: (json['trustScore'] as num?)?.toDouble(),
      canVerifyLocation: json['latitude'] is num && json['longitude'] is num,
    );
  }
}

class ReviewLocation {
  const ReviewLocation({
    required this.latitude,
    required this.longitude,
    required this.accuracyMeters,
  });

  final double latitude;
  final double longitude;
  final double accuracyMeters;
}

class ReviewService {
  ReviewService({required TrustBiteApiClient apiClient, Uuid? uuid})
    : _apiClient = apiClient,
      _uuid = uuid ?? const Uuid();

  final TrustBiteApiClient _apiClient;
  final Uuid _uuid;

  String createIdempotencyKey() => _uuid.v4();

  Future<List<RestaurantSummary>> listRestaurants() async {
    final response = await _apiClient.getJson('/restaurants', {
      'status': 'ACTIVE',
      'sort': 'trustScoreDesc',
      'pageSize': '20',
    });
    final items = response['items'];
    if (items is! List) return const [];
    return items
        .whereType<Map<String, dynamic>>()
        .map(RestaurantSummary.fromJson)
        .toList(growable: false);
  }

  Future<String> createReview({
    required String restaurantId,
    required int foodRating,
    required int priceRating,
    required int serviceRating,
    required int ambienceRating,
    required String comment,
  }) async {
    final response = await _apiClient.postJson('/reviews', {
      'restaurantId': restaurantId,
      'foodRating': foodRating,
      'priceRating': priceRating,
      'serviceRating': serviceRating,
      'ambienceRating': ambienceRating,
      'comment': comment.trim(),
      'visitedAt': DateTime.now().toUtc().toIso8601String(),
    });
    return response['reviewId'] as String;
  }

  Future<Map<String, dynamic>> uploadReceipt({
    required String reviewId,
    required String restaurantId,
    required String receiptPath,
    required ReviewLocation location,
    required String idempotencyKey,
  }) {
    return _apiClient.postMultipart(
      path: '/receipts',
      fields: {
        'reviewId': reviewId,
        'restaurantId': restaurantId,
        'latitude': location.latitude.toString(),
        'longitude': location.longitude.toString(),
        'gpsAccuracyMeters': location.accuracyMeters.toString(),
      },
      fileField: 'receiptImage',
      filePath: receiptPath,
      idempotencyKey: idempotencyKey,
    );
  }

  Future<Map<String, dynamic>> getReviewStatus(String reviewId) {
    return _apiClient.getJson('/reviews/$reviewId/status');
  }
}
