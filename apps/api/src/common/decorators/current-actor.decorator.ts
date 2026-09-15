import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { RequestActor } from "../tenant/tenant-context";

export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestActor => {
    const request = ctx.switchToHttp().getRequest();
    return request.actor;
  },
);
