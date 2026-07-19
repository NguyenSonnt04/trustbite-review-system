import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/features/home/models/home_models.dart';

class FavoriteRestaurant {
  const FavoriteRestaurant({required this.restaurant, required this.addedAt});

  final HomeRestaurant restaurant;
  final DateTime addedAt;
}

abstract interface class FavoritesRepository {
  Future<List<FavoriteRestaurant>> fetchFavorites();

  Future<void> saveFavorite(String restaurantId);

  Future<void> removeFavorite(String restaurantId);
}

class FavoritesService implements FavoritesRepository {
  const FavoritesService({required TrustBiteApiClient apiClient})
    : _apiClient = apiClient;

  final TrustBiteApiClient _apiClient;

  @override
  Future<List<FavoriteRestaurant>> fetchFavorites() async {
    final response = await _apiClient.getJson('/users/me/favorites');
    final items = response['items'];
    if (items is! List) {
      throw const FormatException('Favorite items must be an array.');
    }
    return items.map(_parseFavorite).toList(growable: false);
  }

  @override
  Future<void> saveFavorite(String restaurantId) async {
    final id = _requiredId(restaurantId);
    await _apiClient.putJson('/users/me/favorites/$id', const {});
  }

  @override
  Future<void> removeFavorite(String restaurantId) async {
    final id = _requiredId(restaurantId);
    await _apiClient.deleteJson('/users/me/favorites/$id');
  }

  FavoriteRestaurant _parseFavorite(Object? value) {
    if (value is! Map<String, dynamic>) {
      throw const FormatException('Favorite item must be an object.');
    }
    final id = _requiredString(value['id'], 'Favorite restaurant id');
    final name = _requiredString(value['name'], 'Favorite restaurant name');
    final trustScore = _number(value['trustScore']);
    final verifiedReviewCount =
        _integer(value['verifiedReviewCount'], 'Verified review count') ?? 0;
    final addedAtRaw = _requiredString(value['addedAt'], 'Favorite added date');
    final addedAt = DateTime.tryParse(addedAtRaw);
    if (addedAt == null) {
      throw const FormatException('Favorite added date is invalid.');
    }

    return FavoriteRestaurant(
      restaurant: HomeRestaurant(
        id: id,
        name: name,
        rating: trustScore == null ? 'Mới' : trustScore.toStringAsFixed(1),
        distance: null,
        status: verifiedReviewCount > 0
            ? '$verifiedReviewCount review xác thực'
            : 'Chưa có review xác thực',
        image: _optionalString(value['primaryImageUrl']),
        featured: false,
      ),
      addedAt: addedAt.toUtc(),
    );
  }

  String _requiredId(String value) {
    final id = value.trim();
    if (id.isEmpty) throw ArgumentError.value(value, 'restaurantId');
    return id;
  }

  String _requiredString(Object? value, String field) {
    final text = _optionalString(value);
    if (text == null) throw FormatException('$field is required.');
    return text;
  }

  String? _optionalString(Object? value) {
    if (value == null) return null;
    if (value is! String) {
      throw const FormatException('Favorite text field is invalid.');
    }
    final text = value.trim();
    return text.isEmpty ? null : text;
  }

  num? _number(Object? value) {
    if (value == null) return null;
    if (value is num) return value;
    throw const FormatException('Favorite numeric field is invalid.');
  }

  int? _integer(Object? value, String field) {
    final number = _number(value);
    if (number == null) return null;
    if (number is int) return number;
    if (number == number.roundToDouble()) return number.toInt();
    throw FormatException('$field is invalid.');
  }
}
