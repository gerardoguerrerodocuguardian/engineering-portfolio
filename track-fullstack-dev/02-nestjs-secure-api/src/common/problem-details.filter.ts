import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: string[];
}

const TYPES: Record<number, string> = {
  400: 'validation-error',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not-found',
  409: 'conflict',
  429: 'too-many-requests',
};

/** Maps every error to an RFC 7807 `application/problem+json` response. */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<Request>();

    const problem = this.toProblem(exception);
    problem.instance = req.originalUrl;
    if (problem.status >= 500) {
      this.logger.error(
        exception instanceof Error ? (exception.stack ?? exception.message) : exception,
      );
    }
    res.status(problem.status).type('application/problem+json').send(JSON.stringify(problem));
  }

  private toProblem(exception: unknown): ProblemDetails {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string' ? body : (body as { message?: string | string[] }).message;
      const title = HttpStatus[status]?.replace(/_/g, ' ').toLowerCase() ?? 'error';
      const problem: ProblemDetails = {
        type: `https://api.adflow.local/problems/${TYPES[status] ?? 'error'}`,
        title: title.charAt(0).toUpperCase() + title.slice(1),
        status,
      };
      if (Array.isArray(message)) {
        problem.detail = 'Request validation failed';
        problem.errors = message;
      } else if (message) {
        problem.detail = message;
      }
      return problem;
    }
    // Never leak internals for unexpected errors.
    return {
      type: 'https://api.adflow.local/problems/internal-error',
      title: 'Internal server error',
      status: 500,
      detail: 'An unexpected error occurred',
    };
  }
}
