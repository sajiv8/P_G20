/**
 * Notification Service — Entry Point
 * 
 * Starts both the HTTP API and the Redis Streams event consumer.
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { logger, errorHandler, getAllowedOrigins } from '@rso/shared';
import { notificationRoutes, startBookingEventConsumer, startSystemEventConsumer } from './routes';
import { verifyMailerConnection } from './mail/mailer';

const server = Fastify({ logger: false, ignoreTrailingSlash: true });

server.register(cors, { origin: getAllowedOrigins() });
server.setErrorHandler(errorHandler);

server.get('/health', async () => ({
  status: 'ok',
  service: 'notification-service',
  timestamp: new Date().toISOString(),
  uptime: process.uptime(),
}));

server.register(notificationRoutes);

const start = async () => {
  try {
    const port = parseInt(process.env.NOTIFICATION_SERVICE_PORT || '3005', 10);
    await server.listen({ port, host: '0.0.0.0' });
    logger.info({ port, service: 'notification-service' }, 'Notification Service started');

    // Verify SMTP connection
    await verifyMailerConnection();

    // Start Redis Streams event consumers
    startBookingEventConsumer();
    startSystemEventConsumer();
  } catch (err) {
    logger.error(err, 'Notification Service failed to start');
    process.exit(1);
  }
};

start();

