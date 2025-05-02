import exampleRouter from '@/routes/example';
import { Router } from 'express';

const gateway = Router();

gateway.use('/example', exampleRouter);

export default gateway;
