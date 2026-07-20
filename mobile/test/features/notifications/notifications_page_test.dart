import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/features/notifications/notification_models.dart';
import 'package:trustbite_mobile/src/features/notifications/notification_service.dart';
import 'package:trustbite_mobile/src/features/notifications/notifications_page.dart';

const _notificationId = '11111111-1111-4111-8111-111111111111';

TrustBiteNotification notification({
  String id = _notificationId,
  String title = 'Review của bạn đã được xác minh',
  DateTime? readAt,
}) {
  return TrustBiteNotification(
    id: id,
    type: 'REVIEW_VERIFIED',
    title: title,
    body: 'Review đã vượt qua kiểm tra độ tin cậy.',
    payload: const {'reviewId': '22222222-2222-4222-8222-222222222222'},
    readAt: readAt,
    createdAt: DateTime(2026, 7, 14, 10),
  );
}

NotificationPageData pageData({
  List<TrustBiteNotification> items = const [],
  int unreadCount = 0,
  int? total,
  int page = 1,
}) {
  return NotificationPageData(
    items: items,
    page: page,
    pageSize: 20,
    total: total ?? items.length,
    unreadCount: unreadCount,
  );
}

void main() {
  testWidgets('shows loading then the empty state', (tester) async {
    final completer = Completer<NotificationPageData>();
    final repository = _FakeNotificationRepository(
      fetchResults: [completer.future],
    );

    await tester.pumpWidget(
      MaterialApp(home: NotificationsPage(repository: repository)),
    );

    expect(find.byKey(const ValueKey('notifications-loading')), findsOneWidget);

    completer.complete(pageData());
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('notifications-empty')), findsOneWidget);
    expect(find.text('Chưa có thông báo'), findsOneWidget);
    expect(find.text('Đã đọc hết'), findsOneWidget);
  });

  testWidgets('shows an error and retries successfully', (tester) async {
    final repository = _FakeNotificationRepository(
      fetchResults: [Exception('offline'), pageData()],
    );

    await tester.pumpWidget(
      MaterialApp(home: NotificationsPage(repository: repository)),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('notifications-error')), findsOneWidget);
    expect(find.text('Thử lại'), findsOneWidget);

    await tester.tap(find.text('Thử lại'));
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('notifications-empty')), findsOneWidget);
    expect(repository.fetchCalls, 2);
  });

  testWidgets('marks an unread notification read and updates semantics', (
    tester,
  ) async {
    final unread = notification();
    final read = notification(readAt: DateTime(2026, 7, 14, 11));
    final unreadChanges = <int>[];
    final repository = _FakeNotificationRepository(
      fetchResults: [
        pageData(items: [unread], unreadCount: 3, total: 3),
      ],
      markReadResult: read,
    );

    await tester.pumpWidget(
      MaterialApp(
        home: NotificationsPage(
          repository: repository,
          onUnreadCountChanged: unreadChanges.add,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('3 mới'), findsOneWidget);
    expect(find.text('Chưa đọc'), findsOneWidget);

    await tester.tap(
      find.byKey(const ValueKey('notification-$_notificationId')),
    );
    await tester.pumpAndSettle();

    expect(repository.markReadCalls, 1);
    expect(find.text('2 mới'), findsOneWidget);
    expect(find.text('Đã đọc'), findsOneWidget);
    expect(unreadChanges, [3, 2]);

    final semantics = tester.getSemantics(
      find.byKey(const ValueKey('notification-$_notificationId')),
    );
    expect(semantics.label, contains('Đã đọc'));
  });

  testWidgets('coalesces repeated mark-read taps while a request is pending', (
    tester,
  ) async {
    final unread = notification();
    final read = notification(readAt: DateTime(2026, 7, 14, 11));
    final markCompleter = Completer<TrustBiteNotification>();
    final repository = _FakeNotificationRepository(
      fetchResults: [
        pageData(items: [unread], unreadCount: 2, total: 2),
      ],
      markReadFuture: markCompleter.future,
    );

    await tester.pumpWidget(
      MaterialApp(home: NotificationsPage(repository: repository)),
    );
    await tester.pumpAndSettle();

    final tile = find.byKey(const ValueKey('notification-$_notificationId'));
    await tester.tap(tile);
    await tester.tap(tile);
    await tester.pump();

    expect(repository.markReadCalls, 1);

    markCompleter.complete(read);
    await tester.pumpAndSettle();
    expect(find.text('1 mới'), findsOneWidget);
  });

  testWidgets('discards a stale page after the current data changes', (
    tester,
  ) async {
    final unread = notification();
    final read = notification(readAt: DateTime(2026, 7, 14, 11));
    final nextPageCompleter = Completer<NotificationPageData>();
    final repository = _FakeNotificationRepository(
      fetchResults: [
        pageData(items: [unread], unreadCount: 1, total: 2),
        nextPageCompleter.future,
      ],
      markReadResult: read,
    );

    await tester.pumpWidget(
      MaterialApp(home: NotificationsPage(repository: repository)),
    );
    await tester.pumpAndSettle();

    final loadMore = find.byKey(const ValueKey('notifications-load-more'));
    await tester.ensureVisible(loadMore);
    await tester.tap(loadMore);
    await tester.pump();
    await tester.tap(
      find.byKey(const ValueKey('notification-$_notificationId')),
    );
    await tester.pump();

    nextPageCompleter.complete(
      pageData(
        items: [
          notification(
            id: '33333333-3333-4333-8333-333333333333',
            title: 'Huy hiệu mới',
          ),
        ],
        unreadCount: 1,
        total: 2,
        page: 2,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Đã đọc'), findsOneWidget);
    expect(find.text('Huy hiệu mới'), findsNothing);
  });

  testWidgets('reports expired authentication instead of showing retry', (
    tester,
  ) async {
    var authenticationRequired = false;
    final repository = _FakeNotificationRepository(
      fetchResults: [const AuthRequiredException(401, 'expired')],
    );

    await tester.pumpWidget(
      MaterialApp(
        home: NotificationsPage(
          repository: repository,
          onAuthenticationRequired: () async {
            authenticationRequired = true;
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(authenticationRequired, isTrue);
    expect(find.byKey(const ValueKey('notifications-error')), findsNothing);
  });
}

class _FakeNotificationRepository implements NotificationRepository {
  _FakeNotificationRepository({
    required List<Object> fetchResults,
    this.markReadResult,
    this.markReadFuture,
  }) : _fetchResults = List<Object>.of(fetchResults);

  final List<Object> _fetchResults;
  final TrustBiteNotification? markReadResult;
  final Future<TrustBiteNotification>? markReadFuture;
  int fetchCalls = 0;
  int markReadCalls = 0;

  @override
  Future<int> fetchUnreadCount() async => 0;

  @override
  Future<NotificationPageData> fetchNotifications({
    int page = 1,
    int pageSize = 20,
  }) async {
    fetchCalls += 1;
    final result = _fetchResults.removeAt(0);
    if (result is Future<NotificationPageData>) return result;
    if (result is Exception) throw result;
    return result as NotificationPageData;
  }

  @override
  Future<TrustBiteNotification> markRead(String notificationId) async {
    markReadCalls += 1;
    if (markReadFuture case final pending?) return pending;
    return markReadResult!;
  }
}
