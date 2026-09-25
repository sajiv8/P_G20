/**
 * Booking & Optimization Service — Entry Point
 */

import { logger } from '@rso/shared';
import { buildServer } from './server';

const server = buildServer();

const start = async () => {
  try {
    const port = parseInt(process.env.BOOKING_SERVICE_PORT || '3004', 10);
    await server.listen({ port, host: '0.0.0.0' });
    logger.info({ port, service: 'booking-service' }, 'Booking & Optimization Service started');
  } catch (err) {
    logger.error(err, 'Booking Service failed to start');
    process.exit(1);
  }
};

start();
