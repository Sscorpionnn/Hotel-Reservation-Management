import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { NOTIFICATIONS_QUEUE, NotificationsService } from "./notifications.service";

@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  constructor(private readonly notifications: NotificationsService) {
    super();
  }

  async process(job: Job<{ notificationId: string }>): Promise<void> {
    await this.notifications.dispatch(job.data.notificationId);
  }
}
