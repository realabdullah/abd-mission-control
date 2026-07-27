import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { loadConfig } from '@abd-mission-control/config';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const config = loadConfig(process.env);
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.enableShutdownHooks();
  app.enableCors({
    origin: config.apiCorsOrigin
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: false,
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const document = new DocumentBuilder()
    .setTitle('ABD Mission Control API')
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, document));
  await app.listen(config.apiPort, config.apiHost);
}

void bootstrap();
