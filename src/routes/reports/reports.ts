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

// voting
router.post('/:id/vote', secureRoute(), reportController.voteOnReport)

export default router;
