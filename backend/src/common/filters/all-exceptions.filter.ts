import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const responseMessage =
      exception instanceof HttpException
        ? exception.getResponse()
        : (exception as Error)?.message ?? 'Internal server error';
    const message =
      process.env.NODE_ENV === 'production' && !(exception instanceof HttpException)
        ? 'Internal server error'
        : responseMessage;

    this.logger.error(
      `${req.method} ${req.url} -> ${status} ${JSON.stringify(message)}`,
      (exception as Error)?.stack,
    );

    res.status(status).json({
      statusCode: status,
      path: req.url,
      timestamp: new Date().toISOString(),
      error: typeof message === 'string' ? message : (message as any),
    });
  }
}
