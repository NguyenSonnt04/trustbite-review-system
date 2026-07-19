import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/core/theme/app_typography.dart';
import 'package:trustbite_mobile/src/features/home/home_tokens.dart';

class TrustBiteBottomNav extends StatelessWidget {
  const TrustBiteBottomNav({
    super.key,
    required this.activeIndex,
    required this.onSelected,
  });

  final int activeIndex;
  final ValueChanged<int> onSelected;

  static const _items = [
    (Icons.home_rounded, 'Trang chủ'),
    (Icons.map_outlined, 'Bản đồ'),
    (Icons.favorite_border, 'Yêu thích'),
    (Icons.person_outline, 'Tôi'),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: const Color(0xFFE5E5E5)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.12),
            offset: const Offset(0, 8),
            blurRadius: 24,
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          for (var i = 0; i < _items.length; i++)
            Expanded(
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () => onSelected(i),
                  borderRadius: BorderRadius.circular(20),
                  child: Semantics(
                    button: true,
                    selected: activeIndex == i,
                    label: _items[i].$2,
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      decoration: BoxDecoration(
                        color: activeIndex == i
                            ? const Color(0xFFFFEEE4)
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            _items[i].$1,
                            size: 18,
                            color: activeIndex == i
                                ? HomeColors.brand
                                : HomeColors.muted,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _items[i].$2,
                            style: AppTypography.bottomNav.copyWith(
                              fontWeight: activeIndex == i
                                  ? FontWeight.w900
                                  : FontWeight.w700,
                              color: activeIndex == i
                                  ? HomeColors.brand
                                  : HomeColors.muted,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
