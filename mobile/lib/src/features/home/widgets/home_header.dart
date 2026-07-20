import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/core/theme/app_typography.dart';
import 'package:trustbite_mobile/src/features/home/home_tokens.dart';

class HomeHeader extends StatelessWidget {
  const HomeHeader({
    super.key,
    required this.isSignedIn,
    required this.currentUser,
    required this.onLogin,
    required this.notificationCount,
    required this.onNotificationsPressed,
  });

  final bool isSignedIn;
  final Map<String, dynamic>? currentUser;
  final VoidCallback onLogin;
  final int notificationCount;
  final VoidCallback onNotificationsPressed;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      'Vị trí hiện tại',
                      style: AppTypography.caption.copyWith(
                        color: const Color(0xFF9CA3AF),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(width: 8),
                    _TrustScoreInline(
                      score: 0,
                      onPressed: isSignedIn ? null : onLogin,
                    ),
                  ],
                ),
                const SizedBox(height: 5),
                const _LocationPill(),
              ],
            ),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _NotificationButton(
                count: notificationCount,
                onPressed: onNotificationsPressed,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _LocationPill extends StatelessWidget {
  const _LocationPill();

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 190),
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFFF9FAFB),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xFFEDEFF2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.place_rounded, size: 14, color: HomeColors.brand),
          const SizedBox(width: 4),
          Flexible(
            child: Text(
              'Quận 1, TP.HCM',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.labelStrong.copyWith(
                color: const Color(0xFF111827),
                fontSize: 14,
              ),
            ),
          ),
          const SizedBox(width: 3),
          const Icon(
            Icons.keyboard_arrow_down_rounded,
            size: 15,
            color: HomeColors.brand,
          ),
        ],
      ),
    );
  }
}

class _NotificationButton extends StatelessWidget {
  const _NotificationButton({required this.count, required this.onPressed});

  final int count;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Mở thông báo',
      value: '$count thông báo mới',
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(12),
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              const SizedBox(
                width: 48,
                height: 48,
                child: Icon(
                  Icons.notifications_rounded,
                  size: 24,
                  color: HomeColors.brand,
                ),
              ),
              if (count > 0)
                Positioned(
                  top: -4,
                  right: -5,
                  child: Container(
                    height: 16,
                    constraints: const BoxConstraints(minWidth: 16),
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEF4444),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      count.toString(),
                      style: AppTypography.tiny.copyWith(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        height: 1,
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

class _TrustScoreInline extends StatelessWidget {
  const _TrustScoreInline({required this.score, required this.onPressed});

  final int score;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final content = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.verified_rounded, size: 12, color: HomeColors.brand),
        const SizedBox(width: 3),
        Text(
          'Trust $score',
          style: AppTypography.tiny.copyWith(
            color: const Color(0xFF111827),
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    );

    if (onPressed == null) {
      return content;
    }

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(8),
        child: Row(mainAxisSize: MainAxisSize.min, children: [content]),
      ),
    );
  }
}
