import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/features/home/models/home_models.dart';

abstract interface class RestaurantDiscoveryRepository {
  Future<List<HomeRestaurant>> fetchRestaurants();

  Future<HomeRestaurantDetail> fetchRestaurantDetail(String restaurantId);

  Future<List<HomeMenuItem>> fetchRestaurantMenu(String restaurantId);

  Future<HomeRestaurantReviewPage> fetchRestaurantReviews(String restaurantId);
}

class RestaurantDiscoveryService implements RestaurantDiscoveryRepository {
  const RestaurantDiscoveryService({required TrustBiteApiClient apiClient})
    : _apiClient = apiClient;

  final TrustBiteApiClient _apiClient;

  @override
  Future<List<HomeRestaurant>> fetchRestaurants() async {
    final response = await _apiClient.getJson('/restaurants', {
      'sort': 'trustScoreDesc',
      'pageSize': '10',
    });
    final items = response['items'];
    if (items is! List) {
      throw const FormatException('Restaurant list items must be an array.');
    }

    return items.map(_parseRestaurant).toList(growable: false);
  }

  @override
  Future<HomeRestaurantDetail> fetchRestaurantDetail(
    String restaurantId,
  ) async {
    final normalizedId = restaurantId.trim();
    if (normalizedId.isEmpty) {
      throw const FormatException('Restaurant id is required.');
    }

    final response = await _apiClient.getJson('/restaurants/$normalizedId');
    final id = response['id'];
    final name = response['name'];
    final ratingBreakdown = response['ratingBreakdown'];
    if (id is! String || id.trim().isEmpty) {
      throw const FormatException('Restaurant detail id is required.');
    }
    if (name is! String || name.trim().isEmpty) {
      throw const FormatException('Restaurant detail name is required.');
    }
    if (ratingBreakdown is! Map<String, dynamic>) {
      throw const FormatException(
        'Restaurant rating breakdown must be an object.',
      );
    }

    return HomeRestaurantDetail(
      id: id.trim(),
      name: name.trim(),
      description: _readOptionalString(response['description']),
      address: _readOptionalString(response['address']),
      phoneNumber: _readOptionalString(response['phoneNumber']),
      imageUrl: _readOptionalString(response['primaryImageUrl']),
      trustScore: _readNumber(response['trustScore'])?.toDouble(),
      verifiedReviewCount: _readInteger(response['verifiedReviewCount']) ?? 0,
      ratingBreakdown: RestaurantRatingBreakdown(
        averageFood: _readNumber(ratingBreakdown['avgFood'])?.toDouble(),
        averagePrice: _readNumber(ratingBreakdown['avgPrice'])?.toDouble(),
        averageService: _readNumber(ratingBreakdown['avgService'])?.toDouble(),
        averageAmbience: _readNumber(
          ratingBreakdown['avgAmbience'],
        )?.toDouble(),
        averageOverall: _readNumber(ratingBreakdown['avgOverall'])?.toDouble(),
        reviewCount: _readInteger(ratingBreakdown['reviewCount']) ?? 0,
      ),
    );
  }

  @override
  Future<List<HomeMenuItem>> fetchRestaurantMenu(String restaurantId) async {
    final normalizedId = restaurantId.trim();
    if (normalizedId.isEmpty) {
      throw const FormatException('Restaurant id is required.');
    }

    final response = await _apiClient.getJson(
      '/restaurants/$normalizedId/menu',
      {'page': '1', 'pageSize': '50'},
    );
    final items = response['items'];
    if (items is! List) {
      throw const FormatException('Restaurant menu items must be an array.');
    }

    return items
        .map((value) {
          if (value is! Map<String, dynamic>) {
            throw const FormatException(
              'Restaurant menu item must be an object.',
            );
          }
          final id = value['id'];
          final name = value['name'];
          final price = _readNumber(value['price']);
          final currency = value['currency'];
          if (id is! String || id.trim().isEmpty) {
            throw const FormatException('Restaurant menu item id is required.');
          }
          if (name is! String || name.trim().isEmpty) {
            throw const FormatException(
              'Restaurant menu item name is required.',
            );
          }
          if (price == null || price < 0) {
            throw const FormatException(
              'Restaurant menu item price is invalid.',
            );
          }
          if (currency is! String || currency.trim().isEmpty) {
            throw const FormatException(
              'Restaurant menu item currency is required.',
            );
          }

          return HomeMenuItem(
            id: id.trim(),
            name: name.trim(),
            price: price.toDouble(),
            currency: currency.trim().toUpperCase(),
          );
        })
        .toList(growable: false);
  }

  @override
  Future<HomeRestaurantReviewPage> fetchRestaurantReviews(
    String restaurantId,
  ) async {
    final normalizedId = restaurantId.trim();
    if (normalizedId.isEmpty) {
      throw const FormatException('Restaurant id is required.');
    }

    final response = await _apiClient.getJson(
      '/restaurants/$normalizedId/reviews',
      {'status': 'ALL', 'page': '1', 'pageSize': '20'},
    );
    final items = response['items'];
    if (items is! List) {
      throw const FormatException('Restaurant reviews must be an array.');
    }

    return HomeRestaurantReviewPage(
      items: items.map(_parseReview).toList(growable: false),
      page: _readRequiredInteger(response['page'], 'Review page'),
      pageSize: _readRequiredInteger(response['pageSize'], 'Review page size'),
      total: _readRequiredInteger(response['total'], 'Review total'),
    );
  }

  HomeRestaurantReview _parseReview(Object? value) {
    if (value is! Map<String, dynamic>) {
      throw const FormatException('Restaurant review must be an object.');
    }

    final id = _readRequiredString(value['id'], 'Review id');
    final restaurantId = _readRequiredString(
      value['restaurantId'],
      'Review restaurant id',
    );
    final status = _readRequiredString(value['status'], 'Review status');
    if (status != 'VERIFIED' && status != 'REFERENCE_ONLY') {
      throw const FormatException('Review status is not public.');
    }

    final averageRating = _readNumber(value['averageRating'])?.toDouble();
    if (averageRating == null || averageRating < 1 || averageRating > 5) {
      throw const FormatException('Review average rating is invalid.');
    }

    return HomeRestaurantReview(
      id: id,
      restaurantId: restaurantId,
      branchId: _readOptionalString(value['branchId']),
      foodRating: _readRating(value['foodRating'], 'food'),
      priceRating: _readRating(value['priceRating'], 'price'),
      serviceRating: _readRating(value['serviceRating'], 'service'),
      ambienceRating: _readRating(value['ambienceRating'], 'ambience'),
      averageRating: averageRating,
      reviewerDisplayName: _readRequiredString(
        value['reviewerDisplayName'],
        'Review reviewer display name',
      ),
      reviewerAvatarUrl: _readOptionalString(value['reviewerAvatarUrl']),
      comment: _readRequiredString(value['comment'], 'Review comment'),
      status: status,
      verificationStatus: _readRequiredString(
        value['verificationStatus'],
        'Review verification status',
      ),
      trustLabel: _readRequiredString(
        value['trustLabel'],
        'Review trust label',
      ),
      visitedAt: _readOptionalDate(value['visitedAt'], 'Review visited date'),
      createdAt: _readRequiredDate(value['createdAt'], 'Review created date'),
      reactionCounts: _parseReactionCounts(value['reactionCounts']),
    );
  }

  ReviewReactionCounts _parseReactionCounts(Object? value) {
    if (value == null) return const ReviewReactionCounts();
    if (value is! Map<String, dynamic>) {
      throw const FormatException('Review reaction counts must be an object.');
    }
    return ReviewReactionCounts(
      love: _readRequiredInteger(value['LOVE'], 'LOVE reaction count'),
      haha: _readRequiredInteger(value['HAHA'], 'HAHA reaction count'),
      angry: _readRequiredInteger(value['ANGRY'], 'ANGRY reaction count'),
    );
  }

  HomeRestaurant _parseRestaurant(Object? value) {
    if (value is! Map<String, dynamic>) {
      throw const FormatException('Restaurant item must be an object.');
    }

    final id = value['id'];
    final name = value['name'];
    if (id is! String || id.trim().isEmpty) {
      throw const FormatException('Restaurant id is required.');
    }
    if (name is! String || name.trim().isEmpty) {
      throw const FormatException('Restaurant name is required.');
    }

    final trustScore = _readNumber(value['trustScore']);
    final distanceMeters = _readNumber(value['distanceMeters']);
    final verifiedReviewCount = _readInteger(value['verifiedReviewCount']) ?? 0;
    final primaryImageUrl = value['primaryImageUrl'];

    return HomeRestaurant(
      id: id,
      name: name.trim(),
      rating: trustScore == null ? 'Mới' : trustScore.toStringAsFixed(1),
      distance: _formatDistance(distanceMeters),
      status: verifiedReviewCount > 0
          ? '$verifiedReviewCount review xác thực'
          : 'Chưa có review xác thực',
      image: primaryImageUrl is String && primaryImageUrl.trim().isNotEmpty
          ? primaryImageUrl.trim()
          : null,
      featured: false,
    );
  }

  num? _readNumber(Object? value) {
    if (value == null) return null;
    if (value is num) return value;
    throw const FormatException('Restaurant numeric field is invalid.');
  }

  int? _readInteger(Object? value) {
    final number = _readNumber(value);
    if (number == null) return null;
    if (number is int) return number;
    if (number == number.roundToDouble()) return number.toInt();
    throw const FormatException('Restaurant count field is invalid.');
  }

  int _readRequiredInteger(Object? value, String fieldName) {
    final result = _readInteger(value);
    if (result == null || result < 0) {
      throw FormatException('$fieldName is invalid.');
    }
    return result;
  }

  int _readRating(Object? value, String fieldName) {
    final result = _readInteger(value);
    if (result == null || result < 1 || result > 5) {
      throw FormatException('Review $fieldName rating is invalid.');
    }
    return result;
  }

  String _readRequiredString(Object? value, String fieldName) {
    final result = _readOptionalString(value);
    if (result == null) {
      throw FormatException('$fieldName is required.');
    }
    return result;
  }

  DateTime _readRequiredDate(Object? value, String fieldName) {
    final result = _readOptionalDate(value, fieldName);
    if (result == null) {
      throw FormatException('$fieldName is required.');
    }
    return result;
  }

  DateTime? _readOptionalDate(Object? value, String fieldName) {
    final raw = _readOptionalString(value);
    if (raw == null) return null;
    final parsed = DateTime.tryParse(raw);
    if (parsed == null) {
      throw FormatException('$fieldName is invalid.');
    }
    return parsed.toUtc();
  }

  String? _readOptionalString(Object? value) {
    if (value == null) return null;
    if (value is! String) {
      throw const FormatException('Restaurant text field is invalid.');
    }
    final normalized = value.trim();
    return normalized.isEmpty ? null : normalized;
  }

  String? _formatDistance(num? distanceMeters) {
    if (distanceMeters == null) return null;
    if (distanceMeters < 100) {
      return '${distanceMeters.round()} m';
    }
    return '${(distanceMeters / 1000).toStringAsFixed(1)} km';
  }
}
