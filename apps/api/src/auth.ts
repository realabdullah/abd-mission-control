import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { loadConfig } from '@abd-mission-control/config';
import { AuthRepository } from '@abd-mission-control/database';
import { apiDatabase } from './api-database';

const SESSION_TTL_SECONDS = 8 * 60 * 60;
const PUBLIC_ROUTE = 'mission-control:public-route';
const INTERNAL_ROUTE = 'mission-control:internal-route';
const config = loadConfig(process.env);

export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
export const Internal = () => SetMetadata(INTERNAL_ROUTE, true);
export type SessionUser = { id: string; email: string; role: string };

function requiredAuthConfig(): { email: string; password: string; secret: string } {
  if (!config.authOwnerEmail || !config.authOwnerPassword || !config.authSessionSecret) {
    throw new Error(
      'Authentication is not configured. Set AUTH_OWNER_EMAIL, AUTH_OWNER_PASSWORD, and AUTH_SESSION_SECRET.',
    );
  }
  return {
    email: config.authOwnerEmail,
    password: config.authOwnerPassword,
    secret: config.authSessionSecret,
  };
}

function encode(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function decode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function hashPassword(password: string, salt = randomBytes(16).toString('base64url')): string {
  const derived = scryptSync(password, salt, 64).toString('base64url');
  return `${salt}:${derived}`;
}

function passwordsMatch(password: string, hash: string): boolean {
  const [salt, expected] = hash.split(':');
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64).toString('base64url');
  return (
    actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  );
}

function readCookie(header?: string): string | undefined {
  return header
    ?.split(';')
    .map((part) => part.trim().split('='))
    .find(([name]) => name === 'mission_control_session')
    ?.slice(1)
    .join('=');
}

@Injectable()
export class AuthService {
  private readonly users = new AuthRepository(apiDatabase.db);

  async provisionOwner(): Promise<void> {
    const { email, password } = requiredAuthConfig();
    const existing = await this.users.findByEmail(email);
    if (!existing) await this.users.createOwner(email, hashPassword(password));
  }

  async authenticate(email: string, password: string): Promise<SessionUser | null> {
    const user = await this.users.findByEmail(email);
    if (!user || !passwordsMatch(password, user.passwordHash)) return null;
    return { id: user.id, email: user.email, role: user.role };
  }

  issueSession(user: SessionUser): string {
    const { secret } = requiredAuthConfig();
    const payload = encode(
      JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }),
    );
    const signature = createHmac('sha256', secret).update(payload).digest('base64url');
    return `${payload}.${signature}`;
  }

  async userFromRequest(cookieHeader?: string): Promise<SessionUser | null> {
    const token = readCookie(cookieHeader);
    if (!token) return null;
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;
    const { secret } = requiredAuthConfig();
    const expected = createHmac('sha256', secret).update(payload).digest('base64url');
    if (
      signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    )
      return null;
    try {
      const value = JSON.parse(decode(payload)) as { sub?: string; exp?: number };
      if (!value.sub || !value.exp || value.exp <= Math.floor(Date.now() / 1000)) return null;
      return await this.users.findById(value.sub);
    } catch {
      return null;
    }
  }

  sessionCookie() {
    return {
      httpOnly: true,
      // The web app and API use different production origins, so browsers only
      // include this session cookie on API fetches when it is explicitly
      // permitted for cross-site requests.
      sameSite: 'none' as const,
      secure: config.nodeEnv === 'production',
      maxAge: SESSION_TTL_SECONDS * 1000,
      path: '/api/v1',
    };
  }

  isValidCollectorToken(token: string | undefined): boolean {
    const expected = config.collectorApiToken;
    return (
      Boolean(expected) &&
      Boolean(token) &&
      token!.length === expected!.length &&
      timingSafeEqual(Buffer.from(token!), Buffer.from(expected!))
    );
  }
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | string[] | undefined>; user?: SessionUser }>();
    if (
      this.reflector.getAllAndOverride<boolean>(INTERNAL_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      const token = request.headers['x-collector-token'];
      if (typeof token !== 'string' || !this.auth.isValidCollectorToken(token))
        throw new ForbiddenException('A valid collector token is required.');
      return true;
    }
    const cookie = request.headers.cookie;
    const user = await this.auth.userFromRequest(typeof cookie === 'string' ? cookie : undefined);
    if (!user) throw new UnauthorizedException('Sign in is required to access Mission Control.');
    request.user = user;
    return true;
  }
}
