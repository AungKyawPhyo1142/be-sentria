import * as userController from '@/controllers/user/user';
import secureRoute from '@/middlewares/secure-route';
import { Router } from 'express';

const router = Router();

router.get('/:id', secureRoute() , userController.details);
router.patch('/:id',secureRoute(), userController.update)
router.delete('/:id',secureRoute(), userController.softDelete)

export default router;