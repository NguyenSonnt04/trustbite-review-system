import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/core/theme/app_typography.dart';
import 'package:trustbite_mobile/src/features/home/home_tokens.dart';
import 'package:trustbite_mobile/src/features/notifications/notification_models.dart';
import 'package:trustbite_mobile/src/features/notifications/notification_service.dart';

const _notificationInk = Color(0xFF27292F);
const _notificationSurface = Color(0xFFFFFEFC);
const _notificationSoftSurface = Color(0xFFF2F3F5);
const _notificationBorder = Color(0xFFE7E8EB);

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({
    super.key,
    required this.repository,
    this.onUnreadCountChanged,
    this.onAuthenticationRequired,
  });

  final NotificationRepository repository;
  final ValueChanged<int>? onUnreadCountChanged;
  final Future<void> Function()? onAuthenticationRequired;

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  NotificationPageData? _data;
  Object? _error;
  bool _loading = true;
  bool _loadingMore = false;
  final Set<String> _markingReadIds = {};
  int _dataVersion = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await widget.repository.fetchNotifications();
      if (!mounted) return;
      setState(() {
        _data = data;
        _dataVersion += 1;
        _loading = false;
      });
      widget.onUnreadCountChanged?.call(data.unreadCount);
    } on AuthRequiredException {
      await _handleAuthenticationRequired();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  Future<void> _markRead(TrustBiteNotification notification) async {
    if (!notification.isUnread || _markingReadIds.contains(notification.id)) {
      return;
    }
    setState(() => _markingReadIds.add(notification.id));
    try {
      final updated = await widget.repository.markRead(notification.id);
      if (!mounted || _data == null) return;
      final current = _data!;
      final currentIndex = current.items.indexWhere(
        (item) => item.id == updated.id,
      );
      if (currentIndex < 0 || !current.items[currentIndex].isUnread) return;
      final items = current.items
          .map((item) => item.id == updated.id ? updated : item)
          .toList(growable: false);
      final unreadCount = current.unreadCount > 0 ? current.unreadCount - 1 : 0;
      setState(() {
        _data = NotificationPageData(
          items: items,
          page: current.page,
          pageSize: current.pageSize,
          total: current.total,
          unreadCount: unreadCount,
        );
        _dataVersion += 1;
      });
      widget.onUnreadCountChanged?.call(unreadCount);
    } on AuthRequiredException {
      await _handleAuthenticationRequired();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Không thể đánh dấu thông báo đã đọc. Vui lòng thử lại.',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _markingReadIds.remove(notification.id));
      }
    }
  }

  Future<void> _loadNextPage() async {
    final current = _data;
    if (current == null ||
        _loadingMore ||
        current.items.length >= current.total) {
      return;
    }

    setState(() => _loadingMore = true);
    final requestedDataVersion = _dataVersion;
    try {
      final next = await widget.repository.fetchNotifications(
        page: current.page + 1,
        pageSize: current.pageSize,
      );
      if (!mounted) return;
      final latest = _data;
      if (latest == null ||
          latest.page != current.page ||
          _dataVersion != requestedDataVersion) {
        setState(() => _loadingMore = false);
        return;
      }
      final existingIds = latest.items.map((item) => item.id).toSet();
      setState(() {
        _data = NotificationPageData(
          items: [
            ...latest.items,
            ...next.items.where((item) => existingIds.add(item.id)),
          ],
          page: next.page,
          pageSize: next.pageSize,
          total: next.total,
          unreadCount: next.unreadCount,
        );
        _dataVersion += 1;
        _loadingMore = false;
      });
      widget.onUnreadCountChanged?.call(next.unreadCount);
    } on AuthRequiredException {
      await _handleAuthenticationRequired();
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingMore = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Không thể tải thêm thông báo. Vui lòng thử lại.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _handleAuthenticationRequired() async {
    await widget.onAuthenticationRequired?.call();
    if (!mounted) return;
    setState(() {
      _loading = false;
      _loadingMore = false;
    });
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final unreadCount = _data?.unreadCount ?? 0;

    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: DecoratedBox(
              decoration: const BoxDecoration(
                color: _notificationSurface,
                image: DecorationImage(
                  image: AssetImage('assets/bg/bg_main.png'),
                  fit: BoxFit.cover,
                  alignment: Alignment.topCenter,
                ),
              ),
              child: Column(
                children: [
                  _NotificationsHeader(unreadCount: unreadCount),
                  Expanded(child: _buildBody()),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return Semantics(
        liveRegion: true,
        label: 'Đang tải thông báo',
        child: const Center(
          child: CircularProgressIndicator(
            key: ValueKey('notifications-loading'),
            color: HomeColors.brand,
          ),
        ),
      );
    }

    if (_error != null) {
      return _NotificationMessageState(
        key: const ValueKey('notifications-error'),
        icon: Icons.cloud_off_rounded,
        title: 'Chưa tải được thông báo',
        message: 'Kiểm tra kết nối rồi thử lại.',
        actionLabel: 'Thử lại',
        onAction: _load,
      );
    }

    final items = _data?.items ?? const <TrustBiteNotification>[];
    if (items.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        color: HomeColors.brand,
        child: const _NotificationMessageState(
          key: ValueKey('notifications-empty'),
          icon: Icons.notifications_none_rounded,
          title: 'Chưa có thông báo',
          message: 'Kết quả xác minh và huy hiệu mới sẽ xuất hiện tại đây.',
        ),
      );
    }

    final hasMore = items.length < (_data?.total ?? 0);
    return RefreshIndicator(
      onRefresh: _load,
      color: HomeColors.brand,
      child: ListView.separated(
        key: const ValueKey('notifications-list'),
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        itemCount: items.length + (hasMore ? 1 : 0),
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          if (index == items.length) {
            return Center(
              child: _loadingMore
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: CircularProgressIndicator(color: HomeColors.brand),
                    )
                  : TextButton(
                      key: const ValueKey('notifications-load-more'),
                      onPressed: _loadNextPage,
                      child: const Text('Tải thêm'),
                    ),
            );
          }
          final notification = items[index];
          return _NotificationTile(
            notification: notification,
            onPressed: () => _markRead(notification),
          );
        },
      ),
    );
  }
}

class _NotificationsHeader extends StatelessWidget {
  const _NotificationsHeader({required this.unreadCount});

  final int unreadCount;

  @override
  Widget build(BuildContext context) {
    final countLabel = unreadCount > 0 ? '$unreadCount mới' : 'Đã đọc hết';

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 20, 12),
      child: Row(
        children: [
          SizedBox(
            width: 48,
            height: 48,
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
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Thông báo',
              style: AppTypography.sectionTitle.copyWith(
                color: _notificationInk,
                fontSize: 24,
              ),
            ),
          ),
          Semantics(
            label: countLabel,
            child: Container(
              height: 36,
              padding: const EdgeInsets.symmetric(horizontal: 11),
              decoration: BoxDecoration(
                color: _notificationInk,
                borderRadius: BorderRadius.circular(999),
              ),
              alignment: Alignment.center,
              child: Text(
                countLabel,
                style: AppTypography.tiny.copyWith(
                  color: const Color(0xFFF8F9FA),
                  fontSize: 11,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({
    required this.notification,
    required this.onPressed,
  });

  final TrustBiteNotification notification;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final readLabel = notification.isUnread ? 'Chưa đọc' : 'Đã đọc';

    return Semantics(
      button: notification.isUnread,
      excludeSemantics: true,
      label:
          '${notification.title}. ${notification.body}. $readLabel. ${_timeLabel(notification.createdAt)}',
      child: Material(
        color: _notificationSurface,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          key: ValueKey('notification-${notification.id}'),
          onTap: notification.isUnread ? onPressed : null,
          borderRadius: BorderRadius.circular(20),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: _notificationBorder),
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
                    _notificationIcon(notification.type),
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
                          Text(
                            readLabel,
                            style: AppTypography.tiny.copyWith(
                              color: notification.isUnread
                                  ? HomeColors.brand
                                  : HomeColors.muted,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                      if (notification.body.isNotEmpty) ...[
                        const SizedBox(height: 5),
                        Text(
                          notification.body,
                          style: AppTypography.body.copyWith(
                            color: const Color(0xFF4B5563),
                            fontSize: 14,
                            height: 1.3,
                          ),
                        ),
                      ],
                      const SizedBox(height: 8),
                      Text(
                        _timeLabel(notification.createdAt),
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
        ),
      ),
    );
  }
}

class _NotificationMessageState extends StatelessWidget {
  const _NotificationMessageState({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(28, 72, 28, 32),
      children: [
        Icon(icon, size: 48, color: HomeColors.muted),
        const SizedBox(height: 16),
        Text(
          title,
          textAlign: TextAlign.center,
          style: AppTypography.sectionTitle.copyWith(color: _notificationInk),
        ),
        const SizedBox(height: 8),
        Text(
          message,
          textAlign: TextAlign.center,
          style: AppTypography.body.copyWith(color: HomeColors.muted),
        ),
        if (actionLabel != null && onAction != null) ...[
          const SizedBox(height: 20),
          Center(
            child: FilledButton(onPressed: onAction, child: Text(actionLabel!)),
          ),
        ],
      ],
    );
  }
}

IconData _notificationIcon(String type) {
  return switch (type) {
    'REVIEW_VERIFIED' => Icons.verified_outlined,
    'BADGE_EARNED' => Icons.workspace_premium_outlined,
    _ => Icons.notifications_none_rounded,
  };
}

String _timeLabel(DateTime timestamp) {
  final local = timestamp.toLocal();
  final now = DateTime.now();
  final difference = now.difference(local);
  if (!difference.isNegative && difference.inMinutes < 1) return 'Vừa xong';
  if (!difference.isNegative && difference.inHours < 1) {
    return '${difference.inMinutes} phút trước';
  }
  if (!difference.isNegative && difference.inDays < 1) {
    return '${difference.inHours} giờ trước';
  }
  if (!difference.isNegative && difference.inDays < 7) {
    return '${difference.inDays} ngày trước';
  }
  return '${local.day.toString().padLeft(2, '0')}/'
      '${local.month.toString().padLeft(2, '0')}/${local.year}';
}
