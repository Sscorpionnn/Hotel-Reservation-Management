import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import * as argon2 from "argon2";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterOrganizationDto } from "./dto/register-organization.dto";
import { LoginDto } from "./dto/login.dto";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
// A fixed hash verified against on "user not found" so login timing does
// not leak whether an email address exists in the system.
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$P3f8x8qy3H8b8sT8yq8Z0h1uJmS5V3f9m9G9m9G9m9G";

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async registerOrganization(dto: RegisterOrganizationDto) {
    const existingSlug = await this.prisma.organization.findUnique({
      where: { slug: dto.organizationSlug },
    });
    if (existingSlug) throw new ConflictException("Organization slug already in use");

    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) throw new ConflictException("Email already registered");

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    const org = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: dto.organizationName, slug: dto.organizationSlug },
      });
      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: "ORG_ADMIN",
        },
      });
      return { organization, user };
    });

    return { organizationId: org.organization.id, userId: org.user.id };
  }

  async login(
    dto: LoginDto,
    meta: { ip?: string; userAgent?: string },
  ): Promise<IssuedTokens & { userId: string }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user) {
      await argon2.verify(DUMMY_HASH, dto.password).catch(() => undefined);
      throw new UnauthorizedException("Invalid credentials");
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException("Account is temporarily locked. Try again later.");
    }
    if (user.status !== "ACTIVE") {
      throw new UnauthorizedException("Account is not active");
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      const failedCount = user.failedLoginCount + 1;
      const shouldLock = failedCount >= MAX_FAILED_ATTEMPTS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: shouldLock ? 0 : failedCount,
          lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : undefined,
        },
      });
      throw new UnauthorizedException("Invalid credentials");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokenPair(user, randomUUID(), meta);
    return { ...tokens, userId: user.id };
  }

  async refresh(
    rawRefreshToken: string,
    meta: { ip?: string; userAgent?: string },
  ): Promise<IssuedTokens & { userId: string }> {
    const tokenHash = hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored) throw new UnauthorizedException("Invalid refresh token");

    if (stored.revoked) {
      // Reuse of an already-rotated (or logged-out) token is a strong
      // signal the token was stolen — burn the whole family immediately.
      await this.prisma.refreshToken.updateMany({
        where: { family: stored.family, revoked: false },
        data: { revoked: true },
      });
      throw new UnauthorizedException("Refresh token reuse detected; session revoked");
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token expired");
    }

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("Account is not active");
    }

    const tokens = await this.prisma.$transaction(async (tx) => {
      const issued = await this.issueTokenPair(user, stored.family, meta, tx);
      await tx.refreshToken.update({
        where: { id: stored.id },
        data: { revoked: true, replacedBy: issued.refreshTokenId },
      });
      return issued;
    });

    return { ...tokens, userId: user.id };
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored) return;
    await this.prisma.refreshToken.updateMany({
      where: { family: stored.family, revoked: false },
      data: { revoked: true },
    });
  }

  /** Revokes every session for a user (e.g. on password change or admin action). */
  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { userId, revoked: false },
        data: { revoked: true },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
      }),
    ]);
  }

  private async issueTokenPair(
    user: {
      id: string;
      organizationId: string;
      hotelId: string | null;
      role: string;
      tokenVersion: number;
    },
    family: string,
    meta: { ip?: string; userAgent?: string },
    tx: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<IssuedTokens & { refreshTokenId: string }> {
    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        org: user.organizationId,
        hotel: user.hotelId,
        role: user.role,
        tv: user.tokenVersion,
      },
      {
        secret: this.config.getOrThrow("JWT_ACCESS_SECRET"),
        expiresIn: this.config.get("JWT_ACCESS_TTL") ?? "15m",
      },
    );

    const rawRefreshToken = randomBytes(48).toString("base64url");
    const refreshTtlMs = parseDurationToMs(this.config.get("JWT_REFRESH_TTL") ?? "7d");
    const expiresAt = new Date(Date.now() + refreshTtlMs);

    const created = await tx.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawRefreshToken),
        family,
        expiresAt,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      refreshExpiresAt: expiresAt,
      refreshTokenId: created.id,
    };
  }
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function parseDurationToMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return value * multipliers[unit];
}
