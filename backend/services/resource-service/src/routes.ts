/**
 * Resource Service Routes — Stub
 * 
 * CRUD for bookable resources (labs, lecture halls, equipment).
 * TODO: Implement full route handlers
 */

import { FastifyInstance } from 'fastify';
import { authMiddleware, sendSuccess, logger } from '@rso/shared';

export async function resourceRoutes(server: FastifyInstance): Promise<void> {
  server.get('/api/v1/resources', {
    preHandler: [authMiddleware],
  }, async (_request, reply) => {
    sendSuccess(reply, []);
  });

  logger.info('Resource routes registered (stub)');
}
