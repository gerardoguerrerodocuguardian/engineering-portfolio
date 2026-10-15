import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  KeyObject,
  randomUUID,
} from 'crypto';
import * as jwt from 'jsonwebtoken';
import { AppConfig, DevUser, Role } from '../config/configuration';
import { AuthUser } from './auth.types';

export const SCOPES_BY_ROLE: Record<Role, string[]> = {
  ADVERTISER: ['campaigns:read', 'campaigns:write'],
  ADMIN: ['campaigns:read', 'campaigns:write', 'campaigns:delete'],
};

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

/**
 * Local development token issuer + verifier (RS256).
 * Verification uses only public key material, exactly like validating tokens
 * from a remote IdP via JWKS; swap `publicKey` for a JWKS-backed resolver in production.
 */
@Injectable()
export class TokenService implements OnModuleInit {
  private privateKey!: KeyObject;
  private publicKey!: KeyObject;
  private readonly kid = 'adflow-dev-1';
  /** Refresh-token ids already redeemed (rotation + reuse detection). In-memory: dev only. */
  private readonly usedRefreshIds = new Set<string>();

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  onModuleInit(): void {
    const pem = this.config.get('auth', { infer: true }).devPrivateKey;
    if (pem) {
      this.privateKey = createPrivateKey(pem.replace(/\\n/g, '\n'));
      this.publicKey = createPublicKey(this.privateKey);
    } else {
      const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
      this.privateKey = pair.privateKey;
      this.publicKey = pair.publicKey;
    }
  }

  get jwks(): { keys: Record<string, unknown>[] } {
    const jwk = this.publicKey.export({ format: 'jwk' });
    return { keys: [{ ...jwk, kid: this.kid, use: 'sig', alg: 'RS256' }] };
  }

  authenticate(username: string, password: string): DevUser {
    const user = this.config
      .get('auth', { infer: true })
      .devUsers.find((u) => u.username === username && u.password === password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  issuePair(sub: string, role: Role): TokenPair {
    const auth = this.config.get('auth', { infer: true });
    const base = { issuer: auth.issuer, audience: auth.audience, subject: sub, keyid: this.kid };
    const access = jwt.sign(
      { roles: [role], scope: SCOPES_BY_ROLE[role].join(' '), token_use: 'access' },
      this.privateKey,
      { ...base, algorithm: 'RS256', expiresIn: auth.accessTtlSeconds, jwtid: randomUUID() },
    );
    const refresh = jwt.sign({ role, token_use: 'refresh' }, this.privateKey, {
      ...base,
      algorithm: 'RS256',
      expiresIn: auth.refreshTtlSeconds,
      jwtid: randomUUID(),
    });
    return {
      access_token: access,
      refresh_token: refresh,
      token_type: 'Bearer',
      expires_in: auth.accessTtlSeconds,
    };
  }

  /** Validates signature, issuer, audience, exp and token_use. Throws 401 otherwise. */
  private verify(token: string, use: 'access' | 'refresh'): jwt.JwtPayload {
    const auth = this.config.get('auth', { infer: true });
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, this.publicKey, {
        algorithms: ['RS256'], // never accept "none" or HS256 confusion
        issuer: auth.issuer,
        audience: auth.audience,
      }) as jwt.JwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (payload.token_use !== use || !payload.sub) {
      throw new UnauthorizedException('Wrong token type');
    }
    return payload;
  }

  verifyAccess(token: string): AuthUser {
    const p = this.verify(token, 'access');
    const roles = ((p['roles'] ?? p['cognito:groups'] ?? []) as string[]).filter(
      (r): r is Role => r === 'ADMIN' || r === 'ADVERTISER',
    );
    const scopes = typeof p['scope'] === 'string' ? p['scope'].split(' ').filter(Boolean) : [];
    return { sub: p.sub as string, roles, scopes };
  }

  /** Rotates a refresh token: each one is single use; replay is rejected. */
  refresh(token: string): TokenPair {
    const p = this.verify(token, 'refresh');
    if (!p.jti || this.usedRefreshIds.has(p.jti)) {
      throw new UnauthorizedException('Refresh token already used');
    }
    this.usedRefreshIds.add(p.jti);
    return this.issuePair(p.sub as string, p['role'] as Role);
  }
}
