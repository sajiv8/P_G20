/**
 * ST Resource Routes — Stub
 * 
 * CRUD for Student Shared Resources.
 * TODO: Implement full route handlers
 */

import { FastifyInstance } from 'fastify';
import { logger } from '@rso/shared';

export async function stResourceRoutes(server: FastifyInstance): Promise<void> {
  logger.info('ST Resource routes registered (stub)');
}
