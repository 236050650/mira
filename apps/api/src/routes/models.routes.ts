import { ErrorCodes, MODEL_PROFILES, resolveModelProfile, type ModelProfileId } from "@mira/contracts";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppConfig } from "../config.js";
import type { Db } from "../db/client.js";
import { handleRouteError, sendError } from "../http/errors.js";
import type { ModelGateway } from "@mira/model-gateway";

const STATUS_PROFILE_IDS = ["deepseek-flash", "deepseek-pro", "ollama-local"] as const;

export function registerModelRoutes(
  app: FastifyInstance,
  deps: {
    db: Db;
    gateway: ModelGateway;
    config: AppConfig;
    requireAuth: (req: any, reply: any) => Promise<void>;
  },
) {
  app.get("/v1/models/status", { preHandler: deps.requireAuth }, async (request, reply) => {
    try {
      const profiles = await Promise.all(
        STATUS_PROFILE_IDS.map(async (profileId) => {
          const profile = resolveModelProfile(profileId, deps.config.ollamaDefaultModel);
          const provider = deps.gateway.resolveProviderForMode(
            deps.config.modelMode === "mock" ? "mock" : profile.provider,
          );
          const health = await provider.healthCheck();
          return {
            id: profile.id,
            provider: profile.provider,
            model: profile.model,
            displayName: MODEL_PROFILES[profileId].displayName,
            available: health.ok,
            latencyMs: health.latencyMs ?? null,
            detail: health.detail ?? null,
          };
        }),
      );

      return reply.send({
        defaultProfileId: deps.config.modelMode === "local" ? "ollama-local" : "deepseek-flash",
        mode: deps.config.modelMode,
        remoteTokensUsed: deps.gateway.getRemoteTokensUsed(),
        remoteTokenBudget: deps.gateway.dailyRemoteTokenBudget,
        profiles,
      });
    } catch (error) {
      return handleRouteError(error, request, reply);
    }
  });

  app.post("/v1/models/test", { preHandler: deps.requireAuth }, async (request, reply) => {
    try {
      const body = z
        .object({ profileId: z.enum(["auto", "deepseek-flash", "deepseek-pro", "ollama-local"]) })
        .parse(request.body);

      let profile;
      try {
        profile = resolveModelProfile(body.profileId as ModelProfileId, deps.config.ollamaDefaultModel);
      } catch {
        return sendError(reply, request, 400, ErrorCodes.MODEL_PROFILE_INVALID, "模型配置无效");
      }

      const provider = deps.gateway.resolveProviderForMode(
        deps.config.modelMode === "mock" ? "mock" : profile.provider,
      );
      const health = await provider.healthCheck();

      return reply.send({
        profileId: profile.id,
        provider: profile.provider,
        model: profile.model,
        available: health.ok,
        latencyMs: health.latencyMs ?? null,
        detail: health.detail ?? null,
      });
    } catch (error) {
      return handleRouteError(error, request, reply);
    }
  });
}
