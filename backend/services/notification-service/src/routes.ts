/**
 * Notification Service Routes + Event Consumer — Stub
 * 
 * Listens to Redis Streams for booking events and creates
 * in-app notifications + sends emails.
 * TODO: Implement full route handlers and event consumer
 */

import { FastifyInstance } from 'fastify';
import { authMiddleware, sendSuccess, logger } from '@rso/shared';

export async function notificationRoutes(server: FastifyInstance): Promise<void> {
  server.get('/api/v1/notifications', {
    preHandler: [authMiddleware],
  }, async (_request, reply) => {
    sendSuccess(reply, []);
  });

  logger.info('Notification routes registered (stub)');
}

/**
 * Start Redis Streams event consumer — stub
 */
export function startEventConsumer(): void {
  logger.info('Notification event consumer started (stub — no-op)');
}
