import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/core/theme/app_typography.dart';
import 'package:trustbite_mobile/src/features/home/data/restaurant_discovery_service.dart';
import 'package:trustbite_mobile/src/features/home/models/home_models.dart';
import 'package:trustbite_mobile/src/features/services/service_page_shell.dart';

class DishSearchServicePage extends StatefulWidget {
  const DishSearchServicePage({super.key, required this.restaurantRepository});

  final RestaurantDiscoveryRepository restaurantRepository;

  @override
  State<DishSearchServicePage> createState() => _DishSearchServicePageState();
}

class _DishSearchServicePageState extends State<DishSearchServicePage> {
  final _searchController = TextEditingController();
  late Future<List<HomeRestaurant>> _restaurants;
  HomeRestaurant? _selected;
  Future<List<HomeMenuItem>>? _menu;

  @override
  void initState() {
    super.initState();
    _restaurants = widget.restaurantRepository.fetchRestaurants();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _selectRestaurant(HomeRestaurant? restaurant) {
    if (restaurant?.id == null) return;
    setState(() {
      _selected = restaurant;
      _menu = widget.restaurantRepository.fetchRestaurantMenu(restaurant!.id!);
    });
  }

  @override
  Widget build(BuildContext context) {
    return ServicePageShell(
      pageKey: const ValueKey('dish-search-service-page'),
      title: 'Tìm món',
      subtitle: 'Chọn quán rồi tìm trực tiếp trong thực đơn điện tử.',
      dataSource: ServiceDataSource.live,
      header: const _DishSearchHero(),
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
              final restaurants = (snapshot.data ?? const <HomeRestaurant>[])
                  .where((restaurant) => restaurant.id != null)
                  .toList(growable: false);
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ServiceRestaurantPicker(
                    key: const ValueKey('dish-search-restaurant-picker'),
                    selected: _selected,
                    restaurants: restaurants,
                    onSelected: _selectRestaurant,
                    label: 'Chọn quán có món bạn thèm',
                    accentColor: const Color(0xFF16724A),
                  ),
                  const SizedBox(height: 14),
                  Container(
                    decoration: BoxDecoration(
                      color: const Color(0xFF183B2D),
                      borderRadius: BorderRadius.circular(22),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(
                            0xFF183B2D,
                          ).withValues(alpha: 0.18),
                          offset: const Offset(0, 10),
                          blurRadius: 24,
                        ),
                      ],
                    ),
                    child: TextField(
                      key: const ValueKey('dish-search-field'),
                      controller: _searchController,
                      enabled: _menu != null,
                      onChanged: (_) => setState(() {}),
                      style: AppTypography.bodyStrong.copyWith(
                        color: const Color(0xFFF6FBF8),
                        fontWeight: FontWeight.w800,
                      ),
                      decoration: InputDecoration(
                        hintText: _menu == null
                            ? 'Chọn quán trước'
                            : 'Bạn đang thèm món gì?',
                        hintStyle: const TextStyle(color: Color(0xFFB9C9C1)),
                        prefixIcon: const Icon(
                          Icons.search_rounded,
                          color: Color(0xFFAEE0C4),
                        ),
                        suffixIcon: _searchController.text.isEmpty
                            ? null
                            : IconButton(
                                onPressed: () {
                                  _searchController.clear();
                                  setState(() {});
                                },
                                icon: const Icon(
                                  Icons.close_rounded,
                                  color: Color(0xFFAEE0C4),
                                ),
                              ),
                        filled: true,
                        fillColor: Colors.transparent,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(22),
                          borderSide: BorderSide.none,
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(22),
                          borderSide: BorderSide.none,
                        ),
                        disabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(22),
                          borderSide: BorderSide.none,
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 18,
                          vertical: 18,
                        ),
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
          if (_menu != null) ...[
            const SizedBox(height: 24),
            Row(
              children: [
                const Expanded(child: ServiceSectionTitle('Món khớp vị')),
                if (_searchController.text.isNotEmpty)
                  Text(
                    'đang lọc',
                    style: AppTypography.tiny.copyWith(
                      color: const Color(0xFF16724A),
                      fontWeight: FontWeight.w900,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            FutureBuilder<List<HomeMenuItem>>(
              future: _menu,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const ServiceLoading();
                }
                if (snapshot.hasError) {
                  return ServiceMessage(
                    message: 'Không thể tải thực đơn.',
                    onRetry: () => _selectRestaurant(_selected),
                  );
                }
                final keyword = _searchController.text.trim().toLowerCase();
                final items = snapshot.requireData
                    .where(
                      (item) =>
                          keyword.isEmpty ||
                          item.name.toLowerCase().contains(keyword),
                    )
                    .toList(growable: false);
                if (items.isEmpty) {
                  return const ServiceMessage(
                    message: 'Không tìm thấy món phù hợp trong quán này.',
                  );
                }
                return Column(
                  children: [
                    for (var index = 0; index < items.length; index++) ...[
                      _DishRow(item: items[index], index: index),
                      if (index != items.length - 1) const SizedBox(height: 10),
                    ],
                  ],
                );
              },
            ),
          ],
          const SizedBox(height: 14),
          Text(
            'Tìm kiếm toàn bộ quán chưa có API; trang này chỉ lọc tối đa 50 món đầu tiên từ thực đơn thật của quán đã chọn.',
            style: AppTypography.tiny.copyWith(
              color: const Color(0xFF666A72),
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _DishSearchHero extends StatelessWidget {
  const _DishSearchHero();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 20, 18, 20),
      decoration: BoxDecoration(
        color: const Color(0xFFDDF2E6),
        borderRadius: BorderRadius.circular(30),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Gõ món.\nBắt đúng vị.',
                  style: TextStyle(
                    color: Color(0xFF143526),
                    fontSize: 30,
                    height: 1.05,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 9),
                Text(
                  'Lục thực đơn thật thay bạn.',
                  style: AppTypography.caption.copyWith(
                    color: const Color(0xFF446B58),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Container(
            width: 94,
            height: 118,
            decoration: BoxDecoration(
              color: const Color(0xFF183B2D),
              borderRadius: BorderRadius.circular(26),
            ),
            child: const Icon(
              Icons.ramen_dining_rounded,
              color: Color(0xFFAEE0C4),
              size: 52,
            ),
          ),
        ],
      ),
    );
  }
}

class _DishRow extends StatelessWidget {
  const _DishRow({required this.item, required this.index});

  final HomeMenuItem item;
  final int index;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: index.isEven ? const Color(0xFFFFFEFC) : const Color(0xFFF0F7F3),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE5E9E6)),
      ),
      child: Row(
        children: [
          Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              color: const Color(0xFFDDF2E6),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(
              Icons.ramen_dining_rounded,
              color: Color(0xFF16724A),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              item.name,
              style: AppTypography.bodyStrong.copyWith(
                color: const Color(0xFF111827),
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          Text(
            '${_groupDigits(item.price.round())} ₫',
            style: AppTypography.bodyStrong.copyWith(
              color: const Color(0xFF16724A),
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

String _groupDigits(int value) {
  final digits = value.toString();
  final buffer = StringBuffer();
  for (var index = 0; index < digits.length; index += 1) {
    if (index > 0 && (digits.length - index) % 3 == 0) buffer.write('.');
    buffer.write(digits[index]);
  }
  return buffer.toString();
}
