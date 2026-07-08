import {
  createReviewForVerificationIntent,
  getReviewVerificationStatus,
} from '../services/reviewService.js';

export async function createReviewHandler(req, res, next) {
  try {
    const result = await createReviewForVerificationIntent({
      userId: req.user.id,
      payload: req.body,
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getReviewStatusHandler(req, res, next) {
  try {
    const result = await getReviewVerificationStatus({
      userId: req.user.id,
      reviewId: req.params.reviewId,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
