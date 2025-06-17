import * as reportController from '@/controllers/reports/reportController';
import secureRoute from '@/middlewares/secure-route';
import { Router } from 'express';
import { upload } from '@/middlewares/upload';

const router = Router();

router.post('/create', secureRoute(), upload.single('reportImage'), reportController.CreateReport);
router.get('/', secureRoute(), reportController.GetAllDiasterReports);

export default router;
