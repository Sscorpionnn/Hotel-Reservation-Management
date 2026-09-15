import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../../src/app.module";
import { configureApp } from "../../src/bootstrap";
import { PrismaService } from "../../src/prisma/prisma.service";

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
}

export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ rawBody: true });
  configureApp(app);
  await app.init();
  const prisma = app.get(PrismaService);
  return { app, prisma };
}

const TRUNCATE_TABLES = [
  "audit_logs",
  "notifications",
  "payment_webhook_events",
  "payment_intents",
  "reservation_nights",
  "reservations",
  "promotions",
  "housekeeping_tasks",
  "rate_plans",
  "room_type_amenities",
  "amenities",
  "rooms",
  "room_types",
  "hotels",
  "refresh_tokens",
  "users",
  "guests",
  "organizations",
];

/** Wipes every app table so each e2e spec file starts from a clean slate. */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  const identifiers = TRUNCATE_TABLES.map((t) => `"${t}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${identifiers} RESTART IDENTITY CASCADE;`);
}
