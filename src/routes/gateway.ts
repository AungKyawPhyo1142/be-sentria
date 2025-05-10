import authRouter from '@/routes/auth/auth';
import exampleRouter from '@/routes/example';
import { Router } from 'express';

const gateway = Router();

gateway.use('/example', exampleRouter);
gateway.use('/auth', authRouter);
export default gateway;
