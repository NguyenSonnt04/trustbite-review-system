import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/common/widgets/optimized_network_image.dart';
import 'package:trustbite_mobile/src/core/theme/app_typography.dart';
import 'package:trustbite_mobile/src/features/home/data/restaurant_discovery_service.dart';
import 'package:trustbite_mobile/src/features/home/models/home_models.dart';
import 'package:trustbite_mobile/src/features/services/service_page_shell.dart';

class RecommendationsServicePage extends StatefulWidget {
  const RecommendationsServicePage({
    super.key,
    required this.restaurantRepository,
  });

  final RestaurantDiscoveryRepository restaurantRepository;

  @override
  State<RecommendationsServicePage> createState() =>
      _RecommendationsServicePageState();
}

class _RecommendationsServicePageState
    extends State<RecommendationsServicePage> {
  late Future<List<HomeRestaurant>> _restaurants;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    _restaurants = widget.restaurantRepository.fetchRestaurants();
  }

  @override
  Widget build(BuildContext context) {
    return ServicePageShell(
      pageKey: const ValueKey('recommendations-service-page'),
      title: 'Gợi ý',
      subtitle: 'Khám phá các quán nổi bật theo điểm tin cậy hiện có.',
      dataSource: ServiceDataSource.live,
      header: const _RecommendationsHero(),
      child: FutureBuilder<List<HomeRestaurant>>(
        future: _restaurants,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const ServiceLoading();
          }
          if (snapshot.hasError) {
            return ServiceMessage(
              message: 'Không thể tải gợi ý lúc này.',
              onRetry: () => setState(_load),
            );
          }
          final restaurants = snapshot.data ?? const <HomeRestaurant>[];
          if (restaurants.isEmpty) {
            return const ServiceMessage(
              message: 'Chưa có nhà hàng phù hợp để gợi ý.',
            );
          }
          final featured = restaurants.first;
          final remaining = restaurants.skip(1).toList(growable: false);
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const ServiceSectionTitle('Lựa chọn nổi bật'),
              const SizedBox(height: 12),
              _FeaturedRecommendation(restaurant: featured),
              if (remaining.isNotEmpty) ...[
                const SizedBox(height: 26),
                const ServiceSectionTitle('Tiếp tục khám phá'),
                const SizedBox(height: 12),
                for (var index = 0; index < remaining.length; index++) ...[
                  _RecommendationRow(
                    restaurant: remaining[index],
                    rank: index + 2,
                  ),
                  if (index != remaining.length - 1) const SizedBox(height: 10),
                ],
              ],
              const SizedBox(height: 14),
              Text(
                'Đây là xếp hạng tổng quát từ API, chưa phải gợi ý cá nhân hóa theo sở thích.',
                style: AppTypography.tiny.copyWith(
                  color: const Color(0xFF666A72),
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _RecommendationsHero extends StatelessWidget {
  const _RecommendationsHero();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 20, 18, 20),
      decoration: BoxDecoration(
        color: const Color(0xFFEAE5FF),
        borderRadius: BorderRadius.circular(30),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Không biết ăn gì?\nBắt đầu ở đây.',
                  style: TextStyle(
                    color: Color(0xFF2A2045),
                    fontSize: 28,
                    height: 1.08,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 9),
                Text(
                  'Xếp hạng theo tín hiệu tin cậy hiện có.',
                  style: AppTypography.caption.copyWith(
                    color: const Color(0xFF675B86),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Container(
            width: 86,
            height: 112,
            decoration: BoxDecoration(
              color: const Color(0xFF5B47A6),
              borderRadius: BorderRadius.circular(26),
            ),
            child: const Icon(
              Icons.auto_awesome_rounded,
              color: Color(0xFFE8DEFF),
              size: 48,
            ),
          ),
        ],
      ),
    );
  }
}

class _FeaturedRecommendation extends StatelessWidget {
  const _FeaturedRecommendation({required this.restaurant});

  final HomeRestaurant restaurant;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF2A2045),
        borderRadius: BorderRadius.circular(28),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              OptimizedNetworkImage(
                imageUrl: restaurant.image,
                width: double.infinity,
                height: 176,
                borderRadius: 20,
                semanticLabel: restaurant.name,
              ),
              Positioned(
                left: 12,
                top: 12,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 11,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF9D96C),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: const Text(
                    '#1 hôm nay',
                    style: TextStyle(
                      color: Color(0xFF362C0B),
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(6, 14, 6, 6),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        restaurant.name,
                        style: AppTypography.cardTitle.copyWith(
                          color: const Color(0xFFF9F6FF),
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 5),
                      Text(
                        restaurant.status,
                        style: AppTypography.caption.copyWith(
                          color: const Color(0xFFCFC6E6),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 9,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFF44366C),
                    borderRadius: BorderRadius.circular(15),
                  ),
                  child: Text(
                    '★ ${restaurant.rating}',
                    style: AppTypography.bodyStrong.copyWith(
                      color: const Color(0xFFF9D96C),
                      fontWeight: FontWeight.w900,
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

class _RecommendationRow extends StatelessWidget {
  const _RecommendationRow({required this.restaurant, required this.rank});

  final HomeRestaurant restaurant;
  final int rank;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: rank.isEven ? const Color(0xFFFFF7EC) : const Color(0xFFF3F0FC),
        borderRadius: BorderRadius.circular(22),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 34,
            child: Text(
              '$rank',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Color(0xFF5B47A6),
                fontSize: 22,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          OptimizedNetworkImage(
            imageUrl: restaurant.image,
            width: 58,
            height: 58,
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
                  style: AppTypography.bodyStrong.copyWith(
                    color: const Color(0xFF2A2045),
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '★ ${restaurant.rating}  •  ${restaurant.status}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.tiny.copyWith(
                    color: const Color(0xFF716785),
                    fontWeight: FontWeight.w700,
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
