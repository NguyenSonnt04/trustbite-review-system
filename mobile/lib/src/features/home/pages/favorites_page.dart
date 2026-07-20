import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/common/widgets/optimized_network_image.dart';
import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/core/auth/app_auth.dart';
import 'package:trustbite_mobile/src/core/theme/app_typography.dart';
import 'package:trustbite_mobile/src/features/home/data/favorites_service.dart';
import 'package:trustbite_mobile/src/features/home/data/restaurant_discovery_service.dart';
import 'package:trustbite_mobile/src/features/home/home_tokens.dart';
import 'package:trustbite_mobile/src/features/home/models/home_models.dart';

class FavoritesPage extends StatefulWidget {
  const FavoritesPage({
    super.key,
    required this.isSignedIn,
    required this.onLogin,
    this.favoritesRepository,
    this.restaurantRepository,
    this.onAuthenticationRequired,
  });

  final bool isSignedIn;
  final Future<bool> Function() onLogin;
  final FavoritesRepository? favoritesRepository;
  final RestaurantDiscoveryRepository? restaurantRepository;
  final Future<void> Function()? onAuthenticationRequired;

  @override
  State<FavoritesPage> createState() => _FavoritesPageState();
}

class _FavoritesPageState extends State<FavoritesPage> {
  late final FavoritesRepository _favoritesRepository;
  late final RestaurantDiscoveryRepository _restaurantRepository;
  Future<_FavoritesData>? _data;

  @override
  void initState() {
    super.initState();
    _favoritesRepository =
        widget.favoritesRepository ?? FavoritesService(apiClient: appApiClient);
    _restaurantRepository =
        widget.restaurantRepository ??
        RestaurantDiscoveryService(apiClient: appApiClient);
    if (widget.isSignedIn) _load();
  }

  @override
  void didUpdateWidget(covariant FavoritesPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!oldWidget.isSignedIn && widget.isSignedIn) _load();
  }

  void _load() {
    _data = _fetchData();
  }

  Future<_FavoritesData> _fetchData() async {
    try {
      final results = await Future.wait<Object>([
        _favoritesRepository.fetchFavorites(),
        _restaurantRepository.fetchRestaurants(),
      ]);
      final favorites = results[0] as List<FavoriteRestaurant>;
      final favoriteIds = favorites
          .map((item) => item.restaurant.id)
          .whereType<String>()
          .toSet();
      final suggestions = (results[1] as List<HomeRestaurant>)
          .where((restaurant) => !favoriteIds.contains(restaurant.id))
          .take(3)
          .toList(growable: false);
      return _FavoritesData(favorites: favorites, suggestions: suggestions);
    } on AuthRequiredException {
      await widget.onAuthenticationRequired?.call();
      rethrow;
    }
  }

  Future<void> _requireLogin() async {
    if (await widget.onLogin() && mounted) {
      setState(_load);
    }
  }

  Future<void> _save(HomeRestaurant restaurant) async {
    final id = restaurant.id;
    if (id == null) return;
    try {
      final current = await (_data ??= _fetchData());
      await _favoritesRepository.saveFavorite(id);
      if (!mounted) return;
      setState(() {
        _data = Future.value(
          _FavoritesData(
            favorites: [
              FavoriteRestaurant(
                restaurant: restaurant,
                addedAt: DateTime.now().toUtc(),
              ),
              ...current.favorites.where(
                (item) => item.restaurant.id != restaurant.id,
              ),
            ],
            suggestions: current.suggestions
                .where((item) => item.id != restaurant.id)
                .toList(growable: false),
          ),
        );
      });
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Đã lưu ${restaurant.name}.')));
    } on AuthRequiredException {
      if (widget.onAuthenticationRequired != null) {
        await widget.onAuthenticationRequired!();
      } else {
        await _requireLogin();
      }
    } on Exception {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Không thể lưu quán. Vui lòng thử lại.')),
      );
    }
  }

  Future<void> _remove(HomeRestaurant restaurant) async {
    final id = restaurant.id;
    if (id == null) return;
    try {
      final current = await (_data ??= _fetchData());
      await _favoritesRepository.removeFavorite(id);
      if (!mounted) return;
      setState(() {
        _data = Future.value(
          _FavoritesData(
            favorites: current.favorites
                .where((item) => item.restaurant.id != restaurant.id)
                .toList(growable: false),
            suggestions: [
              restaurant,
              ...current.suggestions.where(
                (item) => item.id != restaurant.id,
              ),
            ].take(3).toList(growable: false),
          ),
        );
      });
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Đã bỏ lưu ${restaurant.name}.')));
    } on AuthRequiredException {
      if (widget.onAuthenticationRequired != null) {
        await widget.onAuthenticationRequired!();
      } else {
        await _requireLogin();
      }
    } on Exception {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Không thể bỏ lưu quán.')));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.isSignedIn) {
      return ListView(
        key: const ValueKey('favorites-page'),
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 118),
        children: [
          const _FavoritesHeader(),
          const SizedBox(height: 20),
          _FavoritesLoginCard(onLogin: _requireLogin),
        ],
      );
    }

    return ListView(
      key: const ValueKey('favorites-page'),
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 118),
      children: [
        const _FavoritesHeader(),
        const SizedBox(height: 18),
        FutureBuilder<_FavoritesData>(
          future: _data ??= _fetchData(),
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const SizedBox(
                height: 280,
                child: Center(
                  child: CircularProgressIndicator(color: HomeColors.brand),
                ),
              );
            }
            if (snapshot.hasError) {
              return _FavoritesError(onRetry: () => setState(_load));
            }
            final data = snapshot.requireData;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _FavoritesOverviewCard(savedCount: data.favorites.length),
                if (data.favorites.isNotEmpty) ...[
                  const SizedBox(height: 24),
                  _SavedFavoritesSection(
                    favorites: data.favorites,
                    onRemove: _remove,
                  ),
                ],
                if (data.suggestions.isNotEmpty) ...[
                  const SizedBox(height: 26),
                  _SuggestedSavesSection(
                    restaurants: data.suggestions,
                    onSave: _save,
                  ),
                ],
                const SizedBox(height: 22),
                const _SaveHintPanel(),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _FavoritesData {
  const _FavoritesData({required this.favorites, required this.suggestions});

  final List<FavoriteRestaurant> favorites;
  final List<HomeRestaurant> suggestions;
}

class _FavoritesHeader extends StatelessWidget {
  const _FavoritesHeader();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Yêu thích',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.sectionTitle.copyWith(
              color: AppTypography.ink,
              fontSize: 22,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            'Các địa điểm bạn đã lưu',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.caption.copyWith(color: HomeColors.muted),
          ),
        ],
      ),
    );
  }
}

class _FavoritesOverviewCard extends StatelessWidget {
  const _FavoritesOverviewCard({required this.savedCount});

  final int savedCount;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFEFC),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: const Color(0xFFF5F1EC)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.055),
            offset: const Offset(0, 10),
            blurRadius: 24,
          ),
        ],
      ),
      child: Column(
        children: [
          Container(
            width: 62,
            height: 62,
            decoration: BoxDecoration(
              color: HomeColors.brand.withValues(alpha: 0.09),
              borderRadius: BorderRadius.circular(22),
            ),
            child: const Icon(
              Icons.favorite_border_rounded,
              size: 38,
              color: HomeColors.brand,
            ),
          ),
          const SizedBox(height: 14),
          Text(
            savedCount == 0
                ? 'Chưa có quán yêu thích'
                : 'Danh sách ghé lại của bạn',
            textAlign: TextAlign.center,
            style: AppTypography.cardTitle.copyWith(
              color: AppTypography.ink,
              fontSize: 20,
            ),
          ),
          const SizedBox(height: 7),
          Text(
            savedCount == 0
                ? 'Lưu những quán có review đáng tin để xem lại nhanh hơn.'
                : 'Các quán được đồng bộ với tài khoản TrustBite của bạn.',
            textAlign: TextAlign.center,
            style: AppTypography.body.copyWith(
              color: HomeColors.muted,
              height: 1.32,
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: _FavoriteMetric(value: '$savedCount', label: 'Đã lưu'),
              ),
              const SizedBox(width: 8),
              const Expanded(
                child: _FavoriteMetric(value: '1', label: 'Danh sách'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _FavoriteMetric extends StatelessWidget {
  const _FavoriteMetric({required this.value, required this.label});

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFFAFAFA),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFF0F0F0)),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.labelStrong.copyWith(
              color: HomeColors.brand,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.tiny.copyWith(color: HomeColors.muted),
          ),
        ],
      ),
    );
  }
}

class _SuggestedSavesSection extends StatelessWidget {
  const _SuggestedSavesSection({
    required this.restaurants,
    required this.onSave,
  });

  final List<HomeRestaurant> restaurants;
  final ValueChanged<HomeRestaurant> onSave;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Gợi ý để lưu',
                    style: AppTypography.sectionTitle.copyWith(
                      color: AppTypography.ink,
                      fontSize: 22,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Quán nổi bật có tín hiệu đáng tin gần bạn.',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.caption.copyWith(
                      color: HomeColors.muted,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: HomeColors.brand.withValues(alpha: 0.09),
                borderRadius: BorderRadius.circular(13),
              ),
              child: const Icon(
                Icons.auto_awesome_rounded,
                size: 18,
                color: HomeColors.brand,
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        for (var i = 0; i < restaurants.length; i++) ...[
          _SuggestedSaveTile(
            restaurant: restaurants[i],
            onSave: () => onSave(restaurants[i]),
          ),
          if (i != restaurants.length - 1) const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class _SuggestedSaveTile extends StatelessWidget {
  const _SuggestedSaveTile({required this.restaurant, required this.onSave});

  final HomeRestaurant restaurant;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFEFC),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFF3F4F6)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.045),
            offset: const Offset(0, 8),
            blurRadius: 18,
          ),
        ],
      ),
      child: Row(
        children: [
          OptimizedNetworkImage(
            imageUrl: restaurant.image,
            width: 74,
            height: 74,
            borderRadius: 17,
            semanticLabel: restaurant.name,
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  restaurant.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.labelStrong.copyWith(
                    color: AppTypography.ink,
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    const Icon(
                      Icons.star_rounded,
                      size: 14,
                      color: HomeColors.brand,
                    ),
                    const SizedBox(width: 3),
                    Text(
                      restaurant.rating,
                      style: AppTypography.tiny.copyWith(
                        color: const Color(0xFF4B5563),
                      ),
                    ),
                    const SizedBox(width: 9),
                    const Icon(
                      Icons.place_rounded,
                      size: 13,
                      color: HomeColors.brand,
                    ),
                    const SizedBox(width: 2),
                    Expanded(
                      child: Text(
                        restaurant.distance ?? 'Chưa có khoảng cách',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.tiny.copyWith(
                          color: HomeColors.muted,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                const _VerificationBadge(label: 'Có review xác thực'),
              ],
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            key: ValueKey('save-favorite-${restaurant.id}'),
            tooltip: 'Lưu ${restaurant.name}',
            onPressed: onSave,
            style: IconButton.styleFrom(
              backgroundColor: HomeColors.brand.withValues(alpha: 0.09),
              foregroundColor: HomeColors.brand,
            ),
            icon: const Icon(Icons.favorite_border_rounded, size: 20),
          ),
        ],
      ),
    );
  }
}

class _VerificationBadge extends StatelessWidget {
  const _VerificationBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 154),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: const Color(0xFF16A34A).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: const Color(0xFF16A34A).withValues(alpha: 0.16),
        ),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.check_circle_rounded,
            size: 12,
            color: Color(0xFF16A34A),
          ),
          const SizedBox(width: 4),
          Expanded(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.tiny.copyWith(
                color: const Color(0xFF15803D),
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SavedFavoritesSection extends StatelessWidget {
  const _SavedFavoritesSection({
    required this.favorites,
    required this.onRemove,
  });

  final List<FavoriteRestaurant> favorites;
  final ValueChanged<HomeRestaurant> onRemove;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Đã lưu',
          style: AppTypography.sectionTitle.copyWith(
            color: AppTypography.ink,
            fontSize: 22,
          ),
        ),
        const SizedBox(height: 14),
        for (var index = 0; index < favorites.length; index++) ...[
          _SavedFavoriteTile(
            favorite: favorites[index],
            onRemove: () => onRemove(favorites[index].restaurant),
          ),
          if (index != favorites.length - 1) const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class _SavedFavoriteTile extends StatelessWidget {
  const _SavedFavoriteTile({required this.favorite, required this.onRemove});

  final FavoriteRestaurant favorite;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final restaurant = favorite.restaurant;
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFF0F0F2)),
      ),
      child: Row(
        children: [
          OptimizedNetworkImage(
            imageUrl: restaurant.image,
            width: 72,
            height: 72,
            borderRadius: 17,
            semanticLabel: restaurant.name,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  restaurant.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.labelStrong,
                ),
                const SizedBox(height: 6),
                Text(
                  '${restaurant.rating} · ${restaurant.status}',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.caption.copyWith(
                    color: HomeColors.muted,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            key: ValueKey('remove-favorite-${restaurant.id}'),
            tooltip: 'Bỏ lưu ${restaurant.name}',
            onPressed: onRemove,
            color: HomeColors.brand,
            icon: const Icon(Icons.favorite_rounded),
          ),
        ],
      ),
    );
  }
}

class _FavoritesLoginCard extends StatelessWidget {
  const _FavoritesLoginCard({required this.onLogin});

  final VoidCallback onLogin;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: const Color(0xFFF0F0F2)),
      ),
      child: Column(
        children: [
          const Icon(
            Icons.favorite_border_rounded,
            size: 48,
            color: HomeColors.brand,
          ),
          const SizedBox(height: 14),
          const Text(
            'Đăng nhập để đồng bộ quán yêu thích',
            textAlign: TextAlign.center,
            style: AppTypography.cardTitle,
          ),
          const SizedBox(height: 8),
          Text(
            'Danh sách được lưu theo tài khoản và có thể mở lại trên thiết bị khác.',
            textAlign: TextAlign.center,
            style: AppTypography.body.copyWith(color: HomeColors.muted),
          ),
          const SizedBox(height: 18),
          FilledButton(
            onPressed: onLogin,
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
              backgroundColor: HomeColors.brand,
            ),
            child: const Text('Đăng nhập'),
          ),
        ],
      ),
    );
  }
}

class _FavoritesError extends StatelessWidget {
  const _FavoritesError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFF0F0F2)),
      ),
      child: Column(
        children: [
          const Icon(
            Icons.cloud_off_rounded,
            color: HomeColors.muted,
            size: 42,
          ),
          const SizedBox(height: 12),
          const Text('Không thể tải quán yêu thích.'),
          const SizedBox(height: 8),
          TextButton(onPressed: onRetry, child: const Text('Thử lại')),
        ],
      ),
    );
  }
}

class _SaveHintPanel extends StatelessWidget {
  const _SaveHintPanel();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFAFAFA),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFEFEFEF)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: HomeColors.brand.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(
              Icons.tips_and_updates_rounded,
              color: HomeColors.brand,
              size: 20,
            ),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Mẹo lưu quán',
                  style: AppTypography.labelStrong.copyWith(
                    color: AppTypography.ink,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Chạm biểu tượng tim ở thẻ quán để tạo danh sách ghé lại.',
                  style: AppTypography.caption.copyWith(
                    color: HomeColors.muted,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
