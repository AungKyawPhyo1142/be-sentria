import * as userController from '@/controllers/auth/user';
import secureRoute from '@/middlewares/secure-route';
import { Router } from 'express';

const router = Router();

router.get('/', secureRoute(), userController.auth);
router.post('/register', userController.registerUser);
router.post('/login', userController.loginUser);
router.get('/verify-email/:token', userController.verifyEmail);
router.post('/resend-email', userController.resendEmail);

export default router;
