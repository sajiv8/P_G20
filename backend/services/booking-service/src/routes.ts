/**
 * Booking & Optimization Service Routes — Stub
 * 
 * Handles booking CRUD, approval workflow, and optimization analytics.
 * TODO: Implement full route handlers
 */

import { FastifyInstance } from 'fastify';
import { authMiddleware, sendSuccess, logger } from '@rso/shared';

export async function bookingRoutes(server: FastifyInstance): Promise<void> {
  server.get('/api/v1/bookings', {
    preHandler: [authMiddleware],
  }, async (_request, reply) => {
    sendSuccess(reply, []);
  });

  logger.info('Booking routes registered (stub)');
}
