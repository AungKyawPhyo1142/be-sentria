import * as reportController from '@/controllers/reports/reportController';
import secureRoute from '@/middlewares/secure-route';
import { Router } from 'express';

const router = Router();

router.post('/create', secureRoute(),reportController.CreateReport);

export default router;
