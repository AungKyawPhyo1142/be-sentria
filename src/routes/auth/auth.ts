import * as userController from '@/controllers/auth/user';
import secureRoute from '@/middlewares/secure-route';
import { Router } from 'express';

const router = Router();

router.get('/', secureRoute(), userController.auth);
router.post('/register', userController.registerUser);
router.post('/login', userController.loginUser);

export default router;
