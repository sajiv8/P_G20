/**
 * User Profile Service — Entry Point
 */

import { logger } from '@rso/shared';
import { buildServer } from './server';

const server = buildServer();

const start = async () => {
  try {
    const port = parseInt(process.env.USER_SERVICE_PORT || '3002', 10);
    await server.listen({ port, host: '0.0.0.0' });
    logger.info({ port, service: 'user-service' }, 'User Profile Service started');
  } catch (err) {
    logger.error(err, 'User Profile Service failed to start');
    process.exit(1);
  }
};

start();
