import {
  decideRestaurantClaim,
  listAdminRestaurants,
  listAdminRestaurantClaims,
  listMerchantClaims,
  listMerchantRestaurants,
  submitRestaurantClaim,
} from '../services/restaurantClaimService.js';

export async function submitRestaurantClaimHandler(req, res, next) {
  try {
    const result = await submitRestaurantClaim({
      userId: req.user.id,
      restaurantId: req.body?.restaurantId,
      requestedPermissionLevel: req.body?.requestedPermissionLevel,
      idempotencyKey: req.headers['idempotency-key'],
      file: req.file,
    });
    if (result.replayed) {
      res.set('Idempotency-Replayed', 'true');
    }
    res.status(result.statusCode).json(result.body);
  } catch (err) {
    next(err);
  }
}

export async function listMerchantClaimsHandler(req, res, next) {
  try {
    const result = await listMerchantClaims({
      userId: req.user.id,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listMerchantRestaurantsHandler(req, res, next) {
  try {
    const result = await listMerchantRestaurants({
      userId: req.user.id,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listAdminRestaurantClaimsHandler(req, res, next) {
  try {
    const result = await listAdminRestaurantClaims({
      status: req.query.status,
      page: req.query.page ?? 1,
      pageSize: req.query.pageSize ?? 20,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listAdminRestaurantsHandler(req, res, next) {
  try {
    const result = await listAdminRestaurants({
      keyword: req.query.keyword,
      page: req.query.page ?? 1,
      pageSize: req.query.pageSize ?? 50,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function decideRestaurantClaimHandler(req, res, next) {
  try {
    const result = await decideRestaurantClaim({
      adminUserId: req.user.id,
      roles: req.user.roles,
      claimId: req.params.claimId,
      decision: req.body?.decision,
      adminNote: req.body?.adminNote,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
