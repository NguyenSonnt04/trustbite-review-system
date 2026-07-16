class TrustBiteNotification {
  const TrustBiteNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.payload,
    required this.readAt,
    required this.createdAt,
  });

  factory TrustBiteNotification.fromJson(Map<String, dynamic> json) {
    final id = json['id'];
    final type = json['type'];
    final title = json['title'];
    final createdAt = DateTime.tryParse(json['createdAt']?.toString() ?? '');
    if (id is! String ||
        type is! String ||
        title is! String ||
        createdAt == null) {
      throw const FormatException('Invalid notification response.');
    }

    return TrustBiteNotification(
      id: id,
      type: type,
      title: title,
      body: json['body'] is String ? json['body'] as String : '',
      payload: json['payload'] is Map<String, dynamic>
          ? Map<String, dynamic>.from(json['payload'] as Map<String, dynamic>)
          : const {},
      readAt: json['readAt'] == null
          ? null
          : DateTime.tryParse(json['readAt'].toString()),
      createdAt: createdAt,
    );
  }

  final String id;
  final String type;
  final String title;
  final String body;
  final Map<String, dynamic> payload;
  final DateTime? readAt;
  final DateTime createdAt;

  bool get isUnread => readAt == null;

  TrustBiteNotification markRead(DateTime timestamp) {
    return TrustBiteNotification(
      id: id,
      type: type,
      title: title,
      body: body,
      payload: payload,
      readAt: readAt ?? timestamp,
      createdAt: createdAt,
    );
  }
}

class NotificationPageData {
  const NotificationPageData({
    required this.items,
    required this.page,
    required this.pageSize,
    required this.total,
    required this.unreadCount,
  });

  factory NotificationPageData.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'];
    if (rawItems is! List) {
      throw const FormatException('Invalid notification list response.');
    }

    return NotificationPageData(
      items: rawItems
          .map(
            (item) => TrustBiteNotification.fromJson(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList(growable: false),
      page: (json['page'] as num?)?.toInt() ?? 1,
      pageSize: (json['pageSize'] as num?)?.toInt() ?? 20,
      total: (json['total'] as num?)?.toInt() ?? rawItems.length,
      unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
    );
  }

  final List<TrustBiteNotification> items;
  final int page;
  final int pageSize;
  final int total;
  final int unreadCount;
}
