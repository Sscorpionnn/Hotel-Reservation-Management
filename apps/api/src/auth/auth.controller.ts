import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { AuthService, IssuedTokens } from "./auth.service";
import { RegisterOrganizationDto } from "./dto/register-organization.dto";
import { LoginDto } from "./dto/login.dto";
import { Public } from "../common/decorators/public.decorator";
import { CsrfGuard } from "../common/guards/csrf.guard";
import { CurrentActor } from "../common/decorators/current-actor.decorator";
import type { RequestActor } from "../common/tenant/tenant-context";
import { PrismaService } from "../prisma/prisma.service";

const REFRESH_COOKIE = "refresh_token";
const CSRF_COOKIE = "csrf_token";

@Controller({ path: "auth", version: "1" })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("register-organization")
  async register(@Body() dto: RegisterOrganizationDto) {
    return this.authService.registerOrganization(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.login(dto, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
    this.setSessionCookies(res, tokens);
    return { accessToken: tokens.accessToken, userId: tokens.userId };
  }

  @Public()
  @UseGuards(CsrfGuard)
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (!raw) throw new UnauthorizedException("Missing refresh token");

    const tokens = await this.authService.refresh(raw, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
    this.setSessionCookies(res, tokens);
    return { accessToken: tokens.accessToken, userId: tokens.userId };
  }

  @Get("me")
  async me(@CurrentActor() actor: RequestActor) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.userId } });
    return {
      userId: user.id,
      organizationId: user.organizationId,
      hotelId: user.hotelId,
      role: user.role,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }

  @Public()
  @UseGuards(CsrfGuard)
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (raw) await this.authService.logout(raw);
    res.clearCookie(REFRESH_COOKIE);
    res.clearCookie(CSRF_COOKIE);
  }

  private setSessionCookies(res: Response, tokens: IssuedTokens) {
    const isProd = this.config.get("NODE_ENV") === "production";
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "strict",
      expires: tokens.refreshExpiresAt,
      path: "/api/v1/auth",
    });
    // Readable by JS on purpose (double-submit pattern) — it carries no
    // authority on its own, it just has to match the header on write requests.
    res.cookie(CSRF_COOKIE, randomBytes(24).toString("hex"), {
      httpOnly: false,
      secure: isProd,
      sameSite: "strict",
      expires: tokens.refreshExpiresAt,
      path: "/",
    });
  }
}
