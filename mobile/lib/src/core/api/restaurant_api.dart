import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';

class NearbyRestaurant {
  const NearbyRestaurant({
    required this.id,
    required this.name,
    required this.latitude,
    required this.longitude,
    this.address,
    this.primaryImageUrl,
    this.trustScore,
    this.verifiedReviewCount,
  });

  final String id;
  final String name;
  final double latitude;
  final double longitude;
  final String? address;
  final String? primaryImageUrl;
  final double? trustScore;
  final int? verifiedReviewCount;

  factory NearbyRestaurant.fromJson(Map<String, dynamic> json) {
    final id = json['id'];
    final name = json['name'];
    if (id is! String ||
        id.trim().isEmpty ||
        name is! String ||
        name.trim().isEmpty) {
      throw const FormatException('Restaurant identity is missing.');
    }

    return NearbyRestaurant(
      id: id,
      name: name,
      latitude: _requiredDouble(json['latitude'], 'restaurant latitude'),
      longitude: _requiredDouble(json['longitude'], 'restaurant longitude'),
      address: json['address'] is String ? json['address'] as String : null,
      primaryImageUrl: json['primaryImageUrl'] is String
          ? json['primaryImageUrl'] as String
          : null,
      trustScore: _optionalDouble(json['trustScore']),
      verifiedReviewCount: json['verifiedReviewCount'] is num
          ? (json['verifiedReviewCount'] as num).toInt()
          : null,
    );
  }
}

class RestaurantApi {
  const RestaurantApi({required TrustBiteApiClient apiClient})
    : _apiClient = apiClient;

  final TrustBiteApiClient _apiClient;

  Future<List<NearbyRestaurant>> nearbyRestaurants({
    required double northEastLatitude,
    required double northEastLongitude,
    required double southWestLatitude,
    required double southWestLongitude,
    int pageSize = 100,
  }) async {
    final body = await _apiClient.getJson('/restaurants/nearby', {
      'northEastLat': northEastLatitude.toString(),
      'northEastLng': northEastLongitude.toString(),
      'southWestLat': southWestLatitude.toString(),
      'southWestLng': southWestLongitude.toString(),
      'pageSize': pageSize.clamp(1, 250).toString(),
    });
    final items = body['items'];
    if (items is! List) {
      throw const FormatException('Backend items are missing.');
    }
    return items
        .map((item) => NearbyRestaurant.fromJson(_jsonMap(item, 'item')))
        .toList(growable: false);
  }
}

Map<String, dynamic> _jsonMap(Object? value, String name) {
  if (value is Map<String, dynamic>) return value;
  throw FormatException('Backend $name is malformed.');
}

double _requiredDouble(Object? value, String name) {
  if (value is num && value.isFinite) return value.toDouble();
  throw FormatException('Backend $name is malformed.');
}

double? _optionalDouble(Object? value) {
  if (value == null) return null;
  if (value is num && value.isFinite) return value.toDouble();
  return null;
}
