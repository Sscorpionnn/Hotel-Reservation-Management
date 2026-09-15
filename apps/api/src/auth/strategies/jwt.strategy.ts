import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";

export interface JwtAccessPayload {
  sub: string;
  org: string;
  hotel: string | null;
  role: string;
  tv: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_ACCESS_SECRET"),
    });
  }

  async validate(payload: JwtAccessPayload) {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("Account is not active");
    }
    // Any refresh-token revocation (logout-everywhere, password reset)
    // bumps tokenVersion, immediately invalidating already-issued access
    // tokens on their very next request.
    if (user.tokenVersion !== payload.tv) {
      throw new UnauthorizedException("Token has been revoked");
    }

    return {
      userId: user.id,
      organizationId: user.organizationId,
      hotelId: user.hotelId,
      role: user.role,
    };
  }
}
