import secureRoute from "@/middlewares/secure-route";
import { upload } from "@/middlewares/upload";
import { Router } from "express";
import * as commentController from '@/controllers/comments/commentController';

const router = Router();

router.get('/', secureRoute(), commentController.GetComments);
router.get('/:id', secureRoute(), commentController.GetCommentById)
router.post('/create', secureRoute(), upload.single('commentsImage'), commentController.CreateComment);
router.patch('/update/:id', secureRoute(), upload.single('commentsImage'), commentController.UpdateComment);
router.delete('/delete/:id', secureRoute(), commentController.DeleteComment);

export default router;