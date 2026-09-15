import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { HOLD_EXPIRY_QUEUE } from "./reservations.service";
import { ReservationsService } from "./reservations.service";

@Processor(HOLD_EXPIRY_QUEUE)
export class HoldExpiryProcessor extends WorkerHost {
  private readonly logger = new Logger(HoldExpiryProcessor.name);

  constructor(private readonly reservations: ReservationsService) {
    super();
  }

  async process(job: Job<{ reservationId: string }>): Promise<void> {
    try {
      await this.reservations.expireHold(job.data.reservationId);
    } catch (error) {
      this.logger.error(
        `Failed to expire hold ${job.data.reservationId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
