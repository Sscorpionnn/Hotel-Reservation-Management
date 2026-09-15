import { ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { ClsService } from "nestjs-cls";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import type { RequestActor } from "../tenant/tenant-context";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(
    private readonly reflector: Reflector,
    private readonly cls: ClsService,
  ) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    return super.canActivate(context);
  }

  handleRequest<TUser = RequestActor>(
    err: unknown,
    user: RequestActor | false,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      throw err instanceof Error ? err : new UnauthorizedException();
    }
    const request = context.switchToHttp().getRequest();
    request.actor = user;
    this.cls.set("actor", user);
    return user as TUser;
  }
}
