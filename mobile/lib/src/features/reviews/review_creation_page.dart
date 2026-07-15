import 'dart:async';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:trustbite_mobile/src/core/theme/app_typography.dart';
import 'package:trustbite_mobile/src/features/home/home_tokens.dart';
import 'package:trustbite_mobile/src/features/reviews/review_submission_service.dart';

enum ReceiptSource { camera, gallery }

abstract interface class ReceiptPicker {
  Future<ReceiptFileData?> pick(ReceiptSource source);
}

class ImagePickerReceiptPicker implements ReceiptPicker {
  ImagePickerReceiptPicker({ImagePicker? picker})
    : _picker = picker ?? ImagePicker();

  final ImagePicker _picker;

  @override
  Future<ReceiptFileData?> pick(ReceiptSource source) async {
    final image = await _picker.pickImage(
      source: source == ReceiptSource.camera
          ? ImageSource.camera
          : ImageSource.gallery,
      imageQuality: 90,
      maxWidth: 2400,
    );
    if (image == null) return null;

    final extension = image.name.split('.').last.toLowerCase();
    final contentType = switch (extension) {
      'png' => 'image/png',
      'heic' => 'image/heic',
      'heif' => 'image/heif',
      _ => 'image/jpeg',
    };
    return ReceiptFileData(
      fileName: image.name,
      contentType: contentType,
      bytes: await image.readAsBytes(),
    );
  }
}

class ReviewCreationPage extends StatefulWidget {
  const ReviewCreationPage({
    super.key,
    required this.restaurantId,
    required this.restaurantName,
    required this.repository,
    required this.receiptPicker,
    this.pollInterval = const Duration(seconds: 4),
    this.maxPollAttempts = 60,
  });

  final String restaurantId;
  final String restaurantName;
  final ReviewSubmissionRepository repository;
  final ReceiptPicker receiptPicker;
  final Duration pollInterval;
  final int maxPollAttempts;

  @override
  State<ReviewCreationPage> createState() => _ReviewCreationPageState();
}

class _ReviewCreationPageState extends State<ReviewCreationPage> {
  final _commentController = TextEditingController();
  int _foodRating = 0;
  int _priceRating = 0;
  int _serviceRating = 0;
  int _ambienceRating = 0;
  ReceiptFileData? _receipt;
  bool _submitting = false;
  String? _error;
  String? _reviewId;
  ReviewIntent? _intent;
  String? _receiptIdempotencyKey;
  bool _receiptUploaded = false;
  bool _receiptVerificationSkipped = false;
  ReviewVerificationState? _status;
  Timer? _pollTimer;
  int _automaticPollAttempts = 0;
  bool _pollInFlight = false;
  bool _pollingExhausted = false;

  @override
  void dispose() {
    _pollTimer?.cancel();
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _pickReceipt(ReceiptSource source) async {
    try {
      final receipt = await widget.receiptPicker.pick(source);
      if (!mounted || receipt == null) return;
      setState(() {
        _receipt = receipt;
        _error = null;
      });
    } on Exception {
      if (!mounted) return;
      setState(() => _error = 'Không thể đọc ảnh hóa đơn đã chọn.');
    }
  }

  Future<void> _chooseReceipt() async {
    final source = await showModalBottomSheet<ReceiptSource>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.photo_camera_outlined),
                title: const Text('Chụp hóa đơn'),
                onTap: () => Navigator.of(context).pop(ReceiptSource.camera),
              ),
              ListTile(
                leading: const Icon(Icons.photo_library_outlined),
                title: const Text('Chọn từ thư viện'),
                onTap: () => Navigator.of(context).pop(ReceiptSource.gallery),
              ),
            ],
          ),
        ),
      ),
    );
    if (source != null) await _pickReceipt(source);
  }

  String? _validate() {
    if ([
      _foodRating,
      _priceRating,
      _serviceRating,
      _ambienceRating,
    ].any((rating) => rating == 0)) {
      return 'Vui lòng chấm đủ bốn tiêu chí.';
    }
    if (_commentController.text.trim().length < 50) {
      return 'Nội dung đánh giá phải có ít nhất 50 ký tự.';
    }
    return null;
  }

  Future<void> _submit() async {
    final validationError = _validate();
    if (validationError != null) {
      setState(() => _error = validationError);
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final intent =
          _intent ??
          await widget.repository.createReview(
            restaurantId: widget.restaurantId,
            foodRating: _foodRating,
            priceRating: _priceRating,
            serviceRating: _serviceRating,
            ambienceRating: _ambienceRating,
            comment: _commentController.text,
          );
      _intent = intent;
      _reviewId = intent.reviewId;
      if (_receipt != null && !_receiptUploaded) {
        final idempotencyKey =
            _receiptIdempotencyKey ?? widget.repository.createIdempotencyKey();
        _receiptIdempotencyKey = idempotencyKey;
        await widget.repository.uploadReceipt(
          reviewId: intent.reviewId,
          restaurantId: widget.restaurantId,
          receipt: _receipt!,
          idempotencyKey: idempotencyKey,
        );
        _receiptUploaded = true;
      } else if (_receipt == null && !_receiptVerificationSkipped) {
        await widget.repository.skipReceiptVerification(intent.reviewId);
        _receiptVerificationSkipped = true;
      }
      final status = await widget.repository.fetchStatus(intent.reviewId);
      if (!mounted) return;
      setState(() {
        _status = status;
        _automaticPollAttempts = 0;
        _pollingExhausted = false;
      });
      _startPollingIfNeeded();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error is Exception
            ? error.toString().replaceFirst('ApiException', 'Lỗi')
            : 'Không thể gửi đánh giá. Vui lòng thử lại.';
      });
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  void _startPollingIfNeeded() {
    _pollTimer?.cancel();
    if (_status?.isTerminal != false || _pollingExhausted) return;
    _pollTimer = Timer(widget.pollInterval, () {
      _refreshStatus(automatic: true);
    });
  }

  Future<void> _refreshStatus({bool automatic = false}) async {
    final reviewId = _reviewId;
    if (reviewId == null || _pollInFlight) return;
    if (automatic && _automaticPollAttempts >= widget.maxPollAttempts) {
      if (mounted) setState(() => _pollingExhausted = true);
      return;
    }

    _pollInFlight = true;
    if (automatic) _automaticPollAttempts += 1;
    try {
      final status = await widget.repository.fetchStatus(reviewId);
      if (!mounted) return;
      setState(() => _status = status);
      if (status.isTerminal) _pollTimer?.cancel();
    } on Exception {
      if (!mounted) return;
      setState(() => _error = 'Chưa thể cập nhật trạng thái. Hãy thử lại.');
    } finally {
      _pollInFlight = false;
      if (mounted && _status?.isTerminal == false && automatic) {
        if (_automaticPollAttempts >= widget.maxPollAttempts) {
          setState(() => _pollingExhausted = true);
        } else {
          _startPollingIfNeeded();
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const ValueKey('review-creation-page'),
      backgroundColor: const Color(0xFFF7F7F8),
      appBar: AppBar(
        title: const Text('Viết đánh giá'),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
      ),
      body: _status == null ? _buildForm() : _buildStatus(),
    );
  }

  Widget _buildForm() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 36),
      children: [
        Text(
          widget.restaurantName,
          style: AppTypography.sectionTitle.copyWith(color: AppTypography.ink),
        ),
        const SizedBox(height: 6),
        Text(
          'Chia sẻ trải nghiệm thật. Bạn có thể đăng ngay mà không cần tải hóa đơn.',
          style: AppTypography.body.copyWith(color: const Color(0xFF4B5563)),
        ),
        const SizedBox(height: 24),
        _RatingField(
          label: 'Món ăn',
          value: _foodRating,
          onChanged: (value) => setState(() => _foodRating = value),
        ),
        _RatingField(
          label: 'Giá cả',
          value: _priceRating,
          onChanged: (value) => setState(() => _priceRating = value),
        ),
        _RatingField(
          label: 'Phục vụ',
          value: _serviceRating,
          onChanged: (value) => setState(() => _serviceRating = value),
        ),
        _RatingField(
          label: 'Không gian',
          value: _ambienceRating,
          onChanged: (value) => setState(() => _ambienceRating = value),
        ),
        const SizedBox(height: 18),
        TextField(
          key: const ValueKey('review-comment-field'),
          controller: _commentController,
          minLines: 4,
          maxLines: 7,
          maxLength: 1000,
          decoration: InputDecoration(
            labelText: 'Nội dung đánh giá',
            hintText: 'Ít nhất 50 ký tự...',
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
            ),
          ),
        ),
        const SizedBox(height: 14),
        OutlinedButton.icon(
          key: const ValueKey('receipt-picker-button'),
          onPressed: _submitting || _intent != null ? null : _chooseReceipt,
          icon: Icon(
            _receipt == null
                ? Icons.receipt_long_outlined
                : Icons.check_circle_rounded,
          ),
          label: Text(
            _receipt == null
                ? 'Thêm hóa đơn (không bắt buộc)'
                : _receipt!.fileName,
          ),
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(52),
            foregroundColor: HomeColors.brand,
            side: const BorderSide(color: Color(0xFFFFB48A)),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Không có hóa đơn: đánh giá vẫn công khai ở mức tham khảo. Có hóa đơn: TrustBite sẽ xác thực để tăng độ tin cậy.',
          style: AppTypography.tiny.copyWith(color: const Color(0xFF4B5563)),
        ),
        if (_error != null) ...[
          const SizedBox(height: 14),
          Text(
            _error!,
            key: const ValueKey('review-form-error'),
            style: AppTypography.bodyStrong.copyWith(
              color: const Color(0xFFB42318),
            ),
          ),
        ],
        const SizedBox(height: 18),
        FilledButton(
          key: const ValueKey('submit-review-button'),
          onPressed: _submitting ? null : _submit,
          style: FilledButton.styleFrom(
            minimumSize: const Size.fromHeight(52),
            backgroundColor: HomeColors.brand,
          ),
          child: _submitting
              ? const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Text('Đăng đánh giá'),
        ),
      ],
    );
  }

  Widget _buildStatus() {
    final status = _status!;
    final isVerified = status.verificationStatus == 'VERIFIED';
    final isReference =
        status.status == 'REFERENCE_ONLY' ||
        {'REFERENCE_ONLY', 'SKIPPED'}.contains(status.verificationStatus);
    final isRejected = {
      'REJECTED',
      'DUPLICATE_REJECTED',
    }.contains(status.verificationStatus);
    final icon = isVerified
        ? Icons.verified_rounded
        : isReference
        ? Icons.info_rounded
        : isRejected
        ? Icons.cancel_rounded
        : Icons.hourglass_top_rounded;
    final color = isVerified
        ? const Color(0xFF16803B)
        : isRejected
        ? const Color(0xFFB42318)
        : HomeColors.brand;
    final title = isVerified
        ? 'Đánh giá đã được xác thực'
        : isReference
        ? 'Đánh giá được công khai tham khảo'
        : isRejected
        ? 'Đánh giá chưa được chấp nhận'
        : status.verificationStatus == 'PENDING_ADMIN_REVIEW'
        ? 'Đánh giá đang chờ kiểm tra thủ công'
        : 'Đang xác thực hóa đơn';

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 64, color: color),
            const SizedBox(height: 18),
            Text(
              title,
              textAlign: TextAlign.center,
              style: AppTypography.sectionTitle.copyWith(
                color: AppTypography.ink,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              status.decisionReason ??
                  'TrustBite đang xử lý hóa đơn. Kết quả xác thực hoàn toàn do backend quyết định.',
              textAlign: TextAlign.center,
              style: AppTypography.body.copyWith(
                color: const Color(0xFF4B5563),
              ),
            ),
            if (_pollingExhausted) ...[
              const SizedBox(height: 12),
              Text(
                'Trạng thái đang được xử lý, vui lòng kiểm tra lại sau.',
                key: const ValueKey('review-polling-exhausted-message'),
                textAlign: TextAlign.center,
                style: AppTypography.bodyStrong.copyWith(
                  color: const Color(0xFF4B5563),
                ),
              ),
            ],
            const SizedBox(height: 22),
            if (!status.isTerminal)
              OutlinedButton.icon(
                onPressed: _refreshStatus,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Cập nhật trạng thái'),
              ),
            const SizedBox(height: 10),
            FilledButton(
              onPressed: () =>
                  Navigator.of(context).pop(isVerified || isReference),
              style: FilledButton.styleFrom(backgroundColor: HomeColors.brand),
              child: const Text('Quay lại nhà hàng'),
            ),
          ],
        ),
      ),
    );
  }
}

class _RatingField extends StatelessWidget {
  const _RatingField({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final int value;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: AppTypography.bodyStrong.copyWith(
                color: AppTypography.ink,
              ),
            ),
          ),
          for (var rating = 1; rating <= 5; rating++)
            IconButton(
              key: ValueKey('rating-$label-$rating'),
              visualDensity: VisualDensity.compact,
              onPressed: () => onChanged(rating),
              icon: Icon(
                rating <= value
                    ? Icons.star_rounded
                    : Icons.star_border_rounded,
                color: HomeColors.brand,
              ),
            ),
        ],
      ),
    );
  }
}
