import * as favoriteController from '@/controllers/favorites/favoriteController';
import secureRoute from "@/middlewares/secure-route";
import { Router } from "express";

const router = Router();

router.post('/toggle', secureRoute(), favoriteController.ToggleFavorite);
router.get('/', secureRoute(), favoriteController.GetFavorites);
router.get('/:postType', secureRoute(), favoriteController.GetFavoritesByPostType)
export default router;