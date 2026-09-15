import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { CreateStaffUserDto } from "./dto/create-staff-user.dto";
import { UpdateUserRoleDto } from "./dto/update-user-role.dto";
import type { RequestActor } from "../common/tenant/tenant-context";

const HOTEL_SCOPED_ROLES = ["HOTEL_MANAGER", "FRONT_DESK_AGENT", "HOUSEKEEPING_STAFF"];

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async create(dto: CreateStaffUserDto, actor: RequestActor) {
    await this.assertHotelBelongsToOrg(dto.hotelId, dto.role, actor.organizationId);

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new BadRequestException("Email already registered");

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: {
        // organizationId is always derived from the authenticated actor,
        // never accepted from the request body — otherwise a caller could
        // create a user in a different tenant entirely.
        organizationId: actor.organizationId,
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        hotelId: dto.hotelId,
      },
    });
    return sanitize(user);
  }

  async list(actor: RequestActor) {
    const users = await this.prisma.user.findMany({
      where: { organizationId: actor.organizationId },
      orderBy: { createdAt: "asc" },
    });
    return users.map(sanitize);
  }

  async updateRole(userId: string, dto: UpdateUserRoleDto, actor: RequestActor) {
    const target = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: actor.organizationId },
    });
    if (!target) throw new NotFoundException("User not found");

    await this.assertHotelBelongsToOrg(dto.hotelId, dto.role, actor.organizationId);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role: dto.role, hotelId: dto.hotelId ?? null, tokenVersion: { increment: 1 } },
    });
    // A role/scope change invalidates any session already issued under the
    // old privileges.
    await this.authService.revokeAllSessions(userId);
    return sanitize(updated);
  }

  async suspend(userId: string, actor: RequestActor) {
    const target = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: actor.organizationId },
    });
    if (!target) throw new NotFoundException("User not found");

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: "SUSPENDED", tokenVersion: { increment: 1 } },
    });
    await this.authService.revokeAllSessions(userId);
    return sanitize(updated);
  }

  private async assertHotelBelongsToOrg(
    hotelId: string | undefined,
    role: string,
    organizationId: string,
  ) {
    const requiresHotel = HOTEL_SCOPED_ROLES.includes(role);
    if (requiresHotel && !hotelId) {
      throw new BadRequestException(`role ${role} requires a hotelId`);
    }
    if (!requiresHotel && hotelId) {
      throw new BadRequestException(`role ${role} must not have a hotelId`);
    }
    if (hotelId) {
      const hotel = await this.prisma.hotel.findFirst({ where: { id: hotelId, organizationId } });
      if (!hotel) throw new BadRequestException("hotelId does not belong to your organization");
    }
  }
}

function sanitize(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  hotelId: string | null;
  createdAt: Date;
}) {
  const { id, email, firstName, lastName, role, status, hotelId, createdAt } = user;
  return { id, email, firstName, lastName, role, status, hotelId, createdAt };
}
