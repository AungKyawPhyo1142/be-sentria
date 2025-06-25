import { Router } from 'express';
import secureRoute from '@/middlewares/secure-route';
import * as followersController from '@/controllers/followers/followers';

const router = Router();

router.post('/follow', secureRoute(), followersController.followUser);

router.delete('/unfollow', secureRoute(), followersController.unfollowUser);

export default router;
