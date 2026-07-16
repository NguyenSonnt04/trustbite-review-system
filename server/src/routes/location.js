import { Router } from 'express';
import {
  calculateRouteHandler,
  reverseGeocodeHandler,
  searchPlacesHandler,
} from '../controllers/location.js';

const router = Router();

router.get('/search', searchPlacesHandler);
router.get('/reverse-geocode', reverseGeocodeHandler);
router.get('/route', calculateRouteHandler);

export default router;
