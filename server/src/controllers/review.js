import { createReviewForVerificationIntent } from '../services/reviewService.js';

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
