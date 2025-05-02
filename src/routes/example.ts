// REST API routes, keep them clean & short
import * as exampleController from '@controllers/example';
import { Router } from 'express';

const router = Router();

router.get('/', exampleController.getRandom);
router.get('/sum', exampleController.sumQuery);
router.post('/sum', exampleController.sum);
router.put('/number', exampleController.updateNumber);
router.patch('/number', exampleController.patchNumber);

export default router;
