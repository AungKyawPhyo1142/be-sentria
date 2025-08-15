// src/routes/activityFeed.ts
import secureRoute from '@/middlewares/secure-route';
import * as activityFeedController from '@controllers/activity/activityController';
import { Router } from 'express';

const router = Router();
router.get('/', secureRoute(), activityFeedController.getAllActivityFeedPosts);
router.post('/', secureRoute(), activityFeedController.createActivityFeedPost);
router.get(
  '/:id',
  secureRoute(),
  activityFeedController.getActivityFeedPostById,
);
router.patch(
  '/:id',
  secureRoute(),
  activityFeedController.updateActivityFeedPost,
);
router.delete(
  '/:id',
  secureRoute(),
  activityFeedController.deleteActivityFeedPost,
);

export default router;
