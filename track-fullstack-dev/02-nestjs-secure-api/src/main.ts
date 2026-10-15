import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule.register('mongo'));
  configureApp(app);
  const port = app.get(ConfigService<AppConfig, true>).get('port', { infer: true });
  await app.listen(port);
}
void bootstrap();
