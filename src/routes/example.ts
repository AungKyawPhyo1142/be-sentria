// REST API routes, keep them clean & short
import secureRoute from '@/middlewares/secure-route';
import * as exampleController from '@controllers/example';
import { Router } from 'express';

const router = Router();

router.get('/', exampleController.getRandom);
router.get('/sum', exampleController.sumQuery);
router.post('/sum', exampleController.sum);
router.put('/number', exampleController.updateNumber);
router.patch('/number', exampleController.patchNumber);

// -- RabbitMQ Test
router.post(
  '/test-rabbitmq',
  secureRoute(),
  exampleController.sendTestRabbitMQMessage,
);

// -- Websocket Test
router.post('/test-websocket', exampleController.testWebSocketMessage);
router.post('/debug/trigger-quake-alert', exampleController.triggerQuakeAlert);


export default router;
