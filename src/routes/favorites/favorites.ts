import * as favoriteController from '@/controllers/favorites/favoriteController';
import secureRoute from "@/middlewares/secure-route";
import { Router } from "express";

const router = Router();

router.post('/add', secureRoute(), favoriteController.CreateFavorite);
router.delete('/remove/:id', secureRoute(), favoriteController.RemoveFavorite);

export default router;