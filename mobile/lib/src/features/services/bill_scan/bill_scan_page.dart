import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/core/theme/app_typography.dart';
import 'package:trustbite_mobile/src/features/home/home_tokens.dart';
import 'package:trustbite_mobile/src/features/services/bill_scan/bill_receipt_picker.dart';
import 'package:trustbite_mobile/src/features/services/bill_scan/bill_scan_models.dart';
import 'package:trustbite_mobile/src/features/services/bill_scan/bill_scan_repository.dart';
import 'package:trustbite_mobile/src/features/services/bill_scan/bill_scan_result_page.dart';

class BillScanPage extends StatefulWidget {
  const BillScanPage({
    super.key,
    required this.repository,
    required this.receiptPicker,
    required this.ensureAuthenticated,
    required this.onAuthenticationRequired,
  });

  final BillScanRepository repository;
  final BillReceiptPicker receiptPicker;
  final Future<bool> Function() ensureAuthenticated;
  final Future<void> Function() onAuthenticationRequired;

  @override
  State<BillScanPage> createState() => _BillScanPageState();
}

class _BillScanPageState extends State<BillScanPage> {
  late Future<List<BillScanRestaurant>> _restaurantsFuture;
  BillScanRestaurant? _selectedRestaurant;
  BillScanBranch? _selectedBranch;
  List<BillScanBranch> _branches = const [];
  bool _loadingBranches = false;
  String? _branchError;
  BillReceiptFile? _receipt;
  bool _submitting = false;
  String? _submitError;
  int _branchRequestId = 0;

  @override
  void initState() {
    super.initState();
    _loadRestaurants();
  }

  void _loadRestaurants() {
    _restaurantsFuture = widget.repository.fetchRestaurants();
  }

  void _retryRestaurants() {
    setState(_loadRestaurants);
  }

  Future<void> _selectRestaurant(BillScanRestaurant? restaurant) async {
    final requestId = ++_branchRequestId;
    setState(() {
      _selectedRestaurant = restaurant;
      _selectedBranch = null;
      _branches = const [];
      _branchError = null;
      _submitError = null;
      _loadingBranches = restaurant != null;
    });
    if (restaurant == null) return;

    try {
      final branches = await widget.repository.fetchBranches(restaurant.id);
      if (!mounted || requestId != _branchRequestId) return;
      setState(() {
        _branches = branches;
        _loadingBranches = false;
      });
    } catch (_) {
      if (!mounted || requestId != _branchRequestId) return;
      setState(() {
        _loadingBranches = false;
        _branchError = 'Không thể tải chi nhánh.';
      });
    }
  }

  Future<void> _retryBranches() async {
    await _selectRestaurant(_selectedRestaurant);
  }

  Future<void> _pickReceipt(BillReceiptSource source) async {
    try {
      final receipt = await widget.receiptPicker.pick(source);
      if (!mounted || receipt == null) return;
      setState(() {
        _receipt = receipt;
        _submitError = null;
      });
    } on FormatException catch (error) {
      if (!mounted) return;
      setState(() => _submitError = error.message.toString());
    } catch (_) {
      if (!mounted) return;
      setState(() => _submitError = 'Không thể đọc ảnh bill đã chọn.');
    }
  }

  Future<void> _submit() async {
    final restaurant = _selectedRestaurant;
    final branch = _selectedBranch;
    final receipt = _receipt;
    if (restaurant == null || branch == null || receipt == null) return;

    if (!await widget.ensureAuthenticated()) {
      if (mounted) {
        setState(
          () => _submitError = 'Vui lòng đăng nhập để tiếp tục quét bill.',
        );
      }
      return;
    }
    if (!mounted) return;

    setState(() {
      _submitting = true;
      _submitError = null;
    });
    try {
      final result = await widget.repository.submitScan(
        restaurantId: restaurant.id,
        branchId: branch.id,
        receipt: receipt,
      );
      if (!mounted) return;
      await Navigator.of(context).pushReplacement<void, void>(
        MaterialPageRoute<void>(
          builder: (_) => BillScanResultPage(result: result),
        ),
      );
    } on AuthRequiredException {
      await widget.onAuthenticationRequired();
      if (!mounted) return;
      setState(
        () => _submitError = 'Phiên đăng nhập đã hết hạn. Vui lòng thử lại.',
      );
    } on FormatException catch (error) {
      if (!mounted) return;
      setState(() => _submitError = error.message.toString());
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _submitError = error.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _submitError = 'Chưa thể xử lý bill. Vui lòng thử lại.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  bool get _canSubmit =>
      !_submitting && _selectedBranch != null && _receipt != null;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const ValueKey('bill-scan-page'),
      backgroundColor: const Color(0xFFF7F7F8),
      body: DecoratedBox(
        decoration: const BoxDecoration(
          color: Color(0xFFF7F7F8),
          image: DecorationImage(
            image: AssetImage('assets/bg/bg_main.png'),
            fit: BoxFit.cover,
            alignment: Alignment.topCenter,
            opacity: 0.42,
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              const _BillScanHeader(),
              Expanded(
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 520),
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(20, 4, 20, 36),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const _BillScanIntro(),
                          const SizedBox(height: 24),
                          const Text(
                            'Nhà hàng',
                            style: TextStyle(
                              color: Color(0xFF111827),
                              fontSize: 20,
                              height: 1.1,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 12),
                          _RestaurantSurface(
                            child: FutureBuilder<List<BillScanRestaurant>>(
                              future: _restaurantsFuture,
                              builder: (context, snapshot) {
                                if (snapshot.connectionState !=
                                    ConnectionState.done) {
                                  return const SizedBox(
                                    key: ValueKey('bill-restaurants-loading'),
                                    height: 60,
                                    child: Center(
                                      child: CircularProgressIndicator(
                                        color: HomeColors.brand,
                                      ),
                                    ),
                                  );
                                }
                                if (snapshot.hasError) {
                                  return _InlineState(
                                    key: const ValueKey(
                                      'bill-restaurants-error',
                                    ),
                                    message: 'Không thể tải danh sách quán.',
                                    onRetry: _retryRestaurants,
                                  );
                                }
                                final restaurants =
                                    snapshot.data ??
                                    const <BillScanRestaurant>[];
                                if (restaurants.isEmpty) {
                                  return const _InlineMessage(
                                    key: ValueKey('bill-restaurants-empty'),
                                    message: 'Chưa có quán đang hoạt động.',
                                  );
                                }
                                return DropdownButtonFormField<
                                  BillScanRestaurant
                                >(
                                  key: const ValueKey('bill-restaurant-picker'),
                                  initialValue: _selectedRestaurant,
                                  isExpanded: true,
                                  icon: const Icon(
                                    Icons.expand_more_rounded,
                                    color: Color(0xFF777C84),
                                  ),
                                  decoration: _inputDecoration(),
                                  hint: Text(
                                    'Chọn nhà hàng',
                                    style: AppTypography.body.copyWith(
                                      color: const Color(0xFF55555F),
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  items: restaurants
                                      .map(
                                        (restaurant) => DropdownMenuItem(
                                          value: restaurant,
                                          child: Text(
                                            restaurant.name,
                                            overflow: TextOverflow.ellipsis,
                                            style: AppTypography.bodyStrong
                                                .copyWith(
                                                  color: const Color(
                                                    0xFF111827,
                                                  ),
                                                  fontWeight: FontWeight.w900,
                                                ),
                                          ),
                                        ),
                                      )
                                      .toList(growable: false),
                                  onChanged: _submitting
                                      ? null
                                      : _selectRestaurant,
                                );
                              },
                            ),
                          ),
                          const SizedBox(height: 26),
                          const Text(
                            'Chi nhánh',
                            style: TextStyle(
                              color: Color(0xFF111827),
                              fontSize: 20,
                              height: 1.1,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Chọn đúng địa điểm xuất hiện trên bill.',
                            style: AppTypography.caption.copyWith(
                              color: const Color(0xFF55555F),
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 8),
                          _buildBranchSection(),
                          const SizedBox(height: 26),
                          const Text(
                            'Ảnh bill',
                            style: TextStyle(
                              color: Color(0xFF111827),
                              fontSize: 20,
                              height: 1.1,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 12),
                          _ReceiptSurface(
                            receipt: _receipt,
                            submitting: _submitting,
                            onCamera: () =>
                                _pickReceipt(BillReceiptSource.camera),
                            onGallery: () =>
                                _pickReceipt(BillReceiptSource.gallery),
                          ),
                          if (_submitError != null) ...[
                            const SizedBox(height: 4),
                            _SubmitError(message: _submitError!),
                          ],
                          const SizedBox(height: 20),
                          FilledButton(
                            key: const ValueKey('bill-submit-button'),
                            onPressed: _canSubmit ? _submit : null,
                            style: FilledButton.styleFrom(
                              minimumSize: const Size.fromHeight(56),
                              backgroundColor: HomeColors.brand,
                              foregroundColor: Colors.white,
                              disabledBackgroundColor: const Color(0xFFDADADD),
                              disabledForegroundColor: const Color(0xFF8A8A92),
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(18),
                              ),
                              textStyle: AppTypography.button,
                            ),
                            child: _submitting
                                ? const Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      SizedBox.square(
                                        dimension: 20,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          color: Colors.white,
                                        ),
                                      ),
                                      SizedBox(width: 10),
                                      Text('Đang đối chiếu...'),
                                    ],
                                  )
                                : const Text('Quét ngay'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBranchSection() {
    if (_selectedRestaurant == null) {
      return const _BranchPrompt();
    }
    if (_loadingBranches) {
      return const SizedBox(
        key: ValueKey('bill-branches-loading'),
        height: 60,
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (_branchError != null) {
      return _InlineState(
        key: const ValueKey('bill-branches-error'),
        message: _branchError!,
        onRetry: _retryBranches,
      );
    }
    if (_branches.isEmpty) {
      return const _InlineMessage(
        key: ValueKey('bill-branches-empty'),
        message: 'Quán này chưa có chi nhánh đang hoạt động.',
      );
    }

    return Column(
      children: [
        for (var index = 0; index < _branches.length; index++) ...[
          _BranchOption(
            branch: _branches[index],
            selected: _selectedBranch?.id == _branches[index].id,
            onTap: _submitting
                ? null
                : () => setState(() {
                    _selectedBranch = _branches[index];
                    _submitError = null;
                  }),
          ),
          if (index != _branches.length - 1)
            const Divider(height: 1, indent: 56, color: Color(0xFFE8E8EB)),
        ],
      ],
    );
  }
}

class _BillScanHeader extends StatelessWidget {
  const _BillScanHeader();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 68,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: Row(
          children: [
            IconButton(
              tooltip: 'Quay lại',
              onPressed: () => Navigator.of(context).pop(),
              icon: const Icon(Icons.arrow_back_rounded),
            ),
            const SizedBox(width: 4),
            const Expanded(
              child: Text(
                'Quét bill',
                style: TextStyle(
                  color: Color(0xFF111827),
                  fontSize: 18,
                  height: 1.16,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
            const SizedBox(width: 48),
          ],
        ),
      ),
    );
  }
}

class _BillScanIntro extends StatelessWidget {
  const _BillScanIntro();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Kiểm tra giá trên bill',
          style: TextStyle(
            color: Color(0xFF111827),
            fontSize: 28,
            height: 1.08,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 7),
        Text(
          'Chọn quán, chi nhánh rồi thêm ảnh bill để đối chiếu.',
          style: AppTypography.body.copyWith(
            color: const Color(0xFF4F4F59),
            height: 1.35,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

class _RestaurantSurface extends StatelessWidget {
  const _RestaurantSurface({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFF1EDE8)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.045),
            offset: const Offset(0, 10),
            blurRadius: 24,
          ),
        ],
      ),
      child: child,
    );
  }
}

class _BranchPrompt extends StatelessWidget {
  const _BranchPrompt();

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: 64),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE8E8EB)),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.location_on_outlined,
            color: Color(0xFF8A8D94),
            size: 22,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'Chọn nhà hàng để xem các chi nhánh.',
              style: AppTypography.bodyStrong.copyWith(
                color: const Color(0xFF4F4F59),
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BranchOption extends StatelessWidget {
  const _BranchOption({
    required this.branch,
    required this.selected,
    required this.onTap,
  });

  final BillScanBranch branch;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        key: ValueKey('bill-branch-${branch.id}'),
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: selected
                      ? HomeColors.brand.withValues(alpha: 0.1)
                      : const Color(0xFFF1F3F5),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  Icons.location_on_outlined,
                  color: selected ? HomeColors.brand : const Color(0xFF72777F),
                  size: 21,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      branch.name,
                      style: AppTypography.bodyStrong.copyWith(
                        color: const Color(0xFF111827),
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      branch.address,
                      style: AppTypography.caption.copyWith(
                        color: const Color(0xFF4F4F59),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      branch.area,
                      key: ValueKey('bill-branch-area-${branch.id}'),
                      style: AppTypography.tiny.copyWith(
                        color: const Color(0xFF666A72),
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              AnimatedContainer(
                duration: const Duration(milliseconds: 160),
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: selected ? HomeColors.brand : Colors.transparent,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: selected
                        ? HomeColors.brand
                        : const Color(0xFFC8CAD0),
                    width: 1.5,
                  ),
                ),
                child: selected
                    ? const Icon(
                        Icons.check_rounded,
                        color: Colors.white,
                        size: 16,
                      )
                    : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ReceiptSurface extends StatelessWidget {
  const _ReceiptSurface({
    required this.receipt,
    required this.submitting,
    required this.onCamera,
    required this.onGallery,
  });

  final BillReceiptFile? receipt;
  final bool submitting;
  final VoidCallback onCamera;
  final VoidCallback onGallery;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFF1EDE8)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (receipt == null)
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Row(
                children: [
                  Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F3F5),
                      borderRadius: BorderRadius.circular(15),
                    ),
                    child: const Icon(
                      Icons.receipt_long_outlined,
                      color: Color(0xFF666A72),
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Thêm ảnh bill rõ nét',
                          style: TextStyle(
                            color: Color(0xFF111827),
                            fontSize: 14,
                            height: 1.25,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          'Đặt bill phẳng, đủ sáng và không che giá.',
                          style: AppTypography.caption.copyWith(
                            color: const Color(0xFF4F4F59),
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            )
          else ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: SizedBox(
                key: const ValueKey('bill-receipt-preview'),
                height: 176,
                child: Image.memory(
                  Uint8List.fromList(receipt!.bytes),
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => const ColoredBox(
                    color: Color(0xFFF1F3F5),
                    child: Center(
                      child: Icon(
                        Icons.receipt_long_rounded,
                        size: 44,
                        color: HomeColors.brand,
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 11),
            Row(
              children: [
                const Icon(
                  Icons.check_circle_rounded,
                  color: Color(0xFF27824B),
                  size: 19,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    receipt!.fileName,
                    key: const ValueKey('bill-receipt-name'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.bodyStrong.copyWith(
                      color: const Color(0xFF111827),
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
          ],
          Row(
            children: [
              Expanded(
                child: _ReceiptAction(
                  key: const ValueKey('bill-camera-button'),
                  icon: Icons.photo_camera_outlined,
                  label: 'Chụp ảnh',
                  onTap: submitting ? null : onCamera,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _ReceiptAction(
                  key: const ValueKey('bill-gallery-button'),
                  icon: Icons.photo_library_outlined,
                  label: 'Thư viện',
                  onTap: submitting ? null : onGallery,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            'JPG hoặc PNG, tối đa 10 MB',
            textAlign: TextAlign.center,
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

class _ReceiptAction extends StatelessWidget {
  const _ReceiptAction({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onTap,
      icon: Icon(icon, size: 20),
      label: Text(label),
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(48),
        foregroundColor: const Color(0xFF303038),
        disabledForegroundColor: const Color(0xFFA5A7AC),
        side: const BorderSide(color: Color(0xFFE1E2E5)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: AppTypography.labelStrong,
      ),
    );
  }
}

class _SubmitError extends StatelessWidget {
  const _SubmitError({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const ValueKey('bill-submit-error'),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF0EE),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF4D8D5)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.error_outline_rounded,
            color: Color(0xFFB42318),
            size: 20,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: AppTypography.caption.copyWith(
                color: const Color(0xFF9C2F25),
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _InlineState extends StatelessWidget {
  const _InlineState({super.key, required this.message, required this.onRetry});

  final String message;
  final FutureOr<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          message,
          textAlign: TextAlign.center,
          style: AppTypography.body.copyWith(color: const Color(0xFF666A72)),
        ),
        const SizedBox(height: 8),
        TextButton.icon(
          onPressed: onRetry,
          icon: const Icon(Icons.refresh_rounded),
          label: const Text('Thử lại'),
          style: TextButton.styleFrom(
            minimumSize: const Size(120, 44),
            foregroundColor: HomeColors.brand,
          ),
        ),
      ],
    );
  }
}

class _InlineMessage extends StatelessWidget {
  const _InlineMessage({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 18),
      child: Text(
        message,
        textAlign: TextAlign.center,
        style: AppTypography.bodyStrong.copyWith(
          color: const Color(0xFF4F4F59),
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

InputDecoration _inputDecoration() {
  const border = OutlineInputBorder(
    borderRadius: BorderRadius.all(Radius.circular(16)),
    borderSide: BorderSide(color: Color(0xFFE7E8EB)),
  );
  return const InputDecoration(
    prefixIcon: Icon(
      Icons.storefront_outlined,
      color: Color(0xFF777C84),
      size: 21,
    ),
    filled: true,
    fillColor: Color(0xFFF8F8FA),
    contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 17),
    border: border,
    enabledBorder: border,
    disabledBorder: border,
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.all(Radius.circular(16)),
      borderSide: BorderSide(color: HomeColors.brand, width: 1.5),
    ),
  );
}
