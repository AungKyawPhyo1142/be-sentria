import * as favoriteController from '@/controllers/favorites/favoriteController';
import secureRoute from "@/middlewares/secure-route";
import { Router } from "express";

const router = Router();

router.post('/toggle', secureRoute(), favoriteController.ToggleFavorite);

export default router;