/**
 * Tenant Service Routes — Stub
 * 
 * CRUD for tenants (faculties/departments).
 * TODO: Implement full route handlers
 */

import { FastifyInstance } from 'fastify';
import { authMiddleware, sendSuccess, logger } from '@rso/shared';

export async function tenantRoutes(server: FastifyInstance): Promise<void> {
  server.get('/api/v1/tenants', {
    preHandler: [authMiddleware],
  }, async (_request, reply) => {
    sendSuccess(reply, []);
  });

  logger.info('Tenant routes registered (stub)');
}
