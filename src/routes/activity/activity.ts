import * as activityController from '@/controllers/activity/activityController';
import secureRoute from '@/middlewares/secure-route';
import { Router } from 'express';

const router = Router();

router.get('/', secureRoute(), activityController.GetActivities);
router.get('/:id', secureRoute(), activityController.GetActivityById);
router.post('/create', secureRoute(), activityController.CreateActivity);
router.patch('/update/:id', secureRoute(), activityController.UpdateActivity);
router.delete('/delete/:id', secureRoute(), activityController.DeleteActivity);

export default router;
