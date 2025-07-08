import secureRoute from '@/middlewares/secure-route';
import { upload } from '@/middlewares/upload';
import * as resourceController from '@controllers/resources/resourceController';
import { Router } from 'express';

const router = Router();

router.get('/', secureRoute(), resourceController.GetResources);
router.get('/:id', secureRoute(), resourceController.GetResourceById);
router.post(
  '/create',
  secureRoute(),
  upload.array('resourceImages', 5),
  resourceController.CreateResource,
);
router.patch(
  '/update/:id',
  secureRoute(),
  upload.array('resourceImages', 5),
  resourceController.UpdateResource,
);
router.delete('/delete/:id', secureRoute(), resourceController.DeleteResource);

export default router;
