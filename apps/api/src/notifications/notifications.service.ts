import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export const NOTIFICATIONS_QUEUE = "notifications";

export interface EnqueueNotificationInput {
  organizationId: string;
  recipientType: "GUEST" | "USER";
  recipientId: string;
  channel: "EMAIL" | "SMS" | "WEBSOCKET";
  template: string;
  payload: Prisma.InputJsonValue;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
  ) {}

  async enqueue(input: EnqueueNotificationInput): Promise<void> {
    const notification = await this.prisma.notification.create({
      data: {
        organizationId: input.organizationId,
        recipientType: input.recipientType,
        recipientId: input.recipientId,
        channel: input.channel,
        template: input.template,
        payload: input.payload,
      },
    });
    await this.queue.add("dispatch", { notificationId: notification.id });
  }

  /** Invoked by the queue worker; swap this body out for a real provider integration. */
  async dispatch(notificationId: string): Promise<void> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification || notification.status !== "QUEUED") return;

    try {
      this.logger.log(
        `[mock-send] ${notification.channel} "${notification.template}" -> ${notification.recipientType}:${notification.recipientId}`,
      );
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { status: "SENT", sentAt: new Date() },
      });
    } catch (error) {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { status: "FAILED", error: (error as Error).message },
      });
    }
  }
}
