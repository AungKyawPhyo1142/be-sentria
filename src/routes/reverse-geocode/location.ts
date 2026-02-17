import secureRoute from '@/middlewares/secure-route';
import * as locationController from '@controllers/reverse-geocode/locationController';
import { Router } from 'express';

const router = Router();

router.post(
  '/reverse-geocode',
  secureRoute(),
  locationController.reverseGeoCode,
);

export default router;
