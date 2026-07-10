import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/core/theme/app_typography.dart';
import 'package:trustbite_mobile/src/features/home/data/home_mock_data.dart';
import 'package:trustbite_mobile/src/features/home/home_tokens.dart';
import 'package:trustbite_mobile/src/features/home/models/home_models.dart';

const _notificationInk = Color(0xFF27292F);
const _notificationSurface = Color(0xFFFFFEFC);
const _notificationSoftSurface = Color(0xFFF2F3F5);
const _notificationBorder = Color(0xFFE7E8EB);

class NotificationsPage extends StatelessWidget {
  const NotificationsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final unreadCount =
        homeNotifications.where((notification) => notification.unread).length;

    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: DecoratedBox(
              decoration: const BoxDecoration(
                color: Color(0xFFFFFEFC),
                image: DecorationImage(
                  image: AssetImage('assets/bg/bg_main.png'),
                  fit: BoxFit.cover,
                  alignment: Alignment.topCenter,
                ),
              ),
              child: Column(
                children: [
                  _NotificationsHeader(unreadCount: unreadCount),
                  Expanded(
                    child: ListView.separated(
                      key: const ValueKey('notifications-list'),
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                      itemCount: homeNotifications.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, index) {
                        return _NotificationTile(
                          notification: homeNotifications[index],
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _NotificationsHeader extends StatelessWidget {
  const _NotificationsHeader({required this.unreadCount});

  final int unreadCount;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 20, 12),
      child: Row(
        children: [
          SizedBox(
            width: 44,
            height: 44,
            child: Material(
              color: Colors.transparent,
              borderRadius: BorderRadius.circular(14),
              child: InkWell(
                key: const ValueKey('notifications-back-button'),
                onTap: () => Navigator.of(context).pop(),
                borderRadius: BorderRadius.circular(14),
                child: const Tooltip(
                  message: 'Quay lại',
                  child: Icon(
                    Icons.arrow_back_ios_new_rounded,
                    color: _notificationInk,
                    size: 18,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              'Thông báo',
              style: AppTypography.sectionTitle.copyWith(
                color: _notificationInk,
                fontSize: 24,
              ),
            ),
          ),
          Container(
            height: 36,
            padding: const EdgeInsets.symmetric(horizontal: 11),
            decoration: BoxDecoration(
              color: _notificationInk,
              borderRadius: BorderRadius.circular(999),
              boxShadow: [
                BoxShadow(
                  color: _notificationInk.withValues(alpha: 0.16),
                  offset: const Offset(0, 5),
                  blurRadius: 12,
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.notifications_none_rounded,
                  color: Color(0xFFF8F9FA),
                  size: 16,
                ),
                const SizedBox(width: 5),
                Text(
                  '$unreadCount mới',
                  style: AppTypography.tiny.copyWith(
                    color: const Color(0xFFF8F9FA),
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
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

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.notification});

  final HomeNotification notification;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: notification.title,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: _notificationSurface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: _notificationBorder),
          boxShadow: [
            BoxShadow(
              color: _notificationInk.withValues(alpha: 0.055),
              offset: const Offset(0, 8),
              blurRadius: 24,
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: _notificationSoftSurface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFE3E5E8)),
              ),
              alignment: Alignment.center,
              child: Icon(
                _notificationIcon(notification.icon),
                color: _notificationInk,
                size: 22,
              ),
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          notification.title,
                          style: AppTypography.labelStrong.copyWith(
                            color: _notificationInk,
                            fontSize: 15,
                          ),
                        ),
                      ),
                      if (notification.unread)
                        Container(
                          width: 7,
                          height: 7,
                          decoration: BoxDecoration(
                            color: HomeColors.brand,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: HomeColors.brand.withValues(alpha: 0.24),
                                blurRadius: 6,
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 5),
                  Text(
                    notification.body,
                    style: AppTypography.body.copyWith(
                      color: const Color(0xFF4B5563),
                      fontSize: 14,
                      height: 1.3,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    notification.timeAgo,
                    style: AppTypography.tiny.copyWith(
                      color: HomeColors.muted,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
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

IconData _notificationIcon(String icon) {
  return switch (icon) {
    'receipt' => Icons.receipt_long_outlined,
    'offer' => Icons.sell_outlined,
    'review' => Icons.rate_review_outlined,
    _ => Icons.notifications_none_rounded,
  };
}
