import { Body, Controller, Get, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { AuthService, Public } from './auth';

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1).max(1024) });

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const credentials = loginSchema.parse(body);
    const user = await this.auth.authenticate(credentials.email, credentials.password);
    if (!user) throw new UnauthorizedException('Invalid email or password.');
    response.cookie(
      'mission_control_session',
      this.auth.issueSession(user),
      this.auth.sessionCookie(),
    );
    return { user: { email: user.email, role: user.role } };
  }

  @Public()
  @Get('session')
  async session(@Req() request: Request) {
    const user = await this.auth.userFromRequest(request.headers.cookie);
    return user
      ? { authenticated: true, user: { email: user.email, role: user.role } }
      : { authenticated: false };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('mission_control_session', { path: '/api/v1' });
    return { authenticated: false };
  }
}
