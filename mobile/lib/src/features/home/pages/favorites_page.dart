import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/common/widgets/optimized_network_image.dart';
import 'package:trustbite_mobile/src/core/theme/app_typography.dart';
import 'package:trustbite_mobile/src/features/home/data/home_mock_data.dart';
import 'package:trustbite_mobile/src/features/home/home_tokens.dart';
import 'package:trustbite_mobile/src/features/home/models/home_models.dart';

class FavoritesPage extends StatelessWidget {
  const FavoritesPage({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      key: const ValueKey('favorites-page'),
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 118),
      children: [
        const _FavoritesHeader(),
        const SizedBox(height: 18),
        const _FavoritesOverviewCard(),
        const SizedBox(height: 16),
        const _FavoriteFilterBar(),
        const SizedBox(height: 24),
        _SuggestedSavesSection(
          restaurants: homeRestaurants.take(3).toList(growable: false),
        ),
        const SizedBox(height: 22),
        const _SaveHintPanel(),
      ],
    );
  }
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
  const _FavoritesOverviewCard();

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
            'Chưa có quán yêu thích',
            textAlign: TextAlign.center,
            style: AppTypography.cardTitle.copyWith(
              color: AppTypography.ink,
              fontSize: 20,
            ),
          ),
          const SizedBox(height: 7),
          Text(
            'Lưu những quán có review đáng tin để xem lại nhanh hơn.',
            textAlign: TextAlign.center,
            style: AppTypography.body.copyWith(
              color: HomeColors.muted,
              height: 1.32,
            ),
          ),
          const SizedBox(height: 18),
          const Row(
            children: [
              Expanded(
                child: _FavoriteMetric(value: '0', label: 'Đã lưu'),
              ),
              SizedBox(width: 8),
              Expanded(
                child: _FavoriteMetric(value: '0', label: 'Bộ sưu tập'),
              ),
              SizedBox(width: 8),
              Expanded(
                child: _FavoriteMetric(value: '3', label: 'Gợi ý'),
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

class _FavoriteFilterBar extends StatelessWidget {
  const _FavoriteFilterBar();

  @override
  Widget build(BuildContext context) {
    return const SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          _FavoriteFilterChip(
            icon: Icons.favorite_rounded,
            label: 'Tất cả',
            selected: true,
          ),
          SizedBox(width: 8),
          _FavoriteFilterChip(
            icon: Icons.place_rounded,
            label: 'Gần bạn',
            selected: false,
          ),
          SizedBox(width: 8),
          _FavoriteFilterChip(
            icon: Icons.verified_rounded,
            label: 'Đã xác thực',
            selected: false,
          ),
          SizedBox(width: 8),
          _FavoriteFilterChip(
            icon: Icons.schedule_rounded,
            label: 'Mở cửa',
            selected: false,
          ),
        ],
      ),
    );
  }
}

class _FavoriteFilterChip extends StatelessWidget {
  const _FavoriteFilterChip({
    required this.icon,
    required this.label,
    required this.selected,
  });

  final IconData icon;
  final String label;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 38,
      padding: const EdgeInsets.symmetric(horizontal: 13),
      decoration: BoxDecoration(
        color: selected ? HomeColors.brand : Colors.white,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: selected ? HomeColors.brand : const Color(0xFFEDEDED),
        ),
        boxShadow: selected
            ? [
                BoxShadow(
                  color: HomeColors.brand.withValues(alpha: 0.18),
                  offset: const Offset(0, 6),
                  blurRadius: 16,
                ),
              ]
            : null,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 16,
            color: selected ? Colors.white : HomeColors.muted,
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: AppTypography.labelStrong.copyWith(
              color: selected ? Colors.white : const Color(0xFF4B5563),
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

class _SuggestedSavesSection extends StatelessWidget {
  const _SuggestedSavesSection({required this.restaurants});

  final List<HomeRestaurant> restaurants;

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
          _SuggestedSaveTile(restaurant: restaurants[i]),
          if (i != restaurants.length - 1) const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class _SuggestedSaveTile extends StatelessWidget {
  const _SuggestedSaveTile({required this.restaurant});

  final HomeRestaurant restaurant;

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
                        restaurant.distance,
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
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: HomeColors.brand.withValues(alpha: 0.09),
              borderRadius: BorderRadius.circular(15),
            ),
            child: const Icon(
              Icons.favorite_border_rounded,
              size: 20,
              color: HomeColors.brand,
            ),
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
