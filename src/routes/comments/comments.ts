import secureRoute from "@/middlewares/secure-route";
import { upload } from "@/middlewares/upload";
import { Router } from "express";
import * as commentController from '@/controllers/comments/commentController';

const router = Router();

router.post('/create', secureRoute(), upload.single('commentsImage'), commentController.CreateComment);

export default router;