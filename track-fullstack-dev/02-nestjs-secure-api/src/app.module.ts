import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { CampaignsModule, Persistence } from './campaigns/campaigns.module';
import configuration, { AppConfig } from './config/configuration';
import { HealthController } from './health/health.controller';

@Module({})
export class AppModule {
  /** `memory` swaps MongoDB for an in-memory repository (offline tests only). */
  static register(mode: Persistence = 'mongo'): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
        ...(mode === 'mongo'
          ? [
              MongooseModule.forRootAsync({
                inject: [ConfigService],
                useFactory: (cfg: ConfigService<AppConfig, true>) => ({ uri: cfg.get('mongoUri') }),
              }),
            ]
          : []),
        ThrottlerModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (cfg: ConfigService<AppConfig, true>) => {
            const { ttlMs, max } = cfg.get('rateLimit', { infer: true });
            return [{ ttl: ttlMs, limit: max }];
          },
        }),
        AuthModule,
        CampaignsModule.register(mode),
      ],
      controllers: [HealthController],
      providers: [
        // Order matters: rate limit -> authenticate -> authorize.
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    };
  }
}
