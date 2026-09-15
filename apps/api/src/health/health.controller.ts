import { Controller, Get, VERSION_NEUTRAL } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Public } from "../common/decorators/public.decorator";

@Controller({ path: "health", version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: "ok", timestamp: new Date().toISOString() };
  }
}
