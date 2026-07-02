/**
 * ST Booking Routes — Stub
 * 
 * P2P Student borrowing system.
 * TODO: Implement full route handlers
 */

import { FastifyInstance } from 'fastify';
import { logger } from '@rso/shared';

export async function stBookingRoutes(server: FastifyInstance): Promise<void> {
  logger.info('ST Booking routes registered (stub)');
}
