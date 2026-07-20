import {
  getNotificationSummary,
  listNotifications,
  markNotificationRead,
} from '../services/notificationService.js';

export async function listNotificationsHandler(req, res, next) {
  try {
    const result = await listNotifications({
      userId: req.user.id,
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getNotificationSummaryHandler(req, res, next) {
  try {
    const result = await getNotificationSummary({ userId: req.user.id });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function markNotificationReadHandler(req, res, next) {
  try {
    const result = await markNotificationRead({
      userId: req.user.id,
      notificationId: req.params.notificationId,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
