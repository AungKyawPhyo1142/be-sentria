import * as resourceController from '@controllers/resources/resourceController';
import secureRoute from "@/middlewares/secure-route";
import { Router } from "express";

const router = Router();

router.post('/create', secureRoute(), resourceController.CreateResource);
router.patch('/update/:id', secureRoute(), resourceController.UpdateResource);

export default router;