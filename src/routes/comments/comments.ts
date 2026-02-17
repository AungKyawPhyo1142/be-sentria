import * as commentController from '@/controllers/comments/commentController';
import secureRoute from '@/middlewares/secure-route';
import { upload } from '@/middlewares/upload';
import { Router } from 'express';

const router = Router();

// Get all comments
router.get('/', secureRoute(), commentController.GetComments);

// Get comments by post
router.get('/post/:postId', secureRoute(), commentController.GetCommentsByPostId);

// Delete a comment
router.delete('/:id', secureRoute(),commentController.DeleteComment);

// Get single comment
router.get('/:id', secureRoute(), commentController.GetCommentById);

// Create a comment
router.post(
  '/create',
  secureRoute(),
  upload.single('commentsImage'),
  commentController.CreateComment
);

// Update a comment
router.patch(
  '/update/:id',
  secureRoute(),
  upload.single('commentsImage'),
  commentController.UpdateComment
);

export default router;
