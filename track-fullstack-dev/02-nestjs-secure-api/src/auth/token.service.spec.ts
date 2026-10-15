import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import configuration from '../config/configuration';
import { TokenService } from './token.service';

function build(overrides: Record<string, string> = {}): TokenService {
  Object.assign(process.env, overrides);
  const svc = new TokenService(new ConfigService(configuration()) as never);
  svc.onModuleInit();
  return svc;
}

describe('TokenService', () => {
  const svc = build();

  it('issues tokens that verify with roles and scopes', () => {
    const pair = svc.issuePair('u1', 'ADVERTISER');
    const user = svc.verifyAccess(pair.access_token);
    expect(user).toEqual({
      sub: 'u1',
      roles: ['ADVERTISER'],
      scopes: ['campaigns:read', 'campaigns:write'],
    });
  });

  it('rejects a refresh token used as access token', () => {
    const pair = svc.issuePair('u1', 'ADMIN');
    expect(() => svc.verifyAccess(pair.refresh_token)).toThrow(UnauthorizedException);
  });

  it('rejects tokens signed by another key', () => {
    const other = build();
    const pair = other.issuePair('u1', 'ADMIN');
    expect(() => svc.verifyAccess(pair.access_token)).toThrow(UnauthorizedException);
  });

  it('rejects an unsigned (alg=none) token', () => {
    const forged = jwt.sign({ sub: 'x', roles: ['ADMIN'], token_use: 'access' }, '', {
      algorithm: 'none',
    });
    expect(() => svc.verifyAccess(forged)).toThrow(UnauthorizedException);
  });

  it('rejects expired tokens', () => {
    const expired = build({ ACCESS_TOKEN_TTL_SECONDS: '-10' });
    const pair = expired.issuePair('u1', 'ADMIN');
    expect(() => expired.verifyAccess(pair.access_token)).toThrow(UnauthorizedException);
    process.env.ACCESS_TOKEN_TTL_SECONDS = '900';
  });

  it('rotates refresh tokens and detects reuse', () => {
    const pair = svc.issuePair('u1', 'ADMIN');
    const next = svc.refresh(pair.refresh_token);
    expect(svc.verifyAccess(next.access_token).sub).toBe('u1');
    expect(() => svc.refresh(pair.refresh_token)).toThrow(UnauthorizedException);
  });

  it('rejects bad credentials', () => {
    expect(() => svc.authenticate('admin@adflow.test', 'nope')).toThrow(UnauthorizedException);
    expect(svc.authenticate('admin@adflow.test', 'change-me-admin').role).toBe('ADMIN');
  });
});
