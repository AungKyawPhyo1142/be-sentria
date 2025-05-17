import * as userController from '@/controllers/user/user';
import secureRoute from '@/middlewares/secure-route';
import { Router } from 'express';

const router = Router();

router.get('/:id', secureRoute() , userController.details);

export default router;