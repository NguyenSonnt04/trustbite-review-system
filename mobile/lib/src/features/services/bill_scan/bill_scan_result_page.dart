import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/core/theme/app_typography.dart';
import 'package:trustbite_mobile/src/features/services/bill_scan/bill_scan_models.dart';

class BillScanResultPage extends StatelessWidget {
  const BillScanResultPage({super.key, required this.result});

  final BillScanResult result;

  @override
  Widget build(BuildContext context) {
    final presentation = _statusPresentation(result.overallResult);
    final unmatchedItems = result.items
        .where((item) => item.isUnmatched)
        .toList(growable: false);

    return Scaffold(
      key: const ValueKey('bill-scan-result-page'),
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
              const _BillScanResultHeader(),
              Expanded(
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 520),
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(20, 4, 20, 36),
                      children: [
                        _ResultSummary(
                          key: ValueKey('bill-overall-${result.overallResult}'),
                          presentation: presentation,
                          itemCount: result.items.length,
                        ),
                        const SizedBox(height: 26),
                        const Text(
                          'Chi tiết từng món',
                          style: TextStyle(
                            color: Color(0xFF111827),
                            fontSize: 20,
                            height: 1.1,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Giá trên bill được so với thực đơn của chi nhánh.',
                          style: AppTypography.caption.copyWith(
                            color: const Color(0xFF4F4F59),
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 12),
                        if (result.items.isEmpty)
                          const _EmptyItems()
                        else
                          _LineItemList(items: result.items),
                        if (unmatchedItems.isNotEmpty) ...[
                          const SizedBox(height: 24),
                          const Text(
                            'Chưa đối chiếu được',
                            style: TextStyle(
                              color: Color(0xFF111827),
                              fontSize: 18,
                              height: 1.16,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 10),
                          _UnmatchedItems(items: unmatchedItems),
                        ],
                        const SizedBox(height: 24),
                        const _ScopeNote(),
                      ],
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
}

class _BillScanResultHeader extends StatelessWidget {
  const _BillScanResultHeader();

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
                'Kết quả quét bill',
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

class _ResultSummary extends StatelessWidget {
  const _ResultSummary({
    super.key,
    required this.presentation,
    required this.itemCount,
  });

  final _StatusPresentation presentation;
  final int itemCount;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: const Color(0xFFF1EDE8)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.055),
            offset: const Offset(0, 12),
            blurRadius: 28,
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: presentation.background,
              borderRadius: BorderRadius.circular(17),
            ),
            child: Icon(presentation.icon, color: presentation.color, size: 27),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  presentation.title,
                  style: AppTypography.cardTitle.copyWith(
                    color: const Color(0xFF111827),
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  presentation.message,
                  style: AppTypography.caption.copyWith(
                    color: const Color(0xFF4F4F59),
                    height: 1.4,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  itemCount == 0
                      ? 'Không đọc được món nào'
                      : 'Đã đọc $itemCount món từ bill',
                  style: AppTypography.tiny.copyWith(color: presentation.color),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LineItemList extends StatelessWidget {
  const _LineItemList({required this.items});

  final List<BillScanLineItem> items;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFF1EDE8)),
      ),
      child: Column(
        children: [
          for (var index = 0; index < items.length; index++) ...[
            _LineItemRow(item: items[index]),
            if (index != items.length - 1)
              const Divider(
                height: 1,
                indent: 16,
                endIndent: 16,
                color: Color(0xFFE8E8EB),
              ),
          ],
        ],
      ),
    );
  }
}

class _LineItemRow extends StatelessWidget {
  const _LineItemRow({required this.item});

  final BillScanLineItem item;

  @override
  Widget build(BuildContext context) {
    final presentation = _statusPresentation(item.result);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 15, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.observedName,
                      style: AppTypography.bodyStrong.copyWith(
                        color: const Color(0xFF111827),
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    if (item.matchedName != null) ...[
                      const SizedBox(height: 3),
                      Text(
                        'Khớp với: ${item.matchedName}',
                        style: AppTypography.caption.copyWith(
                          color: const Color(0xFF4F4F59),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 10),
              _StatusBadge(
                label: presentation.shortLabel,
                color: presentation.color,
                background: presentation.background,
              ),
            ],
          ),
          const SizedBox(height: 13),
          Row(
            children: [
              Expanded(
                child: _PriceValue(
                  label: 'Trên bill',
                  value: _formatPrice(item.observedUnitPrice),
                ),
              ),
              Container(width: 1, height: 32, color: const Color(0xFFE8E8EB)),
              Expanded(
                child: _PriceValue(
                  label: 'Thực đơn',
                  value: _formatPrice(item.expectedUnitPrice),
                ),
              ),
              Container(width: 1, height: 32, color: const Color(0xFFE8E8EB)),
              Expanded(
                child: _PriceValue(
                  label: 'Chênh lệch',
                  value: _formatDifference(item.priceDifference),
                  valueColor: item.result == 'PRICE_MISMATCH'
                      ? const Color(0xFFB42318)
                      : null,
                ),
              ),
            ],
          ),
          if (item.confidence != null) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Text(
                  'Độ tin cậy',
                  style: AppTypography.tiny.copyWith(
                    color: const Color(0xFF666A72),
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(width: 4),
                Text(
                  '${(item.confidence! * 100).round()}%',
                  style: AppTypography.tiny.copyWith(
                    color: const Color(0xFF666A72),
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _PriceValue extends StatelessWidget {
  const _PriceValue({
    required this.label,
    required this.value,
    this.valueColor,
  });

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Text(
          label,
          maxLines: 1,
          style: AppTypography.tiny.copyWith(
            color: const Color(0xFF666A72),
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppTypography.labelStrong.copyWith(
            color: valueColor ?? const Color(0xFF303038),
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({
    required this.label,
    required this.color,
    required this.background,
  });

  final String label;
  final Color color;
  final Color background;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: AppTypography.tiny.copyWith(
          color: color,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _EmptyItems extends StatelessWidget {
  const _EmptyItems();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF1EDE8)),
      ),
      child: Row(
        children: [
          const Icon(Icons.receipt_long_outlined, color: Color(0xFF777C84)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'Không đọc được món nào từ bill này.',
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

class _UnmatchedItems extends StatelessWidget {
  const _UnmatchedItems({required this.items});

  final List<BillScanLineItem> items;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const ValueKey('bill-unmatched-items'),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF1EDE8)),
      ),
      child: Column(
        children: [
          for (var index = 0; index < items.length; index++) ...[
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Row(
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F3F5),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.help_outline_rounded,
                      color: Color(0xFF72777F),
                      size: 19,
                    ),
                  ),
                  const SizedBox(width: 11),
                  Expanded(
                    child: Text(
                      '• ${items[index].observedName}',
                      style: AppTypography.bodyStrong.copyWith(
                        color: const Color(0xFF111827),
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (index != items.length - 1)
              const Divider(height: 1, color: Color(0xFFE8E8EB)),
          ],
        ],
      ),
    );
  }
}

class _ScopeNote extends StatelessWidget {
  const _ScopeNote();

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const ValueKey('bill-scan-scope-note'),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.88),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE8E8EB)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xFFF1F3F5),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(
              Icons.info_outline_rounded,
              color: Color(0xFF666A72),
              size: 21,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Phạm vi kiểm tra',
                  style: TextStyle(
                    color: Color(0xFF111827),
                    fontSize: 14,
                    height: 1.25,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'TrustBite chỉ đối chiếu giá từng món. Phí dịch vụ, thuế, giảm giá và tổng bill không được kiểm tra.',
                  style: AppTypography.caption.copyWith(
                    color: const Color(0xFF4F4F59),
                    height: 1.4,
                    fontWeight: FontWeight.w700,
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

class _StatusPresentation {
  const _StatusPresentation({
    required this.title,
    required this.shortLabel,
    required this.message,
    required this.icon,
    required this.color,
    required this.background,
  });

  final String title;
  final String shortLabel;
  final String message;
  final IconData icon;
  final Color color;
  final Color background;
}

_StatusPresentation _statusPresentation(String status) {
  return switch (status) {
    'MATCHED' => const _StatusPresentation(
      title: 'Giá các món khớp',
      shortLabel: 'Khớp giá',
      message: 'Các món đọc được có giá phù hợp với thực đơn chi nhánh.',
      icon: Icons.verified_rounded,
      color: Color(0xFF18753D),
      background: Color(0xFFEAF7EE),
    ),
    'PRICE_MISMATCH' => const _StatusPresentation(
      title: 'Có món lệch giá',
      shortLabel: 'Lệch giá',
      message: 'Ít nhất một món chênh hơn 1.000 ₫ so với thực đơn chi nhánh.',
      icon: Icons.warning_amber_rounded,
      color: Color(0xFFB42318),
      background: Color(0xFFFFECEA),
    ),
    _ => const _StatusPresentation(
      title: 'Chưa thể kết luận',
      shortLabel: 'Chưa rõ',
      message: 'Một số món chưa đọc hoặc chưa ghép được với thực đơn.',
      icon: Icons.help_outline_rounded,
      color: Color(0xFF9A5B13),
      background: Color(0xFFFFF4E1),
    ),
  };
}

String _formatPrice(num? value) {
  if (value == null) return 'Chưa có';
  return '${_groupDigits(value.round().abs())} ₫';
}

String _formatDifference(num? value) {
  if (value == null) return 'Chưa có';
  return '${_groupDigits(value.round().abs())} ₫';
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
