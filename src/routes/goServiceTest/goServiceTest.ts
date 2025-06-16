import * as goTestController from '@controllers/goTest/goTestController';
import { Router } from 'express';

const router = Router();

router.get(
  '/send-bulk-test-jobs',
  goTestController.sendBulkTestDisasterReportsToQueue,
);

export default router;
