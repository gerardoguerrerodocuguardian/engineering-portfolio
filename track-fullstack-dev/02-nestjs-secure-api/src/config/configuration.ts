export type Role = 'ADMIN' | 'ADVERTISER';

export interface DevUser {
  username: string;
  password: string;
  role: Role;
}

export interface AppConfig {
  port: number;
  mongoUri: string;
  auth: {
    devIssuerEnabled: boolean;
    issuer: string;
    audience: string;
    accessTtlSeconds: number;
    refreshTtlSeconds: number;
    devPrivateKey?: string;
    devUsers: DevUser[];
  };
  rateLimit: { ttlMs: number; max: number };
}

const DEFAULT_USERS =
  'admin@adflow.test:change-me-admin:ADMIN,advertiser@adflow.test:change-me-adv:ADVERTISER';

function parseUsers(raw: string): DevUser[] {
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [username, password, role] = entry.split(':');
      if (!username || !password || (role !== 'ADMIN' && role !== 'ADVERTISER')) {
        throw new Error('DEV_USERS must look like user:password:ROLE (ROLE = ADMIN|ADVERTISER)');
      }
      return { username, password, role };
    });
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/adflow',
  auth: {
    devIssuerEnabled: (process.env.AUTH_DEV_ISSUER ?? 'true') === 'true',
    issuer: process.env.JWT_ISSUER ?? 'https://auth.adflow.local',
    audience: process.env.JWT_AUDIENCE ?? 'adflow-campaign-api',
    accessTtlSeconds: parseInt(process.env.ACCESS_TOKEN_TTL_SECONDS ?? '900', 10),
    refreshTtlSeconds: parseInt(process.env.REFRESH_TOKEN_TTL_SECONDS ?? '604800', 10),
    devPrivateKey: process.env.DEV_JWT_PRIVATE_KEY || undefined,
    devUsers: parseUsers(process.env.DEV_USERS ?? DEFAULT_USERS),
  },
  rateLimit: {
    ttlMs: parseInt(process.env.RATE_LIMIT_TTL_MS ?? '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
  },
});
