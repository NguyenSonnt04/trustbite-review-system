import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/features/notifications/notification_models.dart';

abstract class NotificationRepository {
  Future<int> fetchUnreadCount();

  Future<NotificationPageData> fetchNotifications({
    int page = 1,
    int pageSize = 20,
  });

  Future<TrustBiteNotification> markRead(String notificationId);
}

class ApiNotificationRepository implements NotificationRepository {
  ApiNotificationRepository({required TrustBiteApiClient apiClient})
    : _apiClient = apiClient;

  final TrustBiteApiClient _apiClient;

  @override
  Future<int> fetchUnreadCount() async {
    final response = await _apiClient.getJson('/notifications/summary');
    return (response['unreadCount'] as num?)?.toInt() ?? 0;
  }

  @override
  Future<NotificationPageData> fetchNotifications({
    int page = 1,
    int pageSize = 20,
  }) async {
    final response = await _apiClient.getJson('/notifications', {
      'page': '$page',
      'pageSize': '$pageSize',
    });
    return NotificationPageData.fromJson(response);
  }

  @override
  Future<TrustBiteNotification> markRead(String notificationId) async {
    final response = await _apiClient.patchJson(
      '/notifications/$notificationId/read',
      const {},
    );
    return TrustBiteNotification.fromJson(response);
  }
}
