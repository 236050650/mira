import { ErrorCodes, type ApiErrorBody, type ErrorCode } from "@mira/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";

declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
    userId?: string;
  }
}

export function attachRequestId(request: FastifyRequest, reply: FastifyReply) {
  const requestId = (request.headers["x-request-id"] as string) || randomUUID();
  request.requestId = requestId;
  reply.header("x-request-id", requestId);
}

export function sendError(
  reply: FastifyReply,
  request: FastifyRequest,
  status: number,
  code: ErrorCode | string,
  message: string,
  details?: unknown,
) {
  const body: ApiErrorBody = {
    error: {
      code,
      message,
      requestId: request.requestId,
      ...(details !== undefined ? { details } : {}),
    },
  };
  return reply.status(status).send(body);
}

function firstZodMessage(error: ZodError): string {
  const flattened = error.flatten();
  for (const messages of Object.values(flattened.fieldErrors)) {
    if (Array.isArray(messages) && messages[0]) return messages[0];
  }
  if (flattened.formErrors[0]) return flattened.formErrors[0];
  return error.issues[0]?.message || "参数校验失败";
}

export function handleRouteError(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof ZodError) {
    return sendError(
      reply,
      request,
      400,
      ErrorCodes.VALIDATION_FAILED,
      firstZodMessage(error),
      error.flatten(),
    );
  }
  request.log.error({ err: error, requestId: request.requestId }, "unhandled error");
  return sendError(reply, request, 500, ErrorCodes.INTERNAL_ERROR, "服务暂时不可用");
}

export { ErrorCodes };
