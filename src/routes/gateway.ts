import activityRouter from '@/routes/activity/activity';
import authRouter from '@/routes/auth/auth';
import exampleRouter from '@/routes/example';
import followersRouter from '@/routes/followers/followers';
import goTestRouter from '@/routes/goServiceTest/goServiceTest';
import reportRouter from '@/routes/reports/reports';
import resourceRouter from '@/routes/resources/resources';
import userRouter from '@/routes/user/user';
import commentsRouter from '@/routes/comments/comments';
import commentRepliesRouter from '@/routes/commentReplies/commentReplies';
import { Router } from 'express';

const gateway = Router();

gateway.use('/example', exampleRouter);
gateway.use('/auth', authRouter);
gateway.use('/report', reportRouter);
gateway.use('/users', userRouter);
gateway.use('/resource', resourceRouter);
gateway.use('/goTest', goTestRouter);
gateway.use('/followers', followersRouter);
gateway.use('/activity', activityRouter);
gateway.use('/comments', commentsRouter);
gateway.use('/commentReplies', commentRepliesRouter);

export default gateway;
