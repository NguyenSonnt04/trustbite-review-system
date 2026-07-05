import { uploadReceiptForReview } from '../services/receiptService.js';

export async function uploadReceiptHandler(req, res, next) {
  try {
    const result = await uploadReceiptForReview({
      userId: req.user.id,
      idempotencyKey: req.header('Idempotency-Key'),
      fields: req.body,
      file: req.file,
    });

    res.status(result.statusCode).json(result.body);
  } catch (err) {
    next(err);
  }
}
