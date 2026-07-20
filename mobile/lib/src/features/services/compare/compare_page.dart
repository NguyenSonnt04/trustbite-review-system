import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/core/theme/app_typography.dart';
import 'package:trustbite_mobile/src/features/home/data/restaurant_discovery_service.dart';
import 'package:trustbite_mobile/src/features/home/models/home_models.dart';
import 'package:trustbite_mobile/src/features/services/service_page_shell.dart';

class CompareServicePage extends StatefulWidget {
  const CompareServicePage({super.key, required this.restaurantRepository});

  final RestaurantDiscoveryRepository restaurantRepository;

  @override
  State<CompareServicePage> createState() => _CompareServicePageState();
}

class _CompareServicePageState extends State<CompareServicePage> {
  late Future<List<HomeRestaurant>> _restaurants;
  HomeRestaurant? _left;
  HomeRestaurant? _right;
  Future<_ComparisonData>? _comparison;

  @override
  void initState() {
    super.initState();
    _restaurants = widget.restaurantRepository.fetchRestaurants();
  }

  void _compare() {
    final leftId = _left?.id;
    final rightId = _right?.id;
    if (leftId == null || rightId == null || leftId == rightId) return;
    setState(() {
      _comparison = _loadComparison(leftId, rightId);
    });
  }

  Future<_ComparisonData> _loadComparison(String leftId, String rightId) async {
    final results = await Future.wait<Object>([
      widget.restaurantRepository.fetchRestaurantDetail(leftId),
      widget.restaurantRepository.fetchRestaurantMenu(leftId),
      widget.restaurantRepository.fetchRestaurantDetail(rightId),
      widget.restaurantRepository.fetchRestaurantMenu(rightId),
    ]);
    return _ComparisonData(
      left: results[0] as HomeRestaurantDetail,
      leftMenu: results[1] as List<HomeMenuItem>,
      right: results[2] as HomeRestaurantDetail,
      rightMenu: results[3] as List<HomeMenuItem>,
    );
  }

  @override
  Widget build(BuildContext context) {
    return ServicePageShell(
      pageKey: const ValueKey('compare-service-page'),
      title: 'So sánh',
      subtitle:
          'Đặt hai quán cạnh nhau bằng dữ liệu đánh giá và thực đơn thật.',
      dataSource: ServiceDataSource.live,
      header: const _CompareHero(),
      child: FutureBuilder<List<HomeRestaurant>>(
        future: _restaurants,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const ServiceLoading();
          }
          if (snapshot.hasError) {
            return ServiceMessage(
              message: 'Không thể tải danh sách quán.',
              onRetry: () => setState(() {
                _restaurants = widget.restaurantRepository.fetchRestaurants();
              }),
            );
          }
          final restaurants = (snapshot.data ?? const <HomeRestaurant>[])
              .where((restaurant) => restaurant.id != null)
              .toList(growable: false);
          if (restaurants.length < 2) {
            return const ServiceMessage(
              message: 'Cần ít nhất hai nhà hàng để so sánh.',
            );
          }
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
                decoration: BoxDecoration(
                  color: const Color(0xFFEEF1F7),
                  borderRadius: BorderRadius.circular(28),
                ),
                child: Column(
                  children: [
                    _RestaurantPicker(
                      key: const ValueKey('compare-left-picker'),
                      label: 'Kèo bên trái',
                      value: _left,
                      restaurants: restaurants,
                      accentColor: const Color(0xFF3156D3),
                      excludeRestaurantId: _right?.id,
                      onChanged: (value) => setState(() {
                        _left = value;
                        _comparison = null;
                      }),
                    ),
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 10),
                      child: _VersusBadge(),
                    ),
                    _RestaurantPicker(
                      key: const ValueKey('compare-right-picker'),
                      label: 'Kèo bên phải',
                      value: _right,
                      restaurants: restaurants,
                      accentColor: const Color(0xFFE04D37),
                      excludeRestaurantId: _left?.id,
                      onChanged: (value) => setState(() {
                        _right = value;
                        _comparison = null;
                      }),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        key: const ValueKey('compare-submit-button'),
                        onPressed:
                            _left?.id != null &&
                                _right?.id != null &&
                                _left?.id != _right?.id
                            ? _compare
                            : null,
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF20283A),
                          foregroundColor: const Color(0xFFF9F8F6),
                          minimumSize: const Size.fromHeight(54),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(18),
                          ),
                        ),
                        icon: const Icon(Icons.bolt_rounded),
                        label: const Text('Mở màn so sánh'),
                      ),
                    ),
                  ],
                ),
              ),
              if (_comparison != null) ...[
                const SizedBox(height: 24),
                const ServiceSectionTitle('Bảng đối đầu'),
                const SizedBox(height: 12),
                FutureBuilder<_ComparisonData>(
                  future: _comparison,
                  builder: (context, comparisonSnapshot) {
                    if (comparisonSnapshot.connectionState !=
                        ConnectionState.done) {
                      return const ServiceLoading();
                    }
                    if (comparisonSnapshot.hasError) {
                      return ServiceMessage(
                        message: 'Không thể tải dữ liệu so sánh.',
                        onRetry: _compare,
                      );
                    }
                    return _ComparisonTable(
                      data: comparisonSnapshot.requireData,
                    );
                  },
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _CompareHero extends StatelessWidget {
  const _CompareHero();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 22),
      decoration: BoxDecoration(
        color: const Color(0xFF20283A),
        borderRadius: BorderRadius.circular(30),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Hai quán.\nMột lựa chọn.',
                  style: TextStyle(
                    color: Color(0xFFF7F4EF),
                    fontSize: 30,
                    height: 1.05,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              Container(
                width: 76,
                height: 76,
                decoration: BoxDecoration(
                  color: const Color(0xFF35405A),
                  borderRadius: BorderRadius.circular(24),
                ),
                child: const Icon(
                  Icons.balance_rounded,
                  color: Color(0xFFFFB16A),
                  size: 38,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'Đặt điểm tin cậy, giá và chất lượng cạnh nhau.',
            style: AppTypography.caption.copyWith(
              color: const Color(0xFFCBD1DD),
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _VersusBadge extends StatelessWidget {
  const _VersusBadge();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Expanded(child: Divider(color: Color(0xFFC8CEDB))),
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 12),
          width: 42,
          height: 42,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            color: Color(0xFF20283A),
            shape: BoxShape.circle,
          ),
          child: const Text(
            'VS',
            style: TextStyle(
              color: Color(0xFFFFB16A),
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
        const Expanded(child: Divider(color: Color(0xFFC8CEDB))),
      ],
    );
  }
}

class _RestaurantPicker extends StatelessWidget {
  const _RestaurantPicker({
    super.key,
    required this.label,
    required this.value,
    required this.restaurants,
    required this.onChanged,
    required this.accentColor,
    this.excludeRestaurantId,
  });

  final String label;
  final HomeRestaurant? value;
  final List<HomeRestaurant> restaurants;
  final ValueChanged<HomeRestaurant?> onChanged;
  final Color accentColor;
  final String? excludeRestaurantId;

  @override
  Widget build(BuildContext context) {
    return ServiceRestaurantPicker(
      selected: value,
      restaurants: restaurants,
      label: label,
      accentColor: accentColor,
      excludeRestaurantId: excludeRestaurantId,
      onSelected: onChanged,
    );
  }
}

class _ComparisonData {
  const _ComparisonData({
    required this.left,
    required this.leftMenu,
    required this.right,
    required this.rightMenu,
  });

  final HomeRestaurantDetail left;
  final List<HomeMenuItem> leftMenu;
  final HomeRestaurantDetail right;
  final List<HomeMenuItem> rightMenu;
}

class _ComparisonTable extends StatelessWidget {
  const _ComparisonTable({required this.data});

  final _ComparisonData data;

  @override
  Widget build(BuildContext context) {
    return ServiceSurface(
      padding: const EdgeInsets.all(14),
      child: Column(
        children: [
          _ComparisonHeader(left: data.left.name, right: data.right.name),
          const Divider(height: 24),
          _ComparisonRow(
            label: 'Điểm tin cậy',
            left: _score(data.left.trustScore),
            right: _score(data.right.trustScore),
          ),
          _ComparisonRow(
            label: 'Review xác thực',
            left: '${data.left.verifiedReviewCount}',
            right: '${data.right.verifiedReviewCount}',
          ),
          _ComparisonRow(
            label: 'Món đang hiển thị',
            left: '${data.leftMenu.length}',
            right: '${data.rightMenu.length}',
          ),
          _ComparisonRow(
            label: 'Giá trung bình',
            left: _averagePrice(data.leftMenu),
            right: _averagePrice(data.rightMenu),
          ),
          _ComparisonRow(
            label: 'Điểm món ăn',
            left: _score(data.left.ratingBreakdown.averageFood),
            right: _score(data.right.ratingBreakdown.averageFood),
          ),
          _ComparisonRow(
            label: 'Điểm dịch vụ',
            left: _score(data.left.ratingBreakdown.averageService),
            right: _score(data.right.ratingBreakdown.averageService),
          ),
        ],
      ),
    );
  }

  static String _score(double? value) {
    return value == null ? 'Chưa có' : value.toStringAsFixed(1);
  }

  static String _averagePrice(List<HomeMenuItem> menu) {
    if (menu.isEmpty) return 'Chưa có';
    final average =
        menu.fold<double>(0, (sum, item) => sum + item.price) / menu.length;
    return '${_groupDigits(average.round())} ₫';
  }
}

class _ComparisonHeader extends StatelessWidget {
  const _ComparisonHeader({required this.left, required this.right});

  final String left;
  final String right;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: _Name(text: left)),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 8),
          child: Icon(Icons.compare_arrows_rounded, color: Color(0xFFFF5E00)),
        ),
        Expanded(child: _Name(text: right)),
      ],
    );
  }
}

class _Name extends StatelessWidget {
  const _Name({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      textAlign: TextAlign.center,
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
      style: AppTypography.bodyStrong.copyWith(
        color: const Color(0xFF111827),
        fontWeight: FontWeight.w900,
      ),
    );
  }
}

class _ComparisonRow extends StatelessWidget {
  const _ComparisonRow({
    required this.label,
    required this.left,
    required this.right,
  });

  final String label;
  final String left;
  final String right;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Expanded(
            child: Text(
              left,
              textAlign: TextAlign.center,
              style: AppTypography.bodyStrong.copyWith(
                color: const Color(0xFF111827),
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          SizedBox(
            width: 112,
            child: Text(
              label,
              textAlign: TextAlign.center,
              style: AppTypography.tiny.copyWith(
                color: const Color(0xFF666A72),
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          Expanded(
            child: Text(
              right,
              textAlign: TextAlign.center,
              style: AppTypography.bodyStrong.copyWith(
                color: const Color(0xFF111827),
                fontWeight: FontWeight.w900,
              ),
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
