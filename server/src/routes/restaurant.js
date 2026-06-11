import { Router } from 'express';
import { createHttpError } from '../utils/httpErrors.js';

const router = Router();

router.use(() => {
  throw createHttpError(501, 'ROUTE_NOT_IMPLEMENTED', 'Restaurant routes are not implemented yet');
});

export default router;
