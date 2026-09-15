import { INestApplication, ValidationPipe, VersioningType } from "@nestjs/common";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { AuditInterceptor } from "./common/interceptors/audit.interceptor";

/**
 * Shared app configuration used by both the real server entrypoint
 * (main.ts) and the e2e test harness (test/utils/test-app.ts), so the two
 * never drift apart — a security header or guard added here is exercised
 * by both.
 */
export function configureApp(app: INestApplication): void {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: "same-site" },
    }),
  );
  app.use(cookieParser(process.env.COOKIE_SECRET));

  const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3000";
  app.enableCors({
    origin: corsOrigin.split(",").map((o) => o.trim()),
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
  });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(app.get(AuditInterceptor));

  app.setGlobalPrefix("api", { exclude: ["health"] });
}
