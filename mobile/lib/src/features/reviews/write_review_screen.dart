import 'dart:io';

import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/core/auth/app_auth.dart';
import 'package:trustbite_mobile/src/features/home/home_tokens.dart';
import 'package:trustbite_mobile/src/features/reviews/data/review_service.dart';
import 'package:trustbite_mobile/src/features/reviews/review_status_screen.dart';
import 'package:trustbite_mobile/src/features/reviews/services/review_evidence_services.dart';

class WriteReviewScreen extends StatefulWidget {
  const WriteReviewScreen({
    super.key,
    required this.restaurant,
    this.reviewService,
    this.receiptPicker,
    this.locationProvider,
  });

  final RestaurantSummary restaurant;
  final ReviewService? reviewService;
  final ReceiptImagePicker? receiptPicker;
  final ReviewLocationProvider? locationProvider;

  @override
  State<WriteReviewScreen> createState() => _WriteReviewScreenState();
}

class _WriteReviewScreenState extends State<WriteReviewScreen> {
  final _commentController = TextEditingController();
  final _ratings = <String, int>{
    'Món ăn': 5,
    'Giá cả': 5,
    'Phục vụ': 5,
    'Không gian': 5,
  };
  String? _receiptPath;
  ReviewLocation? _location;
  String? _createdReviewId;
  String? _idempotencyKey;
  bool _submitting = false;
  String? _error;

  ReviewService get _reviewService => widget.reviewService ?? appReviewService;
  ReceiptImagePicker get _receiptPicker =>
      widget.receiptPicker ?? DeviceReceiptImagePicker();
  ReviewLocationProvider get _locationProvider =>
      widget.locationProvider ?? DeviceReviewLocationProvider();

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _pickReceipt(bool camera) async {
    try {
      final path = camera
          ? await _receiptPicker.pickFromCamera()
          : await _receiptPicker.pickFromGallery();
      if (!mounted || path == null) return;
      setState(() {
        _receiptPath = path;
        _idempotencyKey = null;
        _error = null;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = _message(error));
    }
  }

  Future<void> _captureLocation() async {
    setState(() => _error = null);
    try {
      final location = await _locationProvider.getCurrentLocation();
      if (!mounted) return;
      setState(() {
        _location = location;
        _idempotencyKey = null;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = _message(error));
    }
  }

  Future<void> _submit() async {
    final comment = _commentController.text.trim();
    if (comment.length < 50) {
      setState(() => _error = 'Nội dung đánh giá cần ít nhất 50 ký tự.');
      return;
    }
    if (_receiptPath == null || _location == null) {
      setState(
        () => _error = 'Bạn cần cung cấp cả hóa đơn và vị trí GPS hiện tại.',
      );
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final reviewId =
          _createdReviewId ??
          await _reviewService.createReview(
            restaurantId: widget.restaurant.id,
            foodRating: _ratings['Món ăn']!,
            priceRating: _ratings['Giá cả']!,
            serviceRating: _ratings['Phục vụ']!,
            ambienceRating: _ratings['Không gian']!,
            comment: comment,
          );
      _createdReviewId = reviewId;
      final idempotencyKey =
          _idempotencyKey ?? _reviewService.createIdempotencyKey();
      _idempotencyKey = idempotencyKey;
      await _reviewService.uploadReceipt(
        reviewId: reviewId,
        restaurantId: widget.restaurant.id,
        receiptPath: _receiptPath!,
        location: _location!,
        idempotencyKey: idempotencyKey,
      );
      if (!mounted) return;
      await Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(
          builder: (_) => ReviewStatusScreen(
            reviewId: reviewId,
            restaurantName: widget.restaurant.name,
            reviewService: _reviewService,
          ),
        ),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = _message(error);
      });
    }
  }

  String _message(Object error) {
    if (error is ApiException) return error.message;
    if (error is StateError) return error.message;
    return 'Không thể gửi đánh giá. Vui lòng thử lại.';
  }

  @override
  Widget build(BuildContext context) {
    final commentLength = _commentController.text.trim().length;
    return Scaffold(
      backgroundColor: const Color(0xFFF7F4F2),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF7F4F2),
        surfaceTintColor: Colors.transparent,
        title: const Text(
          'Viết đánh giá',
          style: TextStyle(fontWeight: FontWeight.w900),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          children: [
            _TrustNotice(restaurantName: widget.restaurant.name),
            const SizedBox(height: 20),
            const _SectionTitle(
              title: 'Trải nghiệm của bạn',
              subtitle: 'Chấm điểm từng tiêu chí từ 1 đến 5.',
            ),
            const SizedBox(height: 12),
            for (final entry in _ratings.entries)
              _RatingRow(
                label: entry.key,
                value: entry.value,
                onChanged: (value) => setState(() {
                  _ratings[entry.key] = value;
                }),
              ),
            const SizedBox(height: 20),
            const _SectionTitle(
              title: 'Nội dung đánh giá',
              subtitle: 'Chia sẻ chi tiết giúp cộng đồng lựa chọn tốt hơn.',
            ),
            const SizedBox(height: 10),
            TextField(
              key: const ValueKey('review-comment-field'),
              controller: _commentController,
              minLines: 5,
              maxLines: 8,
              maxLength: 1000,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                hintText:
                    'Món ăn, giá cả, phục vụ và không gian có đúng kỳ vọng?',
                counterText: '$commentLength/50 ký tự tối thiểu',
                filled: true,
                fillColor: Colors.white,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(18),
                  borderSide: const BorderSide(color: Color(0xFFE5DED9)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(18),
                  borderSide: const BorderSide(color: Color(0xFFE5DED9)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(18),
                  borderSide: const BorderSide(
                    color: HomeColors.brand,
                    width: 1.5,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 20),
            const _SectionTitle(
              title: 'Bằng chứng bắt buộc',
              subtitle:
                  'Hóa đơn và GPS được backend xác minh trước khi công khai.',
            ),
            const SizedBox(height: 12),
            _EvidenceCard(
              icon: Icons.receipt_long_rounded,
              title: 'Hóa đơn',
              description: _receiptPath == null
                  ? 'Chụp hoặc chọn ảnh hóa đơn rõ nét.'
                  : 'Đã chọn hóa đơn.',
              complete: _receiptPath != null,
              previewPath: _receiptPath,
              actions: [
                TextButton.icon(
                  onPressed: _submitting ? null : () => _pickReceipt(true),
                  icon: const Icon(Icons.camera_alt_outlined),
                  label: const Text('Chụp'),
                ),
                TextButton.icon(
                  onPressed: _submitting ? null : () => _pickReceipt(false),
                  icon: const Icon(Icons.photo_library_outlined),
                  label: const Text('Thư viện'),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _EvidenceCard(
              icon: Icons.my_location_rounded,
              title: 'Vị trí GPS',
              description: _location == null
                  ? 'Ghi nhận vị trí hiện tại để đối chiếu với quán.'
                  : 'Đã ghi nhận GPS, sai số ${_location!.accuracyMeters.toStringAsFixed(0)} m.',
              complete: _location != null,
              actions: [
                TextButton.icon(
                  key: const ValueKey('capture-review-location'),
                  onPressed: _submitting ? null : _captureLocation,
                  icon: const Icon(Icons.gps_fixed_rounded),
                  label: Text(_location == null ? 'Lấy vị trí' : 'Cập nhật'),
                ),
              ],
            ),
            if (_error != null) ...[
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFECEA),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Text(
                  _error!,
                  style: const TextStyle(
                    color: Color(0xFF9F2018),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
            const SizedBox(height: 20),
            FilledButton.icon(
              key: const ValueKey('submit-review'),
              onPressed: _submitting ? null : _submit,
              style: FilledButton.styleFrom(
                backgroundColor: HomeColors.brand,
                foregroundColor: Colors.white,
                minimumSize: const Size.fromHeight(54),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(18),
                ),
              ),
              icon: _submitting
                  ? const SizedBox.square(
                      dimension: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.verified_user_outlined),
              label: Text(
                _submitting ? 'Đang gửi xác minh...' : 'Gửi để xác minh',
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TrustNotice extends StatelessWidget {
  const _TrustNotice({required this.restaurantName});

  final String restaurantName;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF23100B),
        borderRadius: BorderRadius.circular(22),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.shield_outlined, color: Color(0xFFFFB08F)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  restaurantName,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 5),
                const Text(
                  'Chỉ đánh giá đã xác minh mới được hiển thị công khai.',
                  style: TextStyle(color: Color(0xFFE9D8D1), height: 1.35),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 3),
        Text(subtitle, style: const TextStyle(color: Color(0xFF746A65))),
      ],
    );
  }
}

class _RatingRow extends StatelessWidget {
  const _RatingRow({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final int value;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFEAE3DF)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
          for (var rating = 1; rating <= 5; rating++)
            IconButton(
              visualDensity: VisualDensity.compact,
              tooltip: '$rating sao',
              onPressed: () => onChanged(rating),
              icon: Icon(
                rating <= value
                    ? Icons.star_rounded
                    : Icons.star_outline_rounded,
                color: HomeColors.brand,
              ),
            ),
        ],
      ),
    );
  }
}

class _EvidenceCard extends StatelessWidget {
  const _EvidenceCard({
    required this.icon,
    required this.title,
    required this.description,
    required this.complete,
    required this.actions,
    this.previewPath,
  });

  final IconData icon;
  final String title;
  final String description;
  final bool complete;
  final List<Widget> actions;
  final String? previewPath;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: complete ? const Color(0xFFF2F9F1) : Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: complete ? const Color(0xFFB8DDB4) : const Color(0xFFE5DED9),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (previewPath != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.file(
                File(previewPath!),
                width: 62,
                height: 62,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) =>
                    _EvidenceIcon(icon: icon, complete: complete),
              ),
            )
          else
            _EvidenceIcon(icon: icon, complete: complete),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                    ),
                    if (complete)
                      const Icon(
                        Icons.check_circle_rounded,
                        color: Color(0xFF2E7D32),
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  description,
                  style: const TextStyle(
                    color: Color(0xFF746A65),
                    height: 1.35,
                  ),
                ),
                Wrap(spacing: 4, children: actions),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _EvidenceIcon extends StatelessWidget {
  const _EvidenceIcon({required this.icon, required this.complete});

  final IconData icon;
  final bool complete;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: complete ? const Color(0xFFDDF0DA) : const Color(0xFFFFE8DF),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Icon(
        icon,
        color: complete ? const Color(0xFF2E7D32) : HomeColors.brand,
      ),
    );
  }
}
