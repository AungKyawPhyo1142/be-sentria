import secureRoute from "@/middlewares/secure-route";
import { upload } from "@/middlewares/upload";
import { Router } from "express";
import * as commentReplyController from '@/controllers/commentReplies/commentReplyController';

const router = Router();

router.post('/create', secureRoute(), upload.single('commentRepliesImage'), commentReplyController.createCommentReply);

export default router;