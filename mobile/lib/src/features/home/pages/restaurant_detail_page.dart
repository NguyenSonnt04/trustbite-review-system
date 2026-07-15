import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/common/widgets/optimized_network_image.dart';
import 'package:trustbite_mobile/src/core/auth/app_auth.dart';
import 'package:trustbite_mobile/src/core/theme/app_typography.dart';
import 'package:trustbite_mobile/src/features/home/data/restaurant_discovery_service.dart';
import 'package:trustbite_mobile/src/features/home/home_tokens.dart';
import 'package:trustbite_mobile/src/features/home/models/home_models.dart';
import 'package:trustbite_mobile/src/features/reviews/review_creation_page.dart';
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
  });

  final String restaurantId;
  final RestaurantDiscoveryRepository repository;
  final HomeRestaurant initialRestaurant;
  final bool isSignedIn;
  final Future<bool> Function() onLogin;
  final ReviewSubmissionRepository? reviewRepository;
  final ReceiptPicker? receiptPicker;

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
  });

  final HomeRestaurantDetail detail;
  final String restaurantId;
  final RestaurantDiscoveryRepository repository;
  final bool isSignedIn;
  final Future<bool> Function() onLogin;
  final ReviewSubmissionRepository? reviewRepository;
  final ReceiptPicker? receiptPicker;

  @override
  State<_DetailContent> createState() => _DetailContentState();
}

class _DetailContentState extends State<_DetailContent> {
  Future<List<HomeMenuItem>>? _menu;
  Future<HomeRestaurantReviewPage>? _reviews;

  HomeRestaurantDetail get detail => widget.detail;

  @override
  void initState() {
    super.initState();
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
                    icon: Icons.place_rounded,
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
                  icon: Icons.restaurant_menu_rounded,
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
                          _RestaurantReviewList(items: page.items),
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
        Container(
          width: 42,
          height: 42,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: HomeColors.brand.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Icon(icon, color: HomeColors.brand, size: 21),
        ),
        const SizedBox(width: 12),
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
  const _RestaurantReviewList({required this.items});

  final List<HomeRestaurantReview> items;

  @override
  Widget build(BuildContext context) {
    return Column(
      key: const ValueKey('restaurant-reviews-list'),
      children: [
        for (var index = 0; index < items.length; index++) ...[
          _RestaurantReviewCard(review: items[index]),
          if (index != items.length - 1) const SizedBox(height: 18),
        ],
      ],
    );
  }
}

class _RestaurantReviewCard extends StatelessWidget {
  const _RestaurantReviewCard({required this.review});

  final HomeRestaurantReview review;

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

  @override
  Widget build(BuildContext context) {
    final isVerified = review.status == 'VERIFIED';
    return Semantics(
      label:
          '${review.reviewerDisplayName}, đánh giá '
          '${review.averageRating.toStringAsFixed(1)} trên 5, '
          '${isVerified ? 'đã xác thực' : 'tham khảo'}',
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: HomeColors.brand.withValues(alpha: 0.12),
            child: Icon(
              isVerified
                  ? Icons.verified_user_rounded
                  : Icons.rate_review_outlined,
              size: 18,
              color: HomeColors.brand,
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
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        review.comment,
                        style: AppTypography.body.copyWith(
                          color: const Color(0xFF30343B),
                          fontWeight: FontWeight.w700,
                          height: 1.42,
                        ),
                      ),
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
        Container(
          width: 34,
          height: 34,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: HomeColors.brand.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(11),
          ),
          child: Icon(icon, color: HomeColors.brand, size: 18),
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
              Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: const Color(0xFFFFEEE5),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(
                  Icons.star_rounded,
                  color: HomeColors.brand,
                  size: 24,
                ),
              ),
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
