import * as followersController from '@/controllers/followers/followers';
import secureRoute from '@/middlewares/secure-route';
import { Router } from 'express';

const router = Router();

router.post('/follow', secureRoute(), followersController.followUser);

router.delete('/unfollow', secureRoute(), followersController.unfollowUser);

export default router;
