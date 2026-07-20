import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/core/theme/app_typography.dart';
import 'package:trustbite_mobile/src/features/home/data/restaurant_discovery_service.dart';
import 'package:trustbite_mobile/src/features/home/models/home_models.dart';
import 'package:trustbite_mobile/src/features/services/service_page_shell.dart';

class SummaryServicePage extends StatefulWidget {
  const SummaryServicePage({super.key, required this.restaurantRepository});

  final RestaurantDiscoveryRepository restaurantRepository;

  @override
  State<SummaryServicePage> createState() => _SummaryServicePageState();
}

class _SummaryServicePageState extends State<SummaryServicePage> {
  late Future<List<HomeRestaurant>> _restaurants;
  HomeRestaurant? _selected;
  Future<HomeRestaurantReviewPage>? _reviews;

  @override
  void initState() {
    super.initState();
    _restaurants = widget.restaurantRepository.fetchRestaurants();
  }

  void _selectRestaurant(HomeRestaurant? restaurant) {
    if (restaurant?.id == null) return;
    setState(() {
      _selected = restaurant;
      _reviews = widget.restaurantRepository.fetchRestaurantReviews(
        restaurant!.id!,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return ServicePageShell(
      pageKey: const ValueKey('summary-service-page'),
      title: 'Tóm tắt',
      subtitle: 'Xem nhanh điểm nổi bật từ review thật của một quán.',
      dataSource: ServiceDataSource.mixed,
      header: const _SummaryHero(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          FutureBuilder<List<HomeRestaurant>>(
            future: _restaurants,
            builder: (context, snapshot) {
              if (snapshot.connectionState != ConnectionState.done) {
                return const ServiceLoading();
              }
              if (snapshot.hasError) {
                return ServiceMessage(
                  message: 'Không thể tải danh sách quán.',
                  onRetry: () => setState(() {
                    _restaurants = widget.restaurantRepository
                        .fetchRestaurants();
                  }),
                );
              }
              final restaurants = snapshot.data ?? const [];
              if (restaurants.isEmpty) {
                return const ServiceMessage(
                  message: 'Chưa có nhà hàng để tóm tắt.',
                );
              }
              return ServiceRestaurantPicker(
                key: const ValueKey('summary-restaurant-picker'),
                selected: _selected,
                restaurants: restaurants
                    .where((restaurant) => restaurant.id != null)
                    .toList(growable: false),
                onSelected: _selectRestaurant,
                label: 'Chọn quán để đọc nhanh',
              );
            },
          ),
          if (_reviews == null) ...[
            const SizedBox(height: 28),
            const _SummaryEmptyState(),
          ],
          if (_reviews != null) ...[
            const SizedBox(height: 28),
            FutureBuilder<HomeRestaurantReviewPage>(
              future: _reviews,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const ServiceLoading();
                }
                if (snapshot.hasError) {
                  return ServiceMessage(
                    message: 'Không thể tải review của quán.',
                    onRetry: () => _selectRestaurant(_selected),
                  );
                }
                return _SummaryContent(
                  restaurant: _selected!,
                  reviews: snapshot.requireData,
                );
              },
            ),
          ],
        ],
      ),
    );
  }
}

class _SummaryHero extends StatelessWidget {
  const _SummaryHero();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 20, 18, 18),
      decoration: BoxDecoration(
        color: const Color(0xFFFFE9D6),
        borderRadius: BorderRadius.circular(30),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Đọc nhiều review\ntrong vài giây.',
                  style: TextStyle(
                    color: Color(0xFF29170C),
                    fontSize: 30,
                    height: 1.05,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'TrustBite gom tín hiệu nổi bật, bạn quyết định nhanh hơn.',
                  style: AppTypography.caption.copyWith(
                    color: const Color(0xFF70452D),
                    height: 1.4,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Container(
            width: 82,
            height: 116,
            decoration: BoxDecoration(
              color: const Color(0xFFFF5E00),
              borderRadius: BorderRadius.circular(24),
            ),
            child: const Icon(
              Icons.format_quote_rounded,
              color: Color(0xFFFFF8F2),
              size: 48,
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryEmptyState extends StatelessWidget {
  const _SummaryEmptyState();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Cách hoạt động',
          style: AppTypography.cardTitle.copyWith(
            color: const Color(0xFF17130F),
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 14),
        const Row(
          children: [
            Expanded(
              child: _SummaryStep(
                icon: Icons.rate_review_rounded,
                label: 'Review thật',
              ),
            ),
            _SummaryArrow(),
            Expanded(
              child: _SummaryStep(
                icon: Icons.filter_alt_rounded,
                label: 'Lọc tín hiệu',
              ),
            ),
            _SummaryArrow(),
            Expanded(
              child: _SummaryStep(icon: Icons.bolt_rounded, label: 'Đọc nhanh'),
            ),
          ],
        ),
      ],
    );
  }
}

class _SummaryStep extends StatelessWidget {
  const _SummaryStep({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 54,
          height: 54,
          decoration: BoxDecoration(
            color: const Color(0xFFFFF0E3),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Icon(icon, color: const Color(0xFFFF5E00)),
        ),
        const SizedBox(height: 8),
        Text(
          label,
          textAlign: TextAlign.center,
          style: AppTypography.tiny.copyWith(
            color: const Color(0xFF4F4943),
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );
  }
}

class _SummaryArrow extends StatelessWidget {
  const _SummaryArrow();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.only(bottom: 24),
      child: Icon(
        Icons.arrow_forward_rounded,
        color: Color(0xFFB6AEA6),
        size: 18,
      ),
    );
  }
}

class _SummaryContent extends StatelessWidget {
  const _SummaryContent({required this.restaurant, required this.reviews});

  final HomeRestaurant restaurant;
  final HomeRestaurantReviewPage reviews;

  @override
  Widget build(BuildContext context) {
    final verifiedCount = reviews.items
        .where((review) => review.status == 'VERIFIED')
        .length;
    final loadedCount = reviews.items.length;
    final comments = reviews.items
        .map((review) => review.comment)
        .where((comment) => comment.trim().isNotEmpty)
        .take(3)
        .toList(growable: false);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'BẢN ĐỌC NHANH',
                    style: AppTypography.tiny.copyWith(
                      color: const Color(0xFFFF5E00),
                      letterSpacing: 1.2,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    restaurant.name,
                    style: const TextStyle(
                      color: Color(0xFF17130F),
                      fontSize: 25,
                      height: 1.08,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
            ),
            Text(
              restaurant.rating,
              style: const TextStyle(
                color: Color(0xFFFF5E00),
                fontSize: 34,
                fontWeight: FontWeight.w900,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: const Color(0xFFEEF7F0),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Row(
            children: [
              const Icon(
                Icons.verified_rounded,
                color: Color(0xFF18753D),
                size: 20,
              ),
              const SizedBox(width: 9),
              Expanded(
                child: Text(
                  reviews.total == 0
                      ? 'Chưa có review công khai để tổng hợp.'
                      : 'Mẫu đang tải $loadedCount/${reviews.total} review công khai, $verifiedCount review xác thực.',
                  style: AppTypography.caption.copyWith(
                    color: const Color(0xFF285C3A),
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
        ),
        if (comments.isNotEmpty) ...[
          const SizedBox(height: 20),
          for (var index = 0; index < comments.length; index++) ...[
            Container(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
              decoration: BoxDecoration(
                color: index.isEven
                    ? const Color(0xFFFFF8F1)
                    : const Color(0xFFF3F0FF),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '“',
                    style: TextStyle(
                      color: index.isEven
                          ? const Color(0xFFFF5E00)
                          : const Color(0xFF6750A4),
                      fontSize: 32,
                      height: 0.8,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      comments[index],
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.body.copyWith(
                        color: const Color(0xFF3E3934),
                        height: 1.45,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
          ],
        ],
        const SizedBox(height: 4),
        Text(
          'Nội dung tóm tắt hiện là UI mẫu; review và số liệu được tải từ API thật.',
          style: AppTypography.tiny.copyWith(
            color: const Color(0xFF8A641F),
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );
  }
}
