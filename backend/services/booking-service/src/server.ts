/**
 * Booking Service — Fastify app factory.
 *
 * Kept separate from index.ts so tests can build an app without
 * binding a port.
 */

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { errorHandler } from '@rso/shared';
import { bookingRoutes } from './routes';

export function buildServer(): FastifyInstance {
  const server = Fastify({ logger: false, ignoreTrailingSlash: true });

  server.register(cors, { origin: true });
  server.setErrorHandler(errorHandler);

  server.get('/health', async () => ({
    status: 'ok',
    service: 'booking-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  server.register(bookingRoutes);

  return server;
}
