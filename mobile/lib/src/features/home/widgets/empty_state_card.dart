import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/core/theme/app_typography.dart';
import 'package:trustbite_mobile/src/features/home/home_tokens.dart';

class EmptyStateCard extends StatelessWidget {
  const EmptyStateCard({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: const Color(0xFFF4F4F4)),
      ),
      child: Column(
        children: [
          Icon(icon, size: 48, color: HomeColors.brand),
          const SizedBox(height: 12),
          Text(
            title,
            style: AppTypography.cardTitle,
          ),
          const SizedBox(height: 6),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: AppTypography.label.copyWith(color: HomeColors.muted),
          ),
        ],
      ),
    );
  }
}
