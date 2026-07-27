import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { StarlinkController } from './starlink.controller';
import { EventHub } from './events';
import { MonitoringController } from './monitoring.controller';

@Module({
  controllers: [HealthController, StarlinkController, MonitoringController],
  providers: [EventHub],
})
export class AppModule {}
