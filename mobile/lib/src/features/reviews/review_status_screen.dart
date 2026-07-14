import 'dart:async';

import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/core/auth/app_auth.dart';
import 'package:trustbite_mobile/src/features/home/home_tokens.dart';
import 'package:trustbite_mobile/src/features/reviews/data/review_service.dart';

class ReviewStatusScreen extends StatefulWidget {
  const ReviewStatusScreen({
    super.key,
    required this.reviewId,
    required this.restaurantName,
    this.reviewService,
    this.pollInterval = const Duration(seconds: 3),
  });

  final String reviewId;
  final String restaurantName;
  final ReviewService? reviewService;
  final Duration pollInterval;

  @override
  State<ReviewStatusScreen> createState() => _ReviewStatusScreenState();
}

class _ReviewStatusScreenState extends State<ReviewStatusScreen> {
  Timer? _timer;
  Map<String, dynamic>? _status;
  String? _error;
  bool _loading = true;

  ReviewService get _reviewService => widget.reviewService ?? appReviewService;

  @override
  void initState() {
    super.initState();
    _loadStatus();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _loadStatus() async {
    _timer?.cancel();
    try {
      final status = await _reviewService.getReviewStatus(widget.reviewId);
      if (!mounted) return;
      setState(() {
        _status = status;
        _error = null;
        _loading = false;
      });
      if (!_isTerminal(status['status'] as String?)) {
        _timer = Timer(widget.pollInterval, _loadStatus);
      }
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error is ApiException
            ? error.message
            : 'Không thể cập nhật trạng thái xác minh.';
      });
    }
  }

  bool _isTerminal(String? status) {
    return const {
      'VERIFIED',
      'REJECTED',
      'REFERENCE_ONLY',
      'PENDING_ADMIN_REVIEW',
    }.contains(status);
  }

  @override
  Widget build(BuildContext context) {
    final status = _status?['status'] as String?;
    final presentation = _presentation(status);
    return Scaffold(
      backgroundColor: const Color(0xFFF7F4F2),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF7F4F2),
        surfaceTintColor: Colors.transparent,
        title: const Text(
          'Trạng thái đánh giá',
          style: TextStyle(fontWeight: FontWeight.w900),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              const Spacer(),
              Container(
                width: 92,
                height: 92,
                decoration: BoxDecoration(
                  color: presentation.background,
                  shape: BoxShape.circle,
                ),
                child: _loading
                    ? const Padding(
                        padding: EdgeInsets.all(30),
                        child: CircularProgressIndicator(
                          strokeWidth: 3,
                          color: HomeColors.brand,
                        ),
                      )
                    : Icon(
                        presentation.icon,
                        size: 44,
                        color: presentation.foreground,
                      ),
              ),
              const SizedBox(height: 24),
              Text(
                presentation.title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                widget.restaurantName,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: HomeColors.brand,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                _error ?? presentation.description,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: _error == null
                      ? const Color(0xFF746A65)
                      : const Color(0xFF9F2018),
                  height: 1.45,
                ),
              ),
              const Spacer(),
              if (_error != null)
                OutlinedButton.icon(
                  onPressed: _loadStatus,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Thử lại'),
                ),
              const SizedBox(height: 10),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(),
                style: FilledButton.styleFrom(
                  backgroundColor: HomeColors.brand,
                  minimumSize: const Size.fromHeight(52),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(17),
                  ),
                ),
                child: const Text(
                  'Về trang chủ',
                  style: TextStyle(fontWeight: FontWeight.w900),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  _StatusPresentation _presentation(String? status) {
    return switch (status) {
      'VERIFIED' => const _StatusPresentation(
        icon: Icons.verified_rounded,
        title: 'Đánh giá đã được xác minh',
        description:
            'Đánh giá của bạn đã đủ bằng chứng và có thể hiển thị công khai.',
        foreground: Color(0xFF2E7D32),
        background: Color(0xFFDDF0DA),
      ),
      'REJECTED' || 'REFERENCE_ONLY' => const _StatusPresentation(
        icon: Icons.lock_outline_rounded,
        title: 'Đánh giá không được công khai',
        description:
            'Bằng chứng chưa đạt yêu cầu xác minh. Nội dung vẫn được giữ riêng tư.',
        foreground: Color(0xFF9F2018),
        background: Color(0xFFFFE2DF),
      ),
      'PENDING_ADMIN_REVIEW' => const _StatusPresentation(
        icon: Icons.manage_search_rounded,
        title: 'Đang chờ kiểm tra',
        description:
            'Hệ thống cần kiểm tra thêm. Đánh giá chưa được hiển thị công khai.',
        foreground: Color(0xFF8A5A00),
        background: Color(0xFFFFEDC2),
      ),
      _ => const _StatusPresentation(
        icon: Icons.hourglass_top_rounded,
        title: 'Đang xác minh bằng chứng',
        description:
            'TrustBite đang đối chiếu hóa đơn, vị trí GPS và thông tin quán.',
        foreground: HomeColors.brand,
        background: Color(0xFFFFE8DF),
      ),
    };
  }
}

class _StatusPresentation {
  const _StatusPresentation({
    required this.icon,
    required this.title,
    required this.description,
    required this.foreground,
    required this.background,
  });

  final IconData icon;
  final String title;
  final String description;
  final Color foreground;
  final Color background;
}
