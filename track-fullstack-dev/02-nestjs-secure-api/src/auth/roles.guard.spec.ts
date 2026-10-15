import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { AuthUser } from './auth.types';

function ctx(
  user: AuthUser | undefined,
  roles?: string[],
  scopes?: string[],
): [RolesGuard, ExecutionContext] {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => (key === 'roles' ? roles : scopes)),
  } as unknown as Reflector;
  const context = {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return [new RolesGuard(reflector), context];
}

describe('RolesGuard', () => {
  const advertiser: AuthUser = {
    sub: 'a',
    roles: ['ADVERTISER'],
    scopes: ['campaigns:read', 'campaigns:write'],
  };

  it('allows routes with no metadata', () => {
    const [g, c] = ctx(advertiser);
    expect(g.canActivate(c)).toBe(true);
  });

  it('allows a matching role', () => {
    const [g, c] = ctx(advertiser, ['ADVERTISER', 'ADMIN']);
    expect(g.canActivate(c)).toBe(true);
  });

  it('rejects a wrong role', () => {
    const [g, c] = ctx(advertiser, ['ADMIN']);
    expect(() => g.canActivate(c)).toThrow(ForbiddenException);
  });

  it('rejects a missing scope', () => {
    const [g, c] = ctx(advertiser, undefined, ['campaigns:delete']);
    expect(() => g.canActivate(c)).toThrow(ForbiddenException);
  });

  it('rejects when no user is attached', () => {
    const [g, c] = ctx(undefined, ['ADMIN']);
    expect(() => g.canActivate(c)).toThrow(ForbiddenException);
  });
});
