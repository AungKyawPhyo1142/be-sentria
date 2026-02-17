import * as reportController from '@/controllers/reports/reportController';
import secureRoute from '@/middlewares/secure-route';
import { upload } from '@/middlewares/upload';
import { Router } from 'express';

const router = Router();

router.post(
  '/create',
  secureRoute(),
  upload.array('reportImage'),
  reportController.CreateReport,
);
// voting
router.post('/vote/:id', secureRoute(), reportController.voteOnReport);
router.patch(
  '/update/:id',
  secureRoute(),
  upload.array('reportImage'),
  reportController.UpdateDisasterReport,
);
router.get('/', secureRoute(), reportController.GetAllDiasterReports);
router.get('/:id', secureRoute(), reportController.GetDisasterReportById);
router.delete(
  '/delete/:id',
  secureRoute(),
  reportController.DeleteDisasterReport,
);

export default router;
