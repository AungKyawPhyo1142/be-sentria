import * as resourceController from '@controllers/resources/resourceController';
import secureRoute from "@/middlewares/secure-route";
import { Router } from "express";

const router = Router();

router.get('/', secureRoute(), resourceController.GetResources);
router.get('/:id', secureRoute(), resourceController.GetResourceById);
router.post('/create', secureRoute(), resourceController.CreateResource);
router.patch('/update/:id', secureRoute(), resourceController.UpdateResource);
router.delete('/delete/:id', secureRoute(), resourceController.DeleteResource);

export default router;