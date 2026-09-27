/**
 * Error Handler + ApiError class
 * 
 * Provides a standard error handling pattern for all Fastify services.
 */

import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { logger } from './logger';
import type { ApiResponse } from './types';

/**
 * Custom API Error with HTTP status code and error code.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  // Common factory methods
  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static notFound(resource = 'Resource') {
    return new ApiError(404, 'NOT_FOUND', `${resource} not found`);
  }

  static conflict(message: string, details?: unknown) {
    return new ApiError(409, 'CONFLICT', message, details);
  }

  static tooManyRequests(message = 'Too many requests') {
    return new ApiError(429, 'TOO_MANY_REQUESTS', message);
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, 'INTERNAL_ERROR', message);
  }
}

/**
 * Fastify error handler — catches all errors and returns a standard envelope.
 * Register this on each Fastify server instance.
 * 
 * Usage:
 *   server.setErrorHandler(errorHandler);
 */
export function errorHandler(
  error: FastifyError | ApiError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  // Handle our custom ApiError
  if (error instanceof ApiError) {
    reply.code(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    } satisfies ApiResponse);
    return;
  }

  // Handle Fastify validation errors
  if ('validation' in error && error.validation) {
    reply.code(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        details: error.validation,
      },
    } satisfies ApiResponse);
    return;
  }

  // Fastify's own client errors — malformed JSON, unsupported media type,
  // body too large — already carry the right status. Without this they fell
  // through to the 500 below, reporting the client's mistake as our failure.
  const fastifyStatus = (error as FastifyError).statusCode;
  if (typeof fastifyStatus === 'number' && fastifyStatus >= 400 && fastifyStatus < 500) {
    reply.code(fastifyStatus).send({
      success: false,
      error: {
        code: typeof (error as FastifyError).code === 'string'
          ? (error as FastifyError).code!
          : 'BAD_REQUEST',
        message: error.message,
      },
    } satisfies ApiResponse);
    return;
  }

  // Handle Supabase/Postgres errors
  if ('code' in error && typeof (error as any).code === 'string') {
    const pgCode = (error as any).code;

    // Class 22 is "data exception": the client sent a value Postgres could not
    // accept for the column's type — a wrong-typed field, a malformed date, a
    // number out of range. That is a bad request, not a server fault.
    //
    // The raw message ("invalid input syntax for type integer: \"many\"")
    // names the offending value and implies the schema, so it is not passed
    // through. The expected type is safe to surface and is genuinely useful.
    if (pgCode.startsWith('22')) {
      const expectedType = /for type (\w+)/.exec(error.message)?.[1];
      reply.code(400).send({
        success: false,
        error: {
          code: 'INVALID_FIELD_VALUE',
          message: expectedType
            ? `A field was given a value that is not a valid ${expectedType}.`
            : 'A field was given a value of the wrong type or format.',
        },
      } satisfies ApiResponse);
      return;
    }

    // 23502 not_null_violation, 23514 check_violation — a required field was
    // missing, or a value failed a constraint. Also the client's doing.
    if (pgCode === '23502' || pgCode === '23514') {
      reply.code(400).send({
        success: false,
        error: {
          code: pgCode === '23502' ? 'MISSING_REQUIRED_FIELD' : 'FIELD_CONSTRAINT_FAILED',
          message: pgCode === '23502'
            ? 'A required field was missing.'
            : 'A field value is not allowed.',
        },
      } satisfies ApiResponse);
      return;
    }

    // 23P01 = exclusion_violation (double-booking)
    if (pgCode === '23P01') {
      reply.code(409).send({
        success: false,
        error: {
          code: 'BOOKING_CONFLICT',
          message: 'The requested time slot overlaps with an existing booking',
        },
      } satisfies ApiResponse);
      return;
    }

    // 23505 = unique_violation
    if (pgCode === '23505') {
      // The raw message names the table and constraint
      // ("...violates unique constraint \"user_profiles_email_key\""), so it
      // is logged rather than returned.
      logger.warn({ err: error.message, url: request.url }, 'Unique constraint violation');
      reply.code(409).send({
        success: false,
        error: {
          code: 'DUPLICATE_ENTRY',
          message: 'A record with this value already exists',
        },
      } satisfies ApiResponse);
      return;
    }
  }

  // Unexpected errors — log and return 500
  logger.error(
    { err: error, method: request.method, url: request.url },
    'Unhandled error',
  );

  reply.code(500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'development'
        ? error.message
        : 'An unexpected error occurred',
    },
  } satisfies ApiResponse);
}

/**
 * Send a success response in the standard envelope.
 */
export function sendSuccess<T>(reply: FastifyReply, data: T, statusCode = 200): void {
  reply.code(statusCode).send({
    success: true,
    data,
  } satisfies ApiResponse<T>);
}

/**
 * Send a paginated success response.
 */
export function sendPaginated<T>(
  reply: FastifyReply,
  data: T[],
  total: number,
  page: number,
  limit: number,
): void {
  reply.code(200).send({
    success: true,
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

