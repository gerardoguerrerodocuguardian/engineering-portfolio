import { Request } from 'express';
import { Role } from '../config/configuration';

export interface AuthUser {
  sub: string;
  roles: Role[];
  scopes: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}
