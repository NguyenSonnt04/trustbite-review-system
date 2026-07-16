import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';

enum LocationTravelMode {
  car('car'),
  truck('truck'),
  walking('walking');

  const LocationTravelMode(this.apiValue);

  final String apiValue;
}

class LocationCoordinate {
  const LocationCoordinate({required this.latitude, required this.longitude});

  final double latitude;
  final double longitude;

  factory LocationCoordinate.fromGeometry(List<dynamic> value) {
    if (value.length < 2) {
      throw const FormatException('Route coordinate must contain longitude and latitude.');
    }
    return LocationCoordinate(
      longitude: _requiredDouble(value[0], 'route longitude'),
      latitude: _requiredDouble(value[1], 'route latitude'),
    );
  }
}

class LocationPlace {
  const LocationPlace({
    required this.label,
    required this.latitude,
    required this.longitude,
    this.country,
    this.categories = const <String>[],
  });

  final String label;
  final double latitude;
  final double longitude;
  final String? country;
  final List<String> categories;

  factory LocationPlace.fromJson(Map<String, dynamic> json) {
    final label = json['label'];
    if (label is! String || label.trim().isEmpty) {
      throw const FormatException('Place label is missing.');
    }

    return LocationPlace(
      label: label.trim(),
      latitude: _requiredDouble(json['latitude'], 'place latitude'),
      longitude: _requiredDouble(json['longitude'], 'place longitude'),
      country: json['country'] is String ? json['country'] as String : null,
      categories: _stringList(json['categories']),
    );
  }
}

class LocationRoute {
  const LocationRoute({
    required this.distanceMeters,
    required this.durationSeconds,
    required this.geometry,
  });

  final double distanceMeters;
  final double durationSeconds;
  final List<LocationCoordinate> geometry;

  factory LocationRoute.fromJson(Map<String, dynamic> json) {
    final rawGeometry = json['geometry'];
    if (rawGeometry is! List) {
      throw const FormatException('Route geometry is missing.');
    }

    return LocationRoute(
      distanceMeters: _requiredDouble(json['distanceMeters'], 'route distance'),
      durationSeconds: _requiredDouble(json['durationSeconds'], 'route duration'),
      geometry: rawGeometry
          .map((item) {
            if (item is! List) {
              throw const FormatException('Route geometry is malformed.');
            }
            return LocationCoordinate.fromGeometry(item);
          })
          .toList(growable: false),
    );
  }
}

class NearbyRestaurant {
  const NearbyRestaurant({
    required this.id,
    required this.name,
    required this.latitude,
    required this.longitude,
    this.address,
    this.trustScore,
    this.verifiedReviewCount,
  });

  final String id;
  final String name;
  final double latitude;
  final double longitude;
  final String? address;
  final double? trustScore;
  final int? verifiedReviewCount;

  factory NearbyRestaurant.fromJson(Map<String, dynamic> json) {
    final id = json['id'];
    final name = json['name'];
    if (id is! String || id.trim().isEmpty || name is! String || name.trim().isEmpty) {
      throw const FormatException('Restaurant identity is missing.');
    }

    return NearbyRestaurant(
      id: id,
      name: name,
      latitude: _requiredDouble(json['latitude'], 'restaurant latitude'),
      longitude: _requiredDouble(json['longitude'], 'restaurant longitude'),
      address: json['address'] is String ? json['address'] as String : null,
      trustScore: _optionalDouble(json['trustScore']),
      verifiedReviewCount: json['verifiedReviewCount'] is num
          ? (json['verifiedReviewCount'] as num).toInt()
          : null,
    );
  }
}

class LocationApi {
  const LocationApi({required TrustBiteApiClient apiClient})
    : _apiClient = apiClient;

  final TrustBiteApiClient _apiClient;

  Future<List<LocationPlace>> searchPlaces(
    String text, {
    double? latitude,
    double? longitude,
  }) async {
    final query = text.trim();
    if (query.isEmpty) return const <LocationPlace>[];
    if ((latitude == null) != (longitude == null)) {
      throw ArgumentError('Search latitude and longitude must be supplied together.');
    }

    final body = await _apiClient.getJson('/location/search', {
      'q': query,
      'lat': latitude?.toString(),
      'lng': longitude?.toString(),
    });
    return _parseItems(body, LocationPlace.fromJson);
  }

  Future<LocationPlace?> reverseGeocode(double latitude, double longitude) async {
    final body = await _apiClient.getJson('/location/reverse-geocode', {
      'lat': latitude.toString(),
      'lng': longitude.toString(),
    });
    final place = body['place'];
    if (place == null) return null;
    return LocationPlace.fromJson(_jsonMap(place, 'place'));
  }

  Future<LocationRoute> calculateRoute({
    required LocationCoordinate origin,
    required LocationCoordinate destination,
    LocationTravelMode mode = LocationTravelMode.car,
  }) async {
    final body = await _apiClient.getJson('/location/route', {
      'originLat': origin.latitude.toString(),
      'originLng': origin.longitude.toString(),
      'destLat': destination.latitude.toString(),
      'destLng': destination.longitude.toString(),
      'mode': mode.apiValue,
    });
    return LocationRoute.fromJson(_jsonMap(body['route'], 'route'));
  }

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
    return _parseItems(body, NearbyRestaurant.fromJson);
  }
}

List<T> _parseItems<T>(
  Map<String, dynamic> body,
  T Function(Map<String, dynamic>) parse,
) {
  final items = body['items'];
  if (items is! List) {
    throw const FormatException('Backend items are missing.');
  }
  return items
      .map((item) => parse(_jsonMap(item, 'item')))
      .toList(growable: false);
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

List<String> _stringList(Object? value) {
  if (value is! List) return const <String>[];
  return value.whereType<String>().toList(growable: false);
}
