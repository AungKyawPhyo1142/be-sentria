import authRouter from '@/routes/auth/auth';
import userRouter from '@/routes/user/user';
import exampleRouter from '@/routes/example';
import reportRouter from '@/routes/reports/reports';
import resourceRouter from '@/routes/resources/resources';
import { Router } from 'express';

const gateway = Router();

gateway.use('/example', exampleRouter);
gateway.use('/auth', authRouter);
gateway.use('/report', reportRouter);
gateway.use('/users', userRouter);
gateway.use('/resource', resourceRouter);

export default gateway;
