import authRouter from '@/routes/auth/auth';
import userRouter from '@/routes/user/user';
import exampleRouter from '@/routes/example';
import { Router } from 'express';

const gateway = Router();

gateway.use('/example', exampleRouter);
gateway.use('/auth', authRouter);
gateway.use('/users', userRouter);
export default gateway;
