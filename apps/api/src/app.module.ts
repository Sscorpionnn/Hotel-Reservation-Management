import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { BullModule } from "@nestjs/bullmq";
import { ClsModule } from "nestjs-cls";
import { PrismaModule } from "./prisma/prisma.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { HotelsModule } from "./hotels/hotels.module";
import { RoomTypesModule } from "./room-types/room-types.module";
import { RoomsModule } from "./rooms/rooms.module";
import { AmenitiesModule } from "./amenities/amenities.module";
import { RatesModule } from "./rates/rates.module";
import { AvailabilityModule } from "./availability/availability.module";
import { ReservationsModule } from "./reservations/reservations.module";
import { GuestsModule } from "./guests/guests.module";
import { PaymentsModule } from "./payments/payments.module";
import { PromotionsModule } from "./promotions/promotions.module";
import { HousekeepingModule } from "./housekeeping/housekeeping.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { ReportsModule } from "./reports/reports.module";
import { HealthModule } from "./health/health.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { AppThrottlerGuard } from "./common/guards/app-throttler.guard";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: Number(config.get("THROTTLE_TTL") ?? 60) * 1000,
          limit: Number(config.get("THROTTLE_LIMIT") ?? 100),
          // The e2e suite reuses one app (and one tracked IP/user) across
          // many test cases per file, which would otherwise trip
          // route-level limits that are intentionally tight for
          // production (e.g. 5 new organizations/min). Individual specs
          // that exist specifically to prove throttling works flip this
          // back on for just that file — see test/setup-env.ts.
          skipIf: () => process.env.DISABLE_RATE_LIMITING === "true",
        },
      ],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.getOrThrow<string>("REDIS_URL") },
      }),
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    HotelsModule,
    RoomTypesModule,
    RoomsModule,
    AmenitiesModule,
    RatesModule,
    AvailabilityModule,
    ReservationsModule,
    GuestsModule,
    PaymentsModule,
    PromotionsModule,
    HousekeepingModule,
    NotificationsModule,
    ReportsModule,
    HealthModule,
  ],
  providers: [
    // Order matters: guards run in registration order. JwtAuthGuard runs
    // first so AppThrottlerGuard can track authenticated requests by user
    // id instead of IP (see its docstring) — @Public() routes like
    // /auth/login skip JwtAuthGuard entirely and the throttler falls back
    // to IP for those, which is exactly the brute-force protection we
    // want there.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
