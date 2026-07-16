import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/common/widgets/optimized_network_image.dart';
import 'package:trustbite_mobile/src/core/theme/app_typography.dart';
import 'package:trustbite_mobile/src/features/home/data/home_mock_data.dart';
import 'package:trustbite_mobile/src/features/home/data/restaurant_discovery_service.dart';
import 'package:trustbite_mobile/src/features/home/home_tokens.dart';
import 'package:trustbite_mobile/src/features/home/models/home_models.dart';
import 'package:trustbite_mobile/src/features/home/pages/restaurant_detail_page.dart';
import 'package:trustbite_mobile/src/features/home/widgets/home_header.dart';
import 'package:trustbite_mobile/src/features/home/widgets/restaurant_card.dart';
import 'package:trustbite_mobile/src/features/home/widgets/see_all_chip.dart';
import 'package:trustbite_mobile/src/features/reviews/review_reaction_service.dart';

class DiscoverPage extends StatelessWidget {
  const DiscoverPage({
    super.key,
    required this.activeServiceIndex,
    required this.onServiceSelected,
    required this.isSignedIn,
    required this.currentUser,
    required this.onLogin,
    required this.restaurantRepository,
    this.reviewReactionRepository,
    this.notificationCount = 0,
    this.onNotificationsPressed,
  });

  final int activeServiceIndex;
  final ValueChanged<int> onServiceSelected;
  final bool isSignedIn;
  final Map<String, dynamic>? currentUser;
  final Future<bool> Function() onLogin;
  final RestaurantDiscoveryRepository restaurantRepository;
  final ReviewReactionRepository? reviewReactionRepository;
  final int notificationCount;
  final VoidCallback? onNotificationsPressed;

  @override
  Widget build(BuildContext context) {
    return ListView(
      key: const ValueKey('home-page'),
      padding: const EdgeInsets.only(bottom: 96),
      children: [
        HomeHeader(
          isSignedIn: isSignedIn,
          currentUser: currentUser,
          onLogin: () {
            onLogin();
          },
          notificationCount: notificationCount,
          onNotificationsPressed:
              onNotificationsPressed ??
              () {
                onLogin();
              },
        ),
        const _TitleAndSearch(),
        const SizedBox(height: 6),
        _NearbySection(
          repository: restaurantRepository,
          isSignedIn: isSignedIn,
          onLogin: onLogin,
          reviewReactionRepository: reviewReactionRepository,
        ),
        const SizedBox(height: 20),
        _ServicesSection(
          activeServiceIndex: activeServiceIndex,
          onServiceSelected: onServiceSelected,
        ),
        const SizedBox(height: 26),
        const _RecentlyViewedSection(),
        const SizedBox(height: 26),
        const _TrustedTodaySection(),
        const SizedBox(height: 26),
        const _LatestRealReviewsSection(),
      ],
    );
  }
}

class _TitleAndSearch extends StatelessWidget {
  const _TitleAndSearch();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 20, right: 20, top: 16, bottom: 3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          RichText(
            text: const TextSpan(
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w900,
                height: 1.1,
              ),
              children: [
                TextSpan(
                  text: 'Tìm với ',
                  style: TextStyle(color: Colors.black),
                ),
                TextSpan(
                  text: 'TrustBite',
                  style: TextStyle(color: HomeColors.brand),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Container(
            height: 44,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE8E8E8), width: 1.1),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.09),
                  offset: const Offset(4, 4),
                  blurRadius: 10,
                ),
              ],
            ),
            child: const Row(
              children: [
                Icon(Icons.search, size: 16, color: HomeColors.brand),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Tìm quán, món ăn, nước uống ...',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF9CA3AF),
                    ),
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

class _NearbySection extends StatefulWidget {
  const _NearbySection({
    required this.repository,
    required this.isSignedIn,
    required this.onLogin,
    required this.reviewReactionRepository,
  });

  final RestaurantDiscoveryRepository repository;
  final bool isSignedIn;
  final Future<bool> Function() onLogin;
  final ReviewReactionRepository? reviewReactionRepository;

  @override
  State<_NearbySection> createState() => _NearbySectionState();
}

class _NearbySectionState extends State<_NearbySection> {
  late Future<List<HomeRestaurant>> _restaurants;

  @override
  void initState() {
    super.initState();
    _loadRestaurants();
  }

  @override
  void didUpdateWidget(covariant _NearbySection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.repository != widget.repository) {
      _loadRestaurants();
    }
  }

  void _loadRestaurants() {
    _restaurants = widget.repository.fetchRestaurants();
  }

  void _retry() {
    setState(_loadRestaurants);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Gần bạn',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                        color: Colors.black,
                      ),
                    ),
                    Text(
                      'Quán nổi bật trong khu vực',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: HomeColors.muted,
                      ),
                    ),
                  ],
                ),
              ),
              SeeAllChip(),
            ],
          ),
        ),
        const SizedBox(height: 16),
        FutureBuilder<List<HomeRestaurant>>(
          future: _restaurants,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const SizedBox(
                key: ValueKey('nearby-restaurants-loading'),
                height: 160,
                child: Center(child: CircularProgressIndicator()),
              );
            }

            if (snapshot.hasError) {
              return _NearbyMessage(
                message: 'Không thể tải danh sách quán.',
                onRetry: _retry,
              );
            }

            final restaurants = snapshot.data ?? const <HomeRestaurant>[];
            if (restaurants.isEmpty) {
              return _NearbyMessage(
                message: 'Chưa có quán nào để hiển thị.',
                onRetry: _retry,
              );
            }

            return SizedBox(
              key: const ValueKey('nearby-restaurants-list'),
              height: 160,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 20),
                itemCount: restaurants.length,
                separatorBuilder: (_, __) => const SizedBox(width: 16),
                itemBuilder: (context, index) {
                  final restaurant = restaurants[index];
                  return RestaurantCard(
                    restaurant: restaurant,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => RestaurantDetailPage(
                          restaurantId: restaurant.id!,
                          repository: widget.repository,
                          initialRestaurant: restaurant,
                          isSignedIn: widget.isSignedIn,
                          onLogin: widget.onLogin,
                          reviewReactionRepository:
                              widget.reviewReactionRepository,
                        ),
                      ),
                    ),
                  );
                },
              ),
            );
          },
        ),
      ],
    );
  }
}

class _NearbyMessage extends StatelessWidget {
  const _NearbyMessage({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 160,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              message,
              style: AppTypography.caption.copyWith(color: HomeColors.muted),
            ),
            const SizedBox(height: 8),
            TextButton(onPressed: onRetry, child: const Text('Thử lại')),
          ],
        ),
      ),
    );
  }
}

class _ServicesSection extends StatelessWidget {
  const _ServicesSection({
    required this.activeServiceIndex,
    required this.onServiceSelected,
  });

  final int activeServiceIndex;
  final ValueChanged<int> onServiceSelected;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  'Dịch vụ khác',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    color: Colors.black,
                    height: 1.05,
                  ),
                ),
              ),
              Padding(padding: EdgeInsets.only(left: 12), child: SeeAllChip()),
            ],
          ),
          const SizedBox(height: 16),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: homeServiceShortcuts.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 4,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 0.92,
            ),
            itemBuilder: (context, index) {
              final shortcut = homeServiceShortcuts[index];
              final active = activeServiceIndex == index;
              return _ServiceShortcutCard(
                shortcut: shortcut,
                active: active,
                onTap: () => onServiceSelected(index),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _ServiceShortcutCard extends StatelessWidget {
  const _ServiceShortcutCard({
    required this.shortcut,
    required this.active,
    required this.onTap,
  });

  final HomeServiceShortcut shortcut;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(22),
        child: Semantics(
          button: true,
          selected: active,
          label: 'Dịch vụ ${shortcut.label}',
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 140),
            curve: Curves.easeOutCubic,
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFF3F4F6)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.045),
                  offset: const Offset(0, 6),
                  blurRadius: 16,
                ),
              ],
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                SizedBox(
                  width: 42,
                  height: 42,
                  child: Image.asset(
                    shortcut.iconAsset,
                    fit: BoxFit.contain,
                    filterQuality: FilterQuality.high,
                  ),
                ),
                const SizedBox(height: 7),
                Text(
                  shortcut.label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 11,
                    height: 1.08,
                    fontWeight: active ? FontWeight.w900 : FontWeight.w800,
                    color: const Color(0xFF111827),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _RecentlyViewedSection extends StatelessWidget {
  const _RecentlyViewedSection();

  @override
  Widget build(BuildContext context) {
    final recentRestaurants = homeRestaurants.take(3).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Đã xem gần đây',
                style: AppTypography.sectionTitle.copyWith(
                  color: AppTypography.ink,
                  fontSize: 22,
                ),
              ),
              const SeeAllChip(),
            ],
          ),
        ),
        const SizedBox(height: 14),
        SizedBox(
          height: 92,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            itemCount: recentRestaurants.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              return _RecentlyViewedCard(restaurant: recentRestaurants[index]);
            },
          ),
        ),
      ],
    );
  }
}

class _RecentlyViewedCard extends StatelessWidget {
  const _RecentlyViewedCard({required this.restaurant});

  final HomeRestaurant restaurant;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 260,
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF1F2F4)),
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
            borderRadius: 16,
            semanticLabel: restaurant.name,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  restaurant.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.labelStrong.copyWith(
                    color: const Color(0xFF111827),
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
                    const SizedBox(width: 8),
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
                const SizedBox(height: 7),
                Text(
                  restaurant.status,
                  style: AppTypography.tiny.copyWith(
                    color: const Color(0xFF16A34A),
                    fontWeight: FontWeight.w800,
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

class _TrustedTodaySection extends StatelessWidget {
  const _TrustedTodaySection();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Đáng tin hôm nay',
                style: AppTypography.sectionTitle.copyWith(
                  color: AppTypography.ink,
                  fontSize: 22,
                ),
              ),
              const SeeAllChip(),
            ],
          ),
        ),
        const SizedBox(height: 14),
        SizedBox(
          height: 190,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            itemCount: homeTrustedPicks.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              return _TrustedTodayCard(pick: homeTrustedPicks[index]);
            },
          ),
        ),
      ],
    );
  }
}

class _TrustedTodayCard extends StatelessWidget {
  const _TrustedTodayCard({required this.pick});

  final HomeTrustedPick pick;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 184,
      decoration: BoxDecoration(
        color: const Color(0xFFFFFCFA),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFFFE2D2)),
        boxShadow: [
          BoxShadow(
            color: HomeColors.brand.withValues(alpha: 0.08),
            offset: const Offset(0, 10),
            blurRadius: 22,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              OptimizedNetworkImage(
                imageUrl: pick.image,
                width: 184,
                height: 92,
                borderRadius: 22,
                semanticLabel: pick.restaurantName,
              ),
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.95),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.verified_rounded,
                        size: 13,
                        color: HomeColors.brand,
                      ),
                      const SizedBox(width: 3),
                      Text(
                        pick.rating,
                        style: AppTypography.tiny.copyWith(
                          color: const Color(0xFF111827),
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  pick.dishName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.labelStrong.copyWith(
                    color: const Color(0xFF111827),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  pick.restaurantName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.tiny.copyWith(color: HomeColors.muted),
                ),
                const SizedBox(height: 9),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final badge in pick.badges)
                      _TrustBadge(label: badge, dense: true),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LatestRealReviewsSection extends StatelessWidget {
  const _LatestRealReviewsSection();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Review thật mới nhất',
                style: AppTypography.sectionTitle.copyWith(
                  color: AppTypography.ink,
                  fontSize: 22,
                ),
              ),
              const SeeAllChip(),
            ],
          ),
          const SizedBox(height: 14),
          Column(
            children: [
              for (var i = 0; i < homeLatestReviews.length; i++) ...[
                _LatestReviewTile(review: homeLatestReviews[i]),
                if (i != homeLatestReviews.length - 1)
                  const SizedBox(height: 10),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _LatestReviewTile extends StatelessWidget {
  const _LatestReviewTile({required this.review});

  final HomeReviewSnippet review;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFAFAFA),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFF0F0F0)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: HomeColors.brand.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Text(
              _reviewInitial(review.reviewerName),
              style: AppTypography.labelStrong.copyWith(
                color: HomeColors.brand,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        review.dishName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.labelStrong.copyWith(
                          color: const Color(0xFF111827),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.star_rounded,
                          size: 14,
                          color: HomeColors.brand,
                        ),
                        const SizedBox(width: 2),
                        Text(
                          review.rating,
                          style: AppTypography.tiny.copyWith(
                            color: const Color(0xFF111827),
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  '${review.restaurantName} · ${review.timeAgo}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.tiny.copyWith(color: HomeColors.muted),
                ),
                const SizedBox(height: 7),
                Text(
                  review.summary,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.caption.copyWith(
                    color: const Color(0xFF4B5563),
                    height: 1.28,
                  ),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final badge in review.badges)
                      _TrustBadge(label: badge, dense: false),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TrustBadge extends StatelessWidget {
  const _TrustBadge({required this.label, required this.dense});

  final String label;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: dense ? 7 : 8,
        vertical: dense ? 4 : 5,
      ),
      decoration: BoxDecoration(
        color: const Color(0xFF16A34A).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: const Color(0xFF16A34A).withValues(alpha: 0.18),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.check_circle_rounded,
            size: dense ? 11 : 12,
            color: const Color(0xFF16A34A),
          ),
          const SizedBox(width: 4),
          Text(
            label,
            style: AppTypography.tiny.copyWith(
              color: const Color(0xFF15803D),
              fontWeight: FontWeight.w900,
              fontSize: dense ? 10 : 11,
            ),
          ),
        ],
      ),
    );
  }
}

String _reviewInitial(String name) {
  final trimmed = name.trim();
  if (trimmed.isEmpty) {
    return 'T';
  }
  return String.fromCharCode(trimmed.codeUnitAt(0)).toUpperCase();
}
