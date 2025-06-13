import { ENV } from '@/env';
import logger from '@/logger';
import { Server as HTTPServer } from 'http';
import { Socket, Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer | null = null;

interface ServerToClientEvents {
  connection_ack: (data: { message: string }) => void;
  report_factcheck_update: (data: {
    reportId: string; // postgresReportId
    factCheck: any; // TODO: define specific type later
  }) => void;
}

interface ClientToServerEvents {
  subscribe_to_report: (
    reportId: string,
    ack?: (status: string) => void,
  ) => void;
  unsubscribe_from_report: (
    reportId: string,
    ack?: (status: string) => void,
  ) => void;
}

interface InterServerEvents {
  // server to server events
}

interface SocketData {
  // data that is attached to the socket
  // can store user-specific data here if needed after authentication
}

export function initSocketIOServer(httpServer: HTTPServer): SocketIOServer {
  if (io) {
    logger.info('[SocketIO] SocketIO server already initialized');
    return io;
  }

  io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: ENV.CORS_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    logger.info(`[SocketIO] Socket connected: ${socket.id}`);
    socket.emit('connection_ack', { message: 'Connected to SocketIO server' });

    socket.on(
      'subscribe_to_report',
      (reportId: string, ack?: (status: string) => void) => {
        if (reportId && typeof reportId === 'string') {
          socket.join(reportId);
          logger.info(
            `[SocketIO] Socket ${socket.id} subscribed to report ${reportId}`,
          );
          if (ack) ack('subscribed_to_' + reportId);
        } else {
          logger.warn(`[SocketIO] Invalid reportId: ${reportId}`);
          if (ack) ack(`invalid_reportId: ${reportId}`);
        }
      },
    );

    socket.on(
      'unsubscribe_from_report',
      (reportId: string, ack?: (status: string) => void) => {
        if (reportId && typeof reportId === 'string') {
          socket.leave(reportId);
          logger.info(
            `[SocketIO] Socket ${socket.id} unsubscribed from report ${reportId}`,
          );
          if (ack) ack('unsubscribed_from_' + reportId);
        } else {
          logger.warn(`[SocketIO] Invalid reportId: ${reportId}`);
          if (ack) ack(`invalid_reportId: ${reportId}`);
        }
      },
    );

    socket.on('disconnect', (reason) => {
      logger.info(
        `[SocketIO] Socket disconnected: ${socket.id}. Reason: ${reason}`,
      );
    });

    socket.on('error', (error) => {
      logger.error(`[SocketIO] Socket error: ${socket.id}. Error: ${error}`);
    });
  });

  const address = httpServer.address();
  const port = typeof address === 'string' ? address : address?.port;
  logger.info(
    `[SocketIO] SocketIO server listening on ws://host:${port}/socket.io/ (default path)`,
  );
  return io;
}

export function emitFactCheckUpdateToRoom(
  reportId: string,
  factCheckData: any,
) {
  if (!io) {
    logger.warn('[SocketIO] SocketIO server not initialized');
    return;
  }

  const eventPayload = {
    reportId,
    factCheck: factCheckData,
  };
  // emit to the specific room
  io.to(reportId).emit('report_factcheck_update', eventPayload); // TODO: define specific type later
  logger.info(
    `[SocketIO] Emitted factCheck update to room ${reportId}. Payload: ${JSON.stringify(
      eventPayload,
    )}`,
  );
}

// broadcast to all clients if needed
export function broadcastToAll(eventName: string, data: any) {
  if (!io) {
    logger.warn('[SocketIO] SocketIO server not initialized');
    return;
  }
  io.emit(eventName, data);
  logger.info(
    `[SocketIO] Broadcasted to all clients. Event: ${eventName}. Payload: ${JSON.stringify(
      data,
    )}`,
  );
}

export function getIOInstance(): SocketIOServer | null {
  return io;
}
