import { IsUUID } from "class-validator";

export class CreatePaymentIntentDto {
  @IsUUID()
  reservationId!: string;

  @IsUUID(4)
  idempotencyKey!: string;
}
