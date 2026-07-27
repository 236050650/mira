import { createHash, randomUUID } from "node:crypto";
import * as argon2 from "argon2";
import { and, eq, isNull } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import type { AppConfig } from "../config.js";
import type { Db } from "../db/client.js";
import { refreshTokens, userPreferences, users } from "../db/schema.js";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export class AuthService {
  constructor(
    private readonly db: Db,
    private readonly config: AppConfig,
  ) {}

  private accessSecret() {
    return new TextEncoder().encode(this.config.jwtAccessSecret);
  }

  private refreshSecret() {
    return new TextEncoder().encode(this.config.jwtRefreshSecret);
  }

  async hashPassword(password: string) {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async verifyPassword(hash: string, password: string) {
    return argon2.verify(hash, password);
  }

  async signAccessToken(userId: string) {
    return new SignJWT({ sub: userId, typ: "access" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${this.config.accessTokenTtlSec}s`)
      .sign(this.accessSecret());
  }

  async issueRefreshToken(userId: string, deviceName?: string) {
    const raw = randomUUID() + randomUUID();
    const tokenHash = sha256(raw);
    const expiresAt = new Date(Date.now() + this.config.refreshTokenTtlSec * 1000);
    await this.db.insert(refreshTokens).values({
      id: randomUUID(),
      userId,
      tokenHash,
      deviceName: deviceName ?? null,
      expiresAt,
    });
    return raw;
  }

  async rotateRefreshToken(oldRaw: string, deviceName?: string) {
    const oldHash = sha256(oldRaw);
    const existing = await this.db.query.refreshTokens.findFirst({
      where: and(eq(refreshTokens.tokenHash, oldHash), isNull(refreshTokens.revokedAt)),
    });
    if (!existing || existing.expiresAt.getTime() < Date.now()) {
      return null;
    }
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(refreshTokens.id, existing.id));
    const accessToken = await this.signAccessToken(existing.userId);
    const refreshToken = await this.issueRefreshToken(existing.userId, deviceName);
    return { userId: existing.userId, accessToken, refreshToken };
  }

  async revokeRefreshToken(raw: string) {
    const tokenHash = sha256(raw);
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, tokenHash));
  }

  async verifyAccessToken(token: string) {
    try {
      const { payload } = await jwtVerify(token, this.accessSecret());
      if (payload.typ !== "access" || typeof payload.sub !== "string") return null;
      return payload.sub;
    } catch {
      return null;
    }
  }

  async register(input: { email: string; nickname: string; password: string }) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) {
      return { ok: false as const, code: "AUTH_EMAIL_EXISTS" as const };
    }
    const passwordHash = await this.hashPassword(input.password);
    const [user] = await this.db
      .insert(users)
      .values({
        id: randomUUID(),
        email,
        nickname: input.nickname.trim(),
        passwordHash,
      })
      .returning();
    if (!user) throw new Error("Failed to create user");
    await this.db.insert(userPreferences).values({ userId: user.id });
    const accessToken = await this.signAccessToken(user.id);
    const refreshToken = await this.issueRefreshToken(user.id);
    return {
      ok: true as const,
      user: this.publicUser(user),
      accessToken,
      refreshToken,
    };
  }

  async login(input: { email: string; password: string }) {
    const email = input.email.trim().toLowerCase();
    const user = await this.db.query.users.findFirst({ where: eq(users.email, email) });
    if (!user) {
      return { ok: false as const, code: "AUTH_INVALID_CREDENTIALS" as const };
    }
    const valid = await this.verifyPassword(user.passwordHash, input.password);
    if (!valid) {
      return { ok: false as const, code: "AUTH_INVALID_CREDENTIALS" as const };
    }
    const accessToken = await this.signAccessToken(user.id);
    const refreshToken = await this.issueRefreshToken(user.id);
    return {
      ok: true as const,
      user: this.publicUser(user),
      accessToken,
      refreshToken,
    };
  }

  async getUser(userId: string) {
    const user = await this.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) return null;
    const preferences = await this.db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, userId),
    });
    return { ...this.publicUser(user), preferences };
  }

  publicUser(user: typeof users.$inferSelect) {
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      status: user.status,
      createdAt: user.createdAt,
    };
  }
}
