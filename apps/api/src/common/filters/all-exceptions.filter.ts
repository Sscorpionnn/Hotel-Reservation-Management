import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Response } from "express";
import { randomUUID } from "node:crypto";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const requestId = randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = "Internal server error";
    let code = "INTERNAL_ERROR";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message =
        typeof body === "string"
          ? body
          : (((body as Record<string, unknown>).message as string | string[]) ?? exception.message);
      code = exception.constructor.name.replace("Exception", "").toUpperCase();
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === "P2002") {
        status = HttpStatus.CONFLICT;
        message = "The requested resource conflicts with an existing one";
        code = "CONFLICT";
      } else if (exception.code === "P2025") {
        status = HttpStatus.NOT_FOUND;
        message = "Resource not found";
        code = "NOT_FOUND";
      } else {
        status = HttpStatus.BAD_REQUEST;
        message = "Invalid request";
        code = "BAD_REQUEST";
      }
    }

    // Never leak internals (stack traces, SQL, secrets) to the client —
    // only ever log them server-side, tagged with a correlation id.
    if (status >= 500) {
      this.logger.error(`[${requestId}] ${(exception as Error)?.stack ?? exception}`);
    }

    response.status(status).json({
      statusCode: status,
      code,
      message,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
