import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

// All synthetic demo data — no real guests, no real payment credentials.
const DEMO_PASSWORD = "Demo-Password-123!";

async function main() {
  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });

  const organization = await prisma.organization.upsert({
    where: { slug: "aurora-hospitality" },
    update: {},
    create: { name: "Aurora Hospitality Group", slug: "aurora-hospitality" },
  });

  const orgAdmin = await prisma.user.upsert({
    where: { email: "org.admin@example.com" },
    update: {},
    create: {
      organizationId: organization.id,
      email: "org.admin@example.com",
      passwordHash,
      firstName: "Ada",
      lastName: "Yilmaz",
      role: "ORG_ADMIN",
    },
  });

  const hotel = await prisma.hotel.upsert({
    where: { organizationId_slug: { organizationId: organization.id, slug: "aurora-bosphorus" } },
    update: {},
    create: {
      organizationId: organization.id,
      name: "Aurora Bosphorus Hotel",
      slug: "aurora-bosphorus",
      timezone: "Europe/Istanbul",
      currency: "USD",
      addressLine: "1 Demo Waterfront Ave",
      city: "Istanbul",
      country: "TR",
    },
  });

  const hotelManager = await prisma.user.upsert({
    where: { email: "manager@example.com" },
    update: {},
    create: {
      organizationId: organization.id,
      hotelId: hotel.id,
      email: "manager@example.com",
      passwordHash,
      firstName: "Baran",
      lastName: "Kaya",
      role: "HOTEL_MANAGER",
    },
  });

  await prisma.user.upsert({
    where: { email: "frontdesk@example.com" },
    update: {},
    create: {
      organizationId: organization.id,
      hotelId: hotel.id,
      email: "frontdesk@example.com",
      passwordHash,
      firstName: "Ceyda",
      lastName: "Demir",
      role: "FRONT_DESK_AGENT",
    },
  });

  await prisma.user.upsert({
    where: { email: "housekeeping@example.com" },
    update: {},
    create: {
      organizationId: organization.id,
      hotelId: hotel.id,
      email: "housekeeping@example.com",
      passwordHash,
      firstName: "Deniz",
      lastName: "Sahin",
      role: "HOUSEKEEPING_STAFF",
    },
  });

  const standardRoomType = await prisma.roomType.create({
    data: {
      hotelId: hotel.id,
      name: "Standard Queen",
      description: "25 sqm room with a queen bed and city view.",
      capacityAdults: 2,
      capacityChildren: 1,
      basePriceCents: 12000,
      currency: "USD",
    },
  });

  const deluxeRoomType = await prisma.roomType.create({
    data: {
      hotelId: hotel.id,
      name: "Deluxe Bosphorus View",
      description: "38 sqm room with a king bed and waterfront balcony.",
      capacityAdults: 2,
      capacityChildren: 2,
      basePriceCents: 22000,
      currency: "USD",
    },
  });

  const wifi = await prisma.amenity.create({ data: { hotelId: hotel.id, name: "Free Wi-Fi", icon: "wifi" } });
  const breakfast = await prisma.amenity.create({
    data: { hotelId: hotel.id, name: "Breakfast Included", icon: "coffee" },
  });
  const seaView = await prisma.amenity.create({ data: { hotelId: hotel.id, name: "Sea View", icon: "waves" } });

  await prisma.roomTypeAmenity.createMany({
    data: [
      { roomTypeId: standardRoomType.id, amenityId: wifi.id },
      { roomTypeId: standardRoomType.id, amenityId: breakfast.id },
      { roomTypeId: deluxeRoomType.id, amenityId: wifi.id },
      { roomTypeId: deluxeRoomType.id, amenityId: breakfast.id },
      { roomTypeId: deluxeRoomType.id, amenityId: seaView.id },
    ],
  });

  for (let i = 1; i <= 8; i++) {
    await prisma.room.create({
      data: {
        hotelId: hotel.id,
        roomTypeId: standardRoomType.id,
        roomNumber: `1${i.toString().padStart(2, "0")}`,
        floor: 1,
      },
    });
  }
  for (let i = 1; i <= 4; i++) {
    await prisma.room.create({
      data: {
        hotelId: hotel.id,
        roomTypeId: deluxeRoomType.id,
        roomNumber: `2${i.toString().padStart(2, "0")}`,
        floor: 2,
      },
    });
  }

  await prisma.promotion.create({
    data: {
      organizationId: organization.id,
      hotelId: hotel.id,
      code: "WELCOME10",
      discountType: "PERCENTAGE",
      discountValue: 10,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 90 * 86_400_000),
      maxRedemptions: 100,
    },
  });

  await prisma.guest.upsert({
    where: { organizationId_email: { organizationId: organization.id, email: "guest.demo@example.com" } },
    update: {},
    create: {
      organizationId: organization.id,
      email: "guest.demo@example.com",
      firstName: "Mert",
      lastName: "Aydin",
      phone: "+90 500 000 00 00",
      country: "TR",
    },
  });

  // eslint-disable-next-line no-console
  console.log("Seed complete.");
  // eslint-disable-next-line no-console
  console.log(`Org admin: org.admin@example.com / ${DEMO_PASSWORD}`);
  // eslint-disable-next-line no-console
  console.log(`Hotel manager: manager@example.com / ${DEMO_PASSWORD}`);
  void orgAdmin;
  void hotelManager;
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
