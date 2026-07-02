/**
 * User Profile Service Routes — Stub
 * 
 * Manages user profiles, signup flow, and role management.
 * TODO: Implement full route handlers
 */

import { FastifyInstance } from 'fastify';
import { authMiddleware, sendSuccess, logger } from '@rso/shared';

export async function userRoutes(server: FastifyInstance): Promise<void> {
  server.get('/api/v1/users/me', {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    sendSuccess(reply, { uid: request.user?.sub });
  });

  logger.info('User routes registered (stub)');
}
