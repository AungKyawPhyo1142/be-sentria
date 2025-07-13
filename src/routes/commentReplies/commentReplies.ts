import secureRoute from "@/middlewares/secure-route";
import { upload } from "@/middlewares/upload";
import { Router } from "express";
import * as commentReplyController from '@/controllers/commentReplies/commentReplyController';

const router = Router();

router.get('/:id', secureRoute(), commentReplyController.getCommentReplyById);
router.get('/comment/:commentId',  secureRoute(), commentReplyController.getCommentRepliesByCommentId)
router.post('/create', secureRoute(), upload.single('commentRepliesImage'), commentReplyController.createCommentReply);
router.patch('/update/:id', secureRoute(), upload.single('commentRepliesImage'), commentReplyController.updateCommentReply);
router.delete('/delete/:id', secureRoute(), commentReplyController.deleteCommentReply);

export default router;