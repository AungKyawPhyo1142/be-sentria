import * as favoriteController from '@/controllers/favorites/favoriteController';
import secureRoute from "@/middlewares/secure-route";
import { Router } from "express";

const router = Router();

router.post('/create', secureRoute(), favoriteController.CreateFavorite);

export default router;