import authRouter from '@/routes/auth/auth';
import exampleRouter from '@/routes/example';
import reportRouter from '@/routes/reports/reports';
import { Router } from 'express';

const gateway = Router();

gateway.use('/example', exampleRouter);
gateway.use('/auth', authRouter);
gateway.use('/report', reportRouter);
export default gateway;
