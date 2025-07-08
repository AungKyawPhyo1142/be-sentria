import * as userController from '@/controllers/user/user';
import secureRoute from '@/middlewares/secure-route';
import { upload } from '@/middlewares/upload';
import { Router } from 'express';

const router = Router();

router.get('/:id', secureRoute(), userController.details);
router.patch(
  '/:id',
  secureRoute(),
  upload.single('profile_image'),
  userController.update
);
router.delete('/:id', secureRoute(), userController.softDelete);
router.patch('/:id/recover', secureRoute(), userController.recover);

export default router;
