import secureRoute from "@/middlewares/secure-route";
import { upload } from "@/middlewares/upload";
import { Router } from "express";
import * as commentReplyController from '@/controllers/commentReplies/commentReplyController';

const router = Router();

router.get('/comment/:commentId',  secureRoute(), commentReplyController.getCommentRepliesByCommentId)
router.post('/create', secureRoute(), upload.single('commentRepliesImage'), commentReplyController.createCommentReply);
router.patch('/update/:id', secureRoute(), upload.single('commentRepliesImage'), commentReplyController.updateCommentReply);


export default router;