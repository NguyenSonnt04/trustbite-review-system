import {
  createBillScan,
  getBillScan,
} from '../services/billScanService.js';

export async function createBillScanHandler(req, res, next) {
  try {
    const result = await createBillScan({
      userId: req.user.id,
      restaurantId: req.body?.restaurantId,
      branchId: req.body?.branchId,
      idempotencyKey: req.headers['idempotency-key'],
      file: req.file,
    });
    if (result.replayed) {
      res.set('Idempotency-Replayed', 'true');
    }
    return res.status(result.statusCode).json(result.body);
  } catch (error) {
    next(error);
  }
}

export async function getBillScanHandler(req, res, next) {
  try {
    const result = await getBillScan({
      scanId: req.params.scanId,
      userId: req.user.id,
    });
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
