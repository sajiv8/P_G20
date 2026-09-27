/**
 * User Profile Service — Fastify app factory.
 *
 * Kept separate from index.ts so tests can build an app without binding a port.
 */

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { errorHandler, getAllowedOrigins } from '@rso/shared';
import { userRoutes } from './routes';

export function buildServer(): FastifyInstance {
  const server = Fastify({
    logger: false,
    ignoreTrailingSlash: true,
    bodyLimit: 5 * 1024 * 1024, // 5MB — base64 images are ~33% larger than raw bytes
  });

  server.register(cors, { origin: getAllowedOrigins() });
  server.setErrorHandler(errorHandler);

  server.get('/health', async () => ({
    status: 'ok',
    service: 'user-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  server.register(userRoutes);

  return server;
}
