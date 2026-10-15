import { SetMetadata } from '@nestjs/common';
import { Role } from '../config/configuration';

export const ROLES_KEY = 'roles';
export const SCOPES_KEY = 'scopes';
export const IS_PUBLIC_KEY = 'isPublic';

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
export const Scopes = (...scopes: string[]) => SetMetadata(SCOPES_KEY, scopes);
/** Opt a route out of the global JWT guard (health, dev token issuer). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
