import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/core/theme/app_typography.dart';
import 'package:trustbite_mobile/src/features/auth/profile_management_service.dart';
import 'package:trustbite_mobile/src/features/home/data/restaurant_discovery_service.dart';
import 'package:trustbite_mobile/src/features/home/models/home_models.dart';
import 'package:trustbite_mobile/src/features/home/pages/restaurant_detail_page.dart';
import 'package:trustbite_mobile/src/features/services/service_page_shell.dart';

class ReportFakeServicePage extends StatefulWidget {
  const ReportFakeServicePage({
    super.key,
    required this.restaurantRepository,
    required this.reportRepository,
    required this.onAuthenticationRequired,
  });

  final RestaurantDiscoveryRepository restaurantRepository;
  final ProfileManagementRepository reportRepository;
  final Future<void> Function() onAuthenticationRequired;

  @override
  State<ReportFakeServicePage> createState() => _ReportFakeServicePageState();
}

class _ReportFakeServicePageState extends State<ReportFakeServicePage> {
  late Future<List<HomeRestaurant>> _restaurants;
  HomeRestaurant? _selected;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _restaurants = widget.restaurantRepository.fetchRestaurants();
  }

  Future<void> _submit() async {
    final restaurantId = _selected?.id;
    if (restaurantId == null || _submitting) return;
    final input = await showReportComposer(
      context,
      entityType: ReportEntityType.restaurant,
    );
    if (input == null || !mounted) return;
    setState(() => _submitting = true);
    try {
      await widget.reportRepository.submitReport(
        entityType: ReportEntityType.restaurant,
        entityId: restaurantId,
        reasonCode: input.reasonCode,
        description: input.description,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Đã gửi báo cáo cho ${_selected!.name}.')),
      );
      setState(() => _selected = null);
    } on AuthRequiredException {
      await widget.onAuthenticationRequired();
    } on Exception {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Không thể gửi báo cáo. Vui lòng thử lại.'),
        ),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ServicePageShell(
      pageKey: const ValueKey('report-fake-service-page'),
      title: 'Báo ảo',
      subtitle:
          'Báo cáo nhà hàng có thông tin sai, giả mạo hoặc gây hiểu nhầm.',
      dataSource: ServiceDataSource.live,
      header: const _ReportHero(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _ReportProgress(),
          const SizedBox(height: 18),
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
              if (restaurants.isEmpty) {
                return const ServiceMessage(
                  message: 'Chưa có nhà hàng để báo cáo.',
                );
              }
              return Column(
                children: [
                  IgnorePointer(
                    ignoring: _submitting,
                    child: ServiceRestaurantPicker(
                      key: const ValueKey('report-restaurant-picker'),
                      selected: _selected,
                      restaurants: restaurants,
                      label: 'Chọn quán cần kiểm tra',
                      accentColor: const Color(0xFFC43D35),
                      onSelected: (value) => setState(() => _selected = value),
                    ),
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      key: const ValueKey('report-submit-button'),
                      onPressed: _selected != null && !_submitting
                          ? _submit
                          : null,
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF9F2E2A),
                        foregroundColor: const Color(0xFFFFF8F5),
                        disabledBackgroundColor: const Color(0xFFE7DEDA),
                        minimumSize: const Size.fromHeight(56),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(18),
                        ),
                      ),
                      icon: _submitting
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.fact_check_rounded),
                      label: Text(
                        _submitting ? 'Đang gửi...' : 'Tiếp tục chọn lý do',
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF3E8),
              borderRadius: BorderRadius.circular(22),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.privacy_tip_rounded, color: Color(0xFF9F2E2A)),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Báo cáo được gửi đến API kiểm duyệt thật. Chỉ gửi khi bạn phát hiện nội dung sai hoặc vi phạm.',
                    style: AppTypography.caption.copyWith(
                      color: const Color(0xFF55555F),
                      height: 1.4,
                      fontWeight: FontWeight.w700,
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

class _ReportHero extends StatelessWidget {
  const _ReportHero();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 20, 18, 20),
      decoration: BoxDecoration(
        color: const Color(0xFF3B2020),
        borderRadius: BorderRadius.circular(30),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Giữ cộng đồng\nsạch và thật.',
                  style: TextStyle(
                    color: Color(0xFFFFF6F1),
                    fontSize: 29,
                    height: 1.06,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 9),
                Text(
                  'Mỗi báo cáo đều được chuyển đến hệ thống kiểm duyệt.',
                  style: AppTypography.caption.copyWith(
                    color: const Color(0xFFE2C4BD),
                    height: 1.35,
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
              color: const Color(0xFF9F2E2A),
              borderRadius: BorderRadius.circular(26),
            ),
            child: const Icon(
              Icons.shield_rounded,
              color: Color(0xFFFFD8CC),
              size: 50,
            ),
          ),
        ],
      ),
    );
  }
}

class _ReportProgress extends StatelessWidget {
  const _ReportProgress();

  @override
  Widget build(BuildContext context) {
    const steps = ['Chọn quán', 'Nêu lý do', 'Gửi duyệt'];
    return Row(
      children: [
        for (var index = 0; index < steps.length; index++) ...[
          Expanded(
            child: Column(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: index == 0
                        ? const Color(0xFF9F2E2A)
                        : const Color(0xFFEAE5E1),
                    shape: BoxShape.circle,
                  ),
                  child: Text(
                    '${index + 1}',
                    style: TextStyle(
                      color: index == 0
                          ? const Color(0xFFFFF8F5)
                          : const Color(0xFF756D67),
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                const SizedBox(height: 7),
                Text(
                  steps[index],
                  style: AppTypography.tiny.copyWith(
                    color: const Color(0xFF5C5651),
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
          if (index != steps.length - 1)
            const Expanded(
              child: Padding(
                padding: EdgeInsets.only(bottom: 24),
                child: Divider(color: Color(0xFFD8D1CB)),
              ),
            ),
        ],
      ],
    );
  }
}
