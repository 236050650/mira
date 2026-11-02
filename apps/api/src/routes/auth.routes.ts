import {
  LoginRequestSchema,
  OnboardingInterestsSchema,
  RegisterRequestSchema,
  RefreshRequestSchema,
  UpdatePreferencesSchema,
} from "@mira/contracts";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import type { AuthService } from "../auth/auth.service.js";
import { userPreferences, users } from "../db/schema.js";
import type { Db } from "../db/client.js";
import { ErrorCodes, handleRouteError, sendError } from "../http/errors.js";

export function registerAuthRoutes(
  app: FastifyInstance,
  deps: {
    auth: AuthService;
    db: Db;
    requireAuth: (req: any, reply: any) => Promise<void>;
    requireLoginRateLimit: (req: any, reply: any) => Promise<void>;
  },
) {
  app.post("/v1/auth/register", async (request, reply) => {
    try {
      const body = RegisterRequestSchema.parse(request.body);
      const result = await deps.auth.register(body);
      if (!result.ok) {
        return sendError(reply, request, 409, ErrorCodes.AUTH_EMAIL_EXISTS, "该邮箱已注册");
      }
      return reply.status(201).send(result);
    } catch (error) {
      return handleRouteError(error, request, reply);
    }
  });

  app.post(
    "/v1/auth/login",
    { preHandler: deps.requireLoginRateLimit },
    async (request, reply) => {
    try {
      const body = LoginRequestSchema.parse(request.body);
      const result = await deps.auth.login(body);
      if (!result.ok) {
        return sendError(
          reply,
          request,
          401,
          ErrorCodes.AUTH_INVALID_CREDENTIALS,
          "邮箱或密码错误",
        );
      }
      return reply.send(result);
    } catch (error) {
      return handleRouteError(error, request, reply);
    }
    },
  );

  app.post("/v1/auth/refresh", async (request, reply) => {
    try {
      const body = RefreshRequestSchema.parse(request.body);
      const rotated = await deps.auth.rotateRefreshToken(body.refreshToken);
      if (!rotated) {
        return sendError(reply, request, 401, ErrorCodes.AUTH_TOKEN_EXPIRED, "登录已过期，请重新登录");
      }
      const user = await deps.auth.getUser(rotated.userId);
      return reply.send({
        accessToken: rotated.accessToken,
        refreshToken: rotated.refreshToken,
        user,
      });
    } catch (error) {
      return handleRouteError(error, request, reply);
    }
  });

  app.post("/v1/auth/logout", { preHandler: deps.requireAuth }, async (request, reply) => {
    try {
      const body = RefreshRequestSchema.partial().parse(request.body ?? {});
      if (body.refreshToken) {
        await deps.auth.revokeRefreshToken(body.refreshToken);
      }
      return reply.send({ ok: true });
    } catch (error) {
      return handleRouteError(error, request, reply);
    }
  });

  app.get("/v1/auth/me", { preHandler: deps.requireAuth }, async (request, reply) => {
    const user = await deps.auth.getUser(request.userId!);
    if (!user) {
      return sendError(reply, request, 401, ErrorCodes.AUTH_UNAUTHORIZED, "未登录");
    }
    return reply.send({ user });
  });

  app.patch("/v1/me/preferences", { preHandler: deps.requireAuth }, async (request, reply) => {
    try {
      const body = UpdatePreferencesSchema.parse(request.body);
      const userId = request.userId!;
      if (body.nickname || body.bio !== undefined || body.avatarUrl !== undefined) {
        await deps.db
          .update(users)
          .set({
            ...(body.nickname ? { nickname: body.nickname } : {}),
            ...(body.bio !== undefined ? { bio: body.bio } : {}),
            ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));
      }
      await deps.db
        .update(userPreferences)
        .set({
          ...(body.theme ? { theme: body.theme } : {}),
          ...(body.interests ? { interests: body.interests } : {}),
          ...(body.defaultModelProfileId
            ? { defaultModelProfileId: body.defaultModelProfileId }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(userPreferences.userId, userId));
      const user = await deps.auth.getUser(userId);
      return reply.send({ user });
    } catch (error) {
      return handleRouteError(error, request, reply);
    }
  });

  app.post("/v1/me/onboarding", { preHandler: deps.requireAuth }, async (request, reply) => {
    try {
      const body = OnboardingInterestsSchema.parse(request.body);
      await deps.db
        .update(userPreferences)
        .set({
          interests: body.skipped ? [] : body.interests ?? [],
          onboardingCompleted: true,
          updatedAt: new Date(),
        })
        .where(eq(userPreferences.userId, request.userId!));
      const user = await deps.auth.getUser(request.userId!);
      return reply.send({ user });
    } catch (error) {
      return handleRouteError(error, request, reply);
    }
  });
}
