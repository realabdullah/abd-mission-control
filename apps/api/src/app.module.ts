import { Module, OnModuleInit } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { HealthController } from './health.controller';
import { StarlinkController } from './starlink.controller';
import { EventHub, eventHub } from './events';
import { MonitoringController } from './monitoring.controller';
import { AuthController } from './auth.controller';
import { AuthService, SessionGuard } from './auth';

@Module({
  controllers: [HealthController, StarlinkController, MonitoringController, AuthController],
  providers: [
    { provide: EventHub, useValue: eventHub },
    AuthService,
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly auth: AuthService) {}

  async onModuleInit(): Promise<void> {
    await this.auth.provisionOwner();
  }
}
