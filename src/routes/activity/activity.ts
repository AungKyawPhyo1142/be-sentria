// src/routes/activityFeed.ts
import secureRoute from '@/middlewares/secure-route';
import * as activityFeedController from '@controllers/activity/activityController';
import { Router } from 'express';

const router = Router();

router.post('/', secureRoute(), activityFeedController.createActivityFeedPost);

export default router;
