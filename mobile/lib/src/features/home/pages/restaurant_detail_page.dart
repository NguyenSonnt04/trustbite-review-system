import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/common/widgets/optimized_network_image.dart';
import 'package:trustbite_mobile/src/core/auth/app_auth.dart';
import 'package:trustbite_mobile/src/core/theme/app_typography.dart';
import 'package:trustbite_mobile/src/features/auth/profile_management_service.dart';
import 'package:trustbite_mobile/src/features/home/data/restaurant_discovery_service.dart';
import 'package:trustbite_mobile/src/features/home/home_tokens.dart';
import 'package:trustbite_mobile/src/features/home/models/home_models.dart';
import 'package:trustbite_mobile/src/features/reviews/review_creation_page.dart';
import 'package:trustbite_mobile/src/features/reviews/review_reaction_service.dart';
import 'package:trustbite_mobile/src/features/reviews/review_submission_service.dart';

class RestaurantDetailPage extends StatefulWidget {
  const RestaurantDetailPage({
    super.key,
    required this.restaurantId,
    required this.repository,
    required this.initialRestaurant,
    required this.isSignedIn,
    required this.onLogin,
    this.reviewRepository,
    this.receiptPicker,
    this.reviewReactionRepository,
    this.safetyRepository,
  });

  final String restaurantId;
  final RestaurantDiscoveryRepository repository;
  final HomeRestaurant initialRestaurant;
  final bool isSignedIn;
  final Future<bool> Function() onLogin;
  final ReviewSubmissionRepository? reviewRepository;
  final ReceiptPicker? receiptPicker;
  final ReviewReactionRepository? reviewReactionRepository;
  final ProfileManagementRepository? safetyRepository;

  @override
  State<RestaurantDetailPage> createState() => _RestaurantDetailPageState();
}

class _RestaurantDetailPageState extends State<RestaurantDetailPage> {
  late Future<HomeRestaurantDetail> _detail;

  @override
  void initState() {
    super.initState();
    _loadDetail();
  }

  void _loadDetail() {
    _detail = widget.repository.fetchRestaurantDetail(widget.restaurantId);
  }

  void _retry() {
    setState(_loadDetail);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const ValueKey('restaurant-detail-page'),
      backgroundColor: const Color(0xFFF7F7F8),
      body: FutureBuilder<HomeRestaurantDetail>(
        future: _detail,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return _DetailLoading(restaurant: widget.initialRestaurant);
          }
          if (snapshot.hasError) {
            return _DetailError(onRetry: _retry);
          }
          return _DetailContent(
            detail: snapshot.requireData,
            restaurantId: widget.restaurantId,
            repository: widget.repository,
            isSignedIn: widget.isSignedIn,
            onLogin: widget.onLogin,
            reviewRepository: widget.reviewRepository,
            receiptPicker: widget.receiptPicker,
            reviewReactionRepository: widget.reviewReactionRepository,
            safetyRepository: widget.safetyRepository,
          );
        },
      ),
    );
  }
}

class _DetailLoading extends StatelessWidget {
  const _DetailLoading({required this.restaurant});

  final HomeRestaurant restaurant;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        children: [
          _SimpleBackHeader(title: restaurant.name),
          const Expanded(
            child: Center(
              child: CircularProgressIndicator(color: HomeColors.brand),
            ),
          ),
        ],
      ),
    );
  }
}

class _DetailError extends StatelessWidget {
  const _DetailError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        children: [
          const _SimpleBackHeader(title: 'Chi tiết nhà hàng'),
          Expanded(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.cloud_off_rounded,
                      size: 46,
                      color: HomeColors.muted,
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Không thể tải chi tiết nhà hàng.',
                      textAlign: TextAlign.center,
                      style: AppTypography.title,
                    ),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: onRetry,
                      style: FilledButton.styleFrom(
                        backgroundColor: HomeColors.brand,
                      ),
                      child: const Text('Thử lại'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SimpleBackHeader extends StatelessWidget {
  const _SimpleBackHeader({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 64,
      child: Row(
        children: [
          IconButton(
            tooltip: 'Quay lại',
            onPressed: () => Navigator.of(context).pop(),
            icon: const Icon(Icons.arrow_back_rounded),
          ),
          Expanded(
            child: Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.title,
            ),
          ),
          const SizedBox(width: 48),
        ],
      ),
    );
  }
}

class _DetailContent extends StatefulWidget {
  const _DetailContent({
    required this.detail,
    required this.restaurantId,
    required this.repository,
    required this.isSignedIn,
    required this.onLogin,
    required this.reviewRepository,
    required this.receiptPicker,
    required this.reviewReactionRepository,
    required this.safetyRepository,
  });

  final HomeRestaurantDetail detail;
  final String restaurantId;
  final RestaurantDiscoveryRepository repository;
  final bool isSignedIn;
  final Future<bool> Function() onLogin;
  final ReviewSubmissionRepository? reviewRepository;
  final ReceiptPicker? receiptPicker;
  final ReviewReactionRepository? reviewReactionRepository;
  final ProfileManagementRepository? safetyRepository;

  @override
  State<_DetailContent> createState() => _DetailContentState();
}

class _DetailContentState extends State<_DetailContent> {
  Future<List<HomeMenuItem>>? _menu;
  Future<HomeRestaurantReviewPage>? _reviews;
  late final ProfileManagementRepository _safetyRepository;

  HomeRestaurantDetail get detail => widget.detail;

  @override
  void initState() {
    super.initState();
    _safetyRepository =
        widget.safetyRepository ??
        ProfileManagementService(apiClient: appApiClient);
    _loadMenu();
    _loadReviews();
  }

  void _loadMenu() {
    _menu = widget.repository.fetchRestaurantMenu(widget.restaurantId);
  }

  void _retryMenu() {
    setState(_loadMenu);
  }

  void _loadReviews() {
    _reviews = widget.repository.fetchRestaurantReviews(widget.restaurantId);
  }

  void _retryReviews() {
    setState(_loadReviews);
  }

  Future<void> _openReviewFlow() async {
    var signedIn = widget.isSignedIn;
    if (!signedIn) {
      signedIn = await widget.onLogin();
    }
    if (!signedIn || !mounted) return;

    final published = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) => ReviewCreationPage(
          restaurantId: widget.restaurantId,
          restaurantName: detail.name,
          repository:
              widget.reviewRepository ??
              ReviewSubmissionService(apiClient: appApiClient),
          receiptPicker: widget.receiptPicker ?? ImagePickerReceiptPicker(),
        ),
      ),
    );
    if (published == true && mounted) {
      setState(_loadReviews);
    }
  }

  Future<void> _reportRestaurant() async {
    var signedIn = widget.isSignedIn;
    if (!signedIn) signedIn = await widget.onLogin();
    if (!signedIn || !mounted) return;
    final input = await showReportComposer(
      context,
      entityType: ReportEntityType.restaurant,
    );
    if (input == null || !mounted) return;
    try {
      await _safetyRepository.submitReport(
        entityType: ReportEntityType.restaurant,
        entityId: widget.restaurantId,
        reasonCode: input.reasonCode,
        description: input.description,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đã gửi báo cáo nhà hàng.')),
        );
      }
    } on Exception {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Không thể gửi báo cáo.')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final menu = _menu ??= widget.repository.fetchRestaurantMenu(
      widget.restaurantId,
    );
    final reviews = _reviews ??= widget.repository.fetchRestaurantReviews(
      widget.restaurantId,
    );

    return CustomScrollView(
      slivers: [
        SliverAppBar(
          pinned: true,
          expandedHeight: 280,
          backgroundColor: Colors.white,
          foregroundColor: Colors.white,
          surfaceTintColor: Colors.transparent,
          leading: Padding(
            padding: const EdgeInsets.all(8),
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.36),
                shape: BoxShape.circle,
              ),
              child: IconButton(
                tooltip: 'Quay lại',
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.arrow_back_rounded),
              ),
            ),
          ),
          actions: [
            Padding(
              padding: const EdgeInsets.all(8),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.36),
                  shape: BoxShape.circle,
                ),
                child: PopupMenuButton<String>(
                  tooltip: 'Tùy chọn nhà hàng',
                  icon: const Icon(Icons.more_horiz_rounded),
                  onSelected: (value) {
                    if (value == 'report') _reportRestaurant();
                  },
                  itemBuilder: (_) => const [
                    PopupMenuItem(
                      value: 'report',
                      child: ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: Icon(Icons.flag_outlined),
                        title: Text('Báo cáo nhà hàng'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
          flexibleSpace: FlexibleSpaceBar(
            background: Stack(
              fit: StackFit.expand,
              children: [
                OptimizedNetworkImage(
                  imageUrl: detail.imageUrl,
                  width: double.infinity,
                  height: 280,
                  semanticLabel: detail.name,
                  fallbackIconSize: 48,
                ),
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.transparent,
                        Color(0x1A000000),
                        Color(0xCC000000),
                      ],
                      stops: [0.35, 0.6, 1],
                    ),
                  ),
                ),
                Positioned(
                  left: 20,
                  right: 20,
                  bottom: 22,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        detail.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.screenTitle.copyWith(
                          color: Colors.white,
                          fontSize: 26,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          _HeroBadge(
                            icon: Icons.verified_rounded,
                            label: detail.trustScore == null
                                ? 'Trust mới'
                                : 'Trust ${detail.trustScore!.toStringAsFixed(1)}',
                          ),
                          _HeroBadge(
                            icon: Icons.receipt_long_rounded,
                            label:
                                '${detail.verifiedReviewCount} review xác thực',
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (detail.address != null)
                  _InformationRow(
                    icon: Icons.location_on_outlined,
                    text: detail.address!,
                  ),
                if (detail.phoneNumber != null) ...[
                  const SizedBox(height: 12),
                  _InformationRow(
                    icon: Icons.phone_rounded,
                    text: detail.phoneNumber!,
                  ),
                ],
                const SizedBox(height: 20),
                Text(
                  'Về nhà hàng',
                  style: AppTypography.sectionTitle.copyWith(
                    color: AppTypography.ink,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  detail.description ?? 'Nhà hàng chưa cập nhật mô tả.',
                  style: AppTypography.body.copyWith(
                    color: const Color(0xFF30343B),
                    fontWeight: FontWeight.w700,
                    height: 1.55,
                  ),
                ),
                const SizedBox(height: 28),
                Text(
                  'Điểm đánh giá',
                  style: AppTypography.sectionTitle.copyWith(
                    color: AppTypography.ink,
                  ),
                ),
                const SizedBox(height: 12),
                _RatingSummaryCard(breakdown: detail.ratingBreakdown),
                const SizedBox(height: 32),
                const _SectionHeading(
                  icon: Icons.restaurant_outlined,
                  title: 'Thực đơn điện tử',
                  subtitle: 'Giá mặc định do nhà hàng cung cấp',
                ),
                const SizedBox(height: 14),
                FutureBuilder<List<HomeMenuItem>>(
                  future: menu,
                  builder: (context, snapshot) {
                    if (snapshot.connectionState != ConnectionState.done) {
                      return const _MenuLoading();
                    }
                    if (snapshot.hasError) {
                      return _MenuError(onRetry: _retryMenu);
                    }
                    final items = snapshot.requireData;
                    if (items.isEmpty) {
                      return const _MenuEmpty();
                    }
                    return _MenuList(items: items);
                  },
                ),
                const SizedBox(height: 34),
                _ReviewCallToAction(onPressed: _openReviewFlow),
                const SizedBox(height: 30),
                FutureBuilder<HomeRestaurantReviewPage>(
                  future: reviews,
                  builder: (context, snapshot) {
                    final page = snapshot.data;
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _CommentsHeader(total: page?.total),
                        const SizedBox(height: 14),
                        if (snapshot.connectionState != ConnectionState.done)
                          const _ReviewsLoading()
                        else if (snapshot.hasError)
                          _ReviewsError(onRetry: _retryReviews)
                        else if (page!.items.isEmpty)
                          const _ReviewsEmpty()
                        else
                          _RestaurantReviewList(
                            items: page.items,
                            isSignedIn: widget.isSignedIn,
                            onLogin: widget.onLogin,
                            repository:
                                widget.reviewReactionRepository ??
                                ReviewReactionService(apiClient: appApiClient),
                            safetyRepository: _safetyRepository,
                          ),
                      ],
                    );
                  },
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _ReviewCallToAction extends StatelessWidget {
  const _ReviewCallToAction({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFEEE5),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.rate_review_rounded,
            color: HomeColors.brand,
            size: 28,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Bạn đã trải nghiệm quán?',
                  style: AppTypography.bodyStrong.copyWith(
                    color: AppTypography.ink,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  'Đăng bình luận ngay, hóa đơn là tùy chọn.',
                  style: AppTypography.caption.copyWith(
                    color: const Color(0xFF4B5563),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          FilledButton(
            key: const ValueKey('write-review-button'),
            onPressed: onPressed,
            style: FilledButton.styleFrom(
              backgroundColor: HomeColors.brand,
              padding: const EdgeInsets.symmetric(horizontal: 14),
            ),
            child: const Text('Viết đánh giá'),
          ),
        ],
      ),
    );
  }
}

class _SectionHeading extends StatelessWidget {
  const _SectionHeading({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 26,
          child: Icon(icon, color: HomeColors.brand, size: 24),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: AppTypography.sectionTitle.copyWith(
                  color: AppTypography.ink,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                subtitle,
                style: AppTypography.caption.copyWith(
                  color: const Color(0xFF4B5563),
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _CommentsHeader extends StatelessWidget {
  const _CommentsHeader({required this.total});

  final int? total;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Bình luận từ cộng đồng',
          style: AppTypography.sectionTitle.copyWith(color: AppTypography.ink),
        ),
        const SizedBox(height: 5),
        Text(
          total == null
              ? 'Đang tải đánh giá công khai'
              : '$total đánh giá công khai',
          style: AppTypography.caption.copyWith(
            color: const Color(0xFF4B5563),
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

class _MenuLoading extends StatelessWidget {
  const _MenuLoading();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      key: ValueKey('restaurant-menu-loading'),
      height: 96,
      child: Center(child: CircularProgressIndicator(color: HomeColors.brand)),
    );
  }
}

class _MenuError extends StatelessWidget {
  const _MenuError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const ValueKey('restaurant-menu-error'),
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFF0F0F2)),
      ),
      child: Column(
        children: [
          const Icon(Icons.cloud_off_rounded, color: HomeColors.muted),
          const SizedBox(height: 8),
          const Text(
            'Không thể tải thực đơn.',
            style: AppTypography.bodyStrong,
          ),
          TextButton(onPressed: onRetry, child: const Text('Thử lại thực đơn')),
        ],
      ),
    );
  }
}

class _MenuEmpty extends StatelessWidget {
  const _MenuEmpty();

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const ValueKey('restaurant-menu-empty'),
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFF0F0F2)),
      ),
      child: Text(
        'Nhà hàng chưa cập nhật thực đơn.',
        textAlign: TextAlign.center,
        style: AppTypography.bodyStrong.copyWith(
          color: const Color(0xFF374151),
        ),
      ),
    );
  }
}

class _MenuList extends StatelessWidget {
  const _MenuList({required this.items});

  final List<HomeMenuItem> items;

  @override
  Widget build(BuildContext context) {
    return Column(
      key: const ValueKey('restaurant-menu-list'),
      children: [
        for (var index = 0; index < items.length; index++) ...[
          _MenuItemCard(item: items[index]),
          if (index != items.length - 1) const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class _MenuItemCard extends StatelessWidget {
  const _MenuItemCard({required this.item});

  final HomeMenuItem item;

  String _formatPrice() {
    final wholePrice = item.price.round().toString();
    final buffer = StringBuffer();
    for (var index = 0; index < wholePrice.length; index++) {
      if (index > 0 && (wholePrice.length - index) % 3 == 0) {
        buffer.write('.');
      }
      buffer.write(wholePrice[index]);
    }
    return item.currency == 'VND'
        ? '${buffer.toString()} ₫'
        : '${buffer.toString()} ${item.currency}';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFF0F0F2)),
      ),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: const Color(0xFFFFF4ED),
              borderRadius: BorderRadius.circular(15),
            ),
            child: const Icon(
              Icons.ramen_dining_rounded,
              color: HomeColors.brand,
            ),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Text(
              item.name,
              style: AppTypography.bodyStrong,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: 12),
          Text(
            _formatPrice(),
            style: AppTypography.bodyStrong.copyWith(color: HomeColors.brand),
          ),
        ],
      ),
    );
  }
}

class _ReviewsLoading extends StatelessWidget {
  const _ReviewsLoading();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      key: ValueKey('restaurant-reviews-loading'),
      height: 84,
      child: Center(child: CircularProgressIndicator(color: HomeColors.brand)),
    );
  }
}

class _ReviewsError extends StatelessWidget {
  const _ReviewsError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const ValueKey('restaurant-reviews-error'),
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFEDEEF1)),
      ),
      child: Column(
        children: [
          const Icon(Icons.forum_outlined, color: HomeColors.muted),
          const SizedBox(height: 8),
          Text(
            'Không thể tải bình luận.',
            style: AppTypography.bodyStrong.copyWith(color: AppTypography.ink),
          ),
          TextButton(
            onPressed: onRetry,
            child: const Text('Thử lại bình luận'),
          ),
        ],
      ),
    );
  }
}

class _ReviewsEmpty extends StatelessWidget {
  const _ReviewsEmpty();

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const ValueKey('restaurant-reviews-empty'),
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFEDEEF1)),
      ),
      child: Text(
        'Chưa có bình luận công khai.',
        textAlign: TextAlign.center,
        style: AppTypography.bodyStrong.copyWith(
          color: const Color(0xFF374151),
        ),
      ),
    );
  }
}

class _RestaurantReviewList extends StatelessWidget {
  const _RestaurantReviewList({
    required this.items,
    required this.isSignedIn,
    required this.onLogin,
    required this.repository,
    required this.safetyRepository,
  });

  final List<HomeRestaurantReview> items;
  final bool isSignedIn;
  final Future<bool> Function() onLogin;
  final ReviewReactionRepository repository;
  final ProfileManagementRepository safetyRepository;

  @override
  Widget build(BuildContext context) {
    return Column(
      key: const ValueKey('restaurant-reviews-list'),
      children: [
        for (var index = 0; index < items.length; index++) ...[
          _RestaurantReviewCard(
            review: items[index],
            isSignedIn: isSignedIn,
            onLogin: onLogin,
            repository: repository,
            safetyRepository: safetyRepository,
          ),
          if (index != items.length - 1) const SizedBox(height: 18),
        ],
      ],
    );
  }
}

class _RestaurantReviewCard extends StatefulWidget {
  const _RestaurantReviewCard({
    required this.review,
    required this.isSignedIn,
    required this.onLogin,
    required this.repository,
    required this.safetyRepository,
  });

  final HomeRestaurantReview review;
  final bool isSignedIn;
  final Future<bool> Function() onLogin;
  final ReviewReactionRepository repository;
  final ProfileManagementRepository safetyRepository;

  @override
  State<_RestaurantReviewCard> createState() => _RestaurantReviewCardState();
}

class _RestaurantReviewCardState extends State<_RestaurantReviewCard> {
  static const _collapsedCommentLines = 5;
  static const _longCommentThreshold = 180;

  bool _isExpanded = false;
  ReviewReactionType? _reaction;
  late ReviewReactionCounts _reactionCounts;
  bool _reactionInFlight = false;
  late bool _isSignedIn;
  bool _authorBlocked = false;

  HomeRestaurantReview get review => widget.review;

  @override
  void initState() {
    super.initState();
    _reactionCounts = review.reactionCounts;
    _isSignedIn = widget.isSignedIn;
  }

  String _formatTime() {
    final date = review.visitedAt ?? review.createdAt;
    final difference = DateTime.now().toUtc().difference(date);
    if (difference.inDays <= 0) return 'Hôm nay';
    if (difference.inDays == 1) return 'Hôm qua';
    if (difference.inDays < 7) return '${difference.inDays} ngày trước';
    if (difference.inDays < 28) {
      return '${(difference.inDays / 7).floor()} tuần trước';
    }
    return '${date.day.toString().padLeft(2, '0')}/'
        '${date.month.toString().padLeft(2, '0')}/${date.year}';
  }

  Future<void> _showReactionPicker(LongPressStartDetails _) async {
    final screenSize = MediaQuery.sizeOf(context);
    final cardBox = context.findRenderObject()! as RenderBox;
    final cardOrigin = cardBox.localToGlobal(Offset.zero);
    const pickerWidth = 120.0;
    const pickerHeight = 40.0;
    final left = (cardOrigin.dx + 50).clamp(
      8.0,
      screenSize.width - pickerWidth - 8,
    );
    final top = (cardOrigin.dy + cardBox.size.height + 4).clamp(
      8.0,
      screenSize.height - pickerHeight - 8,
    );

    final selected = await showGeneralDialog<ReviewReactionType>(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'Đóng lựa chọn cảm xúc',
      barrierColor: Colors.transparent,
      transitionDuration: const Duration(milliseconds: 190),
      pageBuilder: (dialogContext, animation, secondaryAnimation) {
        return Stack(
          children: [
            Positioned(
              left: left,
              top: top,
              child: Material(
                color: Colors.white,
                elevation: 8,
                shadowColor: const Color(0x33000000),
                borderRadius: BorderRadius.circular(999),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 4,
                    vertical: 2,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: ReviewReactionType.values
                        .map((reaction) {
                          return Semantics(
                            button: true,
                            label: reaction.label,
                            child: InkResponse(
                              radius: 18,
                              onTap: () =>
                                  Navigator.of(dialogContext).pop(reaction),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 5,
                                  vertical: 2,
                                ),
                                child: Text(
                                  reaction.emoji,
                                  style: const TextStyle(fontSize: 20),
                                ),
                              ),
                            ),
                          );
                        })
                        .toList(growable: false),
                  ),
                ),
              ),
            ),
          ],
        );
      },
      transitionBuilder: (context, animation, secondaryAnimation, child) {
        final fadeAnimation = CurvedAnimation(
          parent: animation,
          curve: Curves.easeOut,
          reverseCurve: Curves.easeIn,
        );
        final popAnimation = CurvedAnimation(
          parent: animation,
          curve: Curves.easeOutBack,
          reverseCurve: Curves.easeInCubic,
        );
        return FadeTransition(
          opacity: fadeAnimation,
          child: SlideTransition(
            position: Tween<Offset>(
              begin: const Offset(0, -0.12),
              end: Offset.zero,
            ).animate(fadeAnimation),
            child: ScaleTransition(
              scale: Tween<double>(begin: 0.72, end: 1).animate(popAnimation),
              alignment: Alignment.topLeft,
              child: child,
            ),
          ),
        );
      },
    );

    if (selected != null && mounted) await _persistReaction(selected);
  }

  Future<void> _persistReaction(ReviewReactionType selected) async {
    if (_reactionInFlight) return;
    if (!_isSignedIn) {
      _isSignedIn = await widget.onLogin();
    }
    if (!_isSignedIn || !mounted) return;

    final previousReaction = _reaction;
    final previousCounts = _reactionCounts;
    final nextReaction = selected == previousReaction ? null : selected;
    setState(() {
      _reactionInFlight = true;
      _reaction = nextReaction;
      _reactionCounts = _optimisticCounts(
        previousCounts,
        previousReaction,
        nextReaction,
      );
    });

    try {
      final result = nextReaction == null
          ? await widget.repository.removeReaction(review.id)
          : await widget.repository.setReaction(
              reviewId: review.id,
              reaction: nextReaction,
            );
      if (!mounted) return;
      setState(() {
        _reaction = result.myReaction;
        _reactionCounts = result.reactionCounts;
      });
    } on Exception {
      if (!mounted) return;
      setState(() {
        _reaction = previousReaction;
        _reactionCounts = previousCounts;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Không thể lưu cảm xúc. Vui lòng thử lại.'),
        ),
      );
    } finally {
      if (mounted) setState(() => _reactionInFlight = false);
    }
  }

  Future<bool> _requireSignIn() async {
    if (_isSignedIn) return true;
    _isSignedIn = await widget.onLogin();
    return _isSignedIn;
  }

  Future<void> _reportReview() async {
    if (!await _requireSignIn() || !mounted) return;
    final input = await showReportComposer(
      context,
      entityType: ReportEntityType.review,
    );
    if (input == null || !mounted) return;
    try {
      await widget.safetyRepository.submitReport(
        entityType: ReportEntityType.review,
        entityId: review.id,
        reasonCode: input.reasonCode,
        description: input.description,
      );
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Đã gửi báo cáo review.')));
      }
    } on Exception {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Không thể gửi báo cáo review.')),
        );
      }
    }
  }

  Future<void> _toggleBlockAuthor() async {
    if (!await _requireSignIn() || !mounted) return;
    try {
      if (_authorBlocked) {
        await widget.safetyRepository.unblockReviewAuthor(review.id);
      } else {
        await widget.safetyRepository.blockReviewAuthor(review.id);
      }
      if (!mounted) return;
      setState(() => _authorBlocked = !_authorBlocked);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _authorBlocked ? 'Đã chặn tác giả review.' : 'Đã bỏ chặn tác giả.',
          ),
        ),
      );
    } on Exception {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Không thể cập nhật trạng thái chặn.')),
        );
      }
    }
  }

  ReviewReactionCounts _optimisticCounts(
    ReviewReactionCounts current,
    ReviewReactionType? previous,
    ReviewReactionType? next,
  ) {
    int adjusted(ReviewReactionType type) {
      var count = current.forType(type);
      if (previous == type) count = (count - 1).clamp(0, 1 << 31);
      if (next == type) count += 1;
      return count;
    }

    return ReviewReactionCounts(
      love: adjusted(ReviewReactionType.love),
      haha: adjusted(ReviewReactionType.haha),
      angry: adjusted(ReviewReactionType.angry),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isVerified = review.status == 'VERIFIED';
    final isLongComment = review.comment.runes.length > _longCommentThreshold;
    final avatarUrl = review.reviewerAvatarUrl?.trim();
    final avatarImage = avatarUrl == null || avatarUrl.isEmpty
        ? null
        : NetworkImage(avatarUrl);
    return Semantics(
      label:
          '${review.reviewerDisplayName}, đánh giá '
          '${review.averageRating.toStringAsFixed(1)} trên 5, '
          '${isVerified ? 'đã xác thực' : 'tham khảo'}',
      child: GestureDetector(
        key: ValueKey('review-reaction-target-${review.id}'),
        behavior: HitTestBehavior.opaque,
        onLongPressStart: _showReactionPicker,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              key: ValueKey('reviewer-avatar-${review.id}'),
              radius: 20,
              backgroundColor: const Color(0xFFE4E6EB),
              foregroundImage: avatarImage,
              onForegroundImageError: avatarImage == null
                  ? null
                  : (exception, stackTrace) {},
              child: const Icon(
                Icons.person_rounded,
                size: 24,
                color: Color(0xFF65676B),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    key: const ValueKey('restaurant-review-bubble'),
                    width: double.infinity,
                    padding: const EdgeInsets.fromLTRB(14, 11, 14, 12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0F2F5),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                review.reviewerDisplayName,
                                style: AppTypography.bodyStrong.copyWith(
                                  color: AppTypography.ink,
                                ),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 7,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(
                                    Icons.star_rounded,
                                    color: HomeColors.brand,
                                    size: 14,
                                  ),
                                  const SizedBox(width: 3),
                                  Text(
                                    review.averageRating.toStringAsFixed(1),
                                    style: AppTypography.tiny.copyWith(
                                      color: AppTypography.ink,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            PopupMenuButton<String>(
                              key: ValueKey('review-safety-menu-${review.id}'),
                              tooltip: 'Tùy chọn an toàn',
                              icon: const Icon(
                                Icons.more_horiz_rounded,
                                size: 20,
                              ),
                              onSelected: (value) {
                                if (value == 'report') _reportReview();
                                if (value == 'block') _toggleBlockAuthor();
                              },
                              itemBuilder: (_) => [
                                const PopupMenuItem(
                                  value: 'report',
                                  child: Text('Báo cáo review'),
                                ),
                                PopupMenuItem(
                                  value: 'block',
                                  child: Text(
                                    _authorBlocked
                                        ? 'Bỏ chặn tác giả'
                                        : 'Chặn tác giả',
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          review.comment,
                          maxLines: isLongComment && !_isExpanded
                              ? _collapsedCommentLines
                              : null,
                          overflow: isLongComment && !_isExpanded
                              ? TextOverflow.ellipsis
                              : TextOverflow.visible,
                          style: AppTypography.body.copyWith(
                            color: const Color(0xFF30343B),
                            fontWeight: FontWeight.w700,
                            height: 1.42,
                          ),
                        ),
                        if (isLongComment) ...[
                          const SizedBox(height: 5),
                          GestureDetector(
                            onTap: () =>
                                setState(() => _isExpanded = !_isExpanded),
                            child: Text(
                              _isExpanded ? 'Xem bớt' : 'Xem thêm',
                              style: AppTypography.caption.copyWith(
                                color: const Color(0xFF4B5563),
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 7),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    child: Row(
                      children: [
                        Text(
                          _formatTime(),
                          style: AppTypography.tiny.copyWith(
                            color: const Color(0xFF4B5563),
                          ),
                        ),
                        for (final reaction in ReviewReactionType.values)
                          if (_reactionCounts.forType(reaction) > 0) ...[
                            const SizedBox(width: 6),
                            Container(
                              key: _reaction == reaction
                                  ? ValueKey('selected-reaction-${review.id}')
                                  : ValueKey(
                                      'reaction-count-${review.id}-${reaction.apiValue}',
                                    ),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(999),
                                border: _reaction == reaction
                                    ? Border.all(color: const Color(0xFFD6D9DE))
                                    : null,
                                boxShadow: const [
                                  BoxShadow(
                                    color: Color(0x14000000),
                                    blurRadius: 6,
                                    offset: Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: Text(
                                '${reaction.emoji} ${_reactionCounts.forType(reaction)}',
                                style: const TextStyle(fontSize: 12),
                              ),
                            ),
                          ],
                        const Spacer(),
                        Icon(
                          isVerified
                              ? Icons.verified_rounded
                              : Icons.info_outline_rounded,
                          size: 14,
                          color: isVerified
                              ? const Color(0xFF16803B)
                              : HomeColors.muted,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          isVerified ? 'Đã xác thực' : 'Đánh giá tham khảo',
                          style: AppTypography.tiny.copyWith(
                            color: isVerified
                                ? const Color(0xFF16803B)
                                : const Color(0xFF4B5563),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeroBadge extends StatelessWidget {
  const _HeroBadge({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: HomeColors.brand),
          const SizedBox(width: 5),
          Text(
            label,
            style: AppTypography.tiny.copyWith(color: AppTypography.ink),
          ),
        ],
      ),
    );
  }
}

class _InformationRow extends StatelessWidget {
  const _InformationRow({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        SizedBox(
          width: 24,
          child: Icon(icon, color: HomeColors.brand, size: 22),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: AppTypography.bodyStrong.copyWith(color: AppTypography.ink),
          ),
        ),
      ],
    );
  }
}

class _RatingSummaryCard extends StatelessWidget {
  const _RatingSummaryCard({required this.breakdown});

  final RestaurantRatingBreakdown breakdown;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const ValueKey('rating-summary-card'),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFEDEEF1)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A111827),
            blurRadius: 18,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              const Icon(Icons.star_rounded, color: HomeColors.brand, size: 28),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      breakdown.averageOverall == null
                          ? 'Mới'
                          : breakdown.averageOverall!.toStringAsFixed(1),
                      style: AppTypography.screenTitle.copyWith(
                        color: AppTypography.ink,
                        fontSize: 24,
                      ),
                    ),
                    Text(
                      'Điểm tổng quan',
                      style: AppTypography.caption.copyWith(
                        color: const Color(0xFF4B5563),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 7,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFF6F7F9),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  '${breakdown.reviewCount} lượt công khai',
                  style: AppTypography.tiny.copyWith(
                    color: const Color(0xFF4B5563),
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Divider(height: 1, color: Color(0xFFEDEEF1)),
          const SizedBox(height: 4),
          IntrinsicHeight(
            child: Row(
              children: [
                Expanded(
                  child: _RatingMetric(
                    label: 'Món ăn',
                    value: breakdown.averageFood,
                  ),
                ),
                const VerticalDivider(
                  width: 1,
                  thickness: 1,
                  color: Color(0xFFEDEEF1),
                ),
                Expanded(
                  child: _RatingMetric(
                    label: 'Giá cả',
                    value: breakdown.averagePrice,
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFEDEEF1)),
          IntrinsicHeight(
            child: Row(
              children: [
                Expanded(
                  child: _RatingMetric(
                    label: 'Phục vụ',
                    value: breakdown.averageService,
                  ),
                ),
                const VerticalDivider(
                  width: 1,
                  thickness: 1,
                  color: Color(0xFFEDEEF1),
                ),
                Expanded(
                  child: _RatingMetric(
                    label: 'Không gian',
                    value: breakdown.averageAmbience,
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

class _RatingMetric extends StatelessWidget {
  const _RatingMetric({required this.label, required this.value});

  final String label;
  final double? value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.caption.copyWith(
                color: const Color(0xFF4B5563),
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            value == null ? 'Mới' : value!.toStringAsFixed(1),
            style: AppTypography.title.copyWith(
              color: value == null ? AppTypography.ink : HomeColors.brand,
            ),
          ),
        ],
      ),
    );
  }
}

class ReportComposerResult {
  const ReportComposerResult({
    required this.reasonCode,
    required this.description,
  });

  final String reasonCode;
  final String? description;
}

Future<ReportComposerResult?> showReportComposer(
  BuildContext context, {
  required ReportEntityType entityType,
}) {
  final reasons = entityType == ReportEntityType.review
      ? const {
          'SPAM_OR_FAKE': 'Spam hoặc giả mạo',
          'OFFENSIVE_CONTENT': 'Nội dung xúc phạm',
          'IRRELEVANT_CONTENT': 'Không liên quan',
          'OTHER_REVIEW': 'Lý do khác',
        }
      : const {
          'INCORRECT_INFO': 'Thông tin không chính xác',
          'CLOSED_OR_NONEXISTENT': 'Đã đóng hoặc không tồn tại',
          'INAPPROPRIATE_LISTING': 'Thông tin đăng không phù hợp',
          'OTHER_RESTAURANT': 'Lý do khác',
        };

  return showModalBottomSheet<ReportComposerResult>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    builder: (sheetContext) => _ReportComposerSheet(reasons: reasons),
  );
}

class _ReportComposerSheet extends StatefulWidget {
  const _ReportComposerSheet({required this.reasons});

  final Map<String, String> reasons;

  @override
  State<_ReportComposerSheet> createState() => _ReportComposerSheetState();
}

class _ReportComposerSheetState extends State<_ReportComposerSheet> {
  late String _reasonCode = widget.reasons.keys.first;
  final _descriptionController = TextEditingController();

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          18,
          20,
          20 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Gửi báo cáo', style: AppTypography.sectionTitle),
            const SizedBox(height: 14),
            DropdownButtonFormField<String>(
              key: const ValueKey('report-reason-field'),
              initialValue: _reasonCode,
              decoration: const InputDecoration(labelText: 'Lý do'),
              items: [
                for (final reason in widget.reasons.entries)
                  DropdownMenuItem(
                    value: reason.key,
                    child: Text(reason.value),
                  ),
              ],
              onChanged: (value) {
                if (value != null) setState(() => _reasonCode = value);
              },
            ),
            const SizedBox(height: 14),
            TextField(
              key: const ValueKey('report-description-field'),
              controller: _descriptionController,
              maxLength: 1000,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Mô tả thêm (không bắt buộc)',
              ),
            ),
            const SizedBox(height: 10),
            FilledButton(
              key: const ValueKey('submit-report-button'),
              onPressed: () => Navigator.of(context).pop(
                ReportComposerResult(
                  reasonCode: _reasonCode,
                  description: _descriptionController.text.trim().isEmpty
                      ? null
                      : _descriptionController.text.trim(),
                ),
              ),
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(50),
                backgroundColor: HomeColors.brand,
              ),
              child: const Text('Gửi báo cáo'),
            ),
          ],
        ),
      ),
    );
  }
}
