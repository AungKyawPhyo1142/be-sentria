import authRouter from '@/routes/auth/auth';
import exampleRouter from '@/routes/example';
import goTestRouter from '@/routes/goServiceTest/goServiceTest';
import reportRouter from '@/routes/reports/reports';
import userRouter from '@/routes/user/user';
import { Router } from 'express';

const gateway = Router();

gateway.use('/example', exampleRouter);
gateway.use('/auth', authRouter);
gateway.use('/report', reportRouter);
gateway.use('/users', userRouter);
gateway.use('/goTest', goTestRouter);

export default gateway;
