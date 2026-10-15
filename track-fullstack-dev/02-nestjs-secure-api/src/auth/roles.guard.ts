import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../config/configuration';
import { AuthenticatedRequest } from './auth.types';
import { ROLES_KEY, SCOPES_KEY } from './roles.decorator';

/** Enforces @Roles (any-of) and @Scopes (all-of) after JwtAuthGuard populated req.user. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, targets);
    const scopes = this.reflector.getAllAndOverride<string[]>(SCOPES_KEY, targets);
    if (!roles?.length && !scopes?.length) return true;

    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user) throw new ForbiddenException('No authenticated user');
    if (roles?.length && !roles.some((r) => user.roles.includes(r))) {
      throw new ForbiddenException(`Requires role: ${roles.join(' or ')}`);
    }
    if (scopes?.length && !scopes.every((s) => user.scopes.includes(s))) {
      throw new ForbiddenException(`Missing scope: ${scopes.join(' ')}`);
    }
    return true;
  }
}
