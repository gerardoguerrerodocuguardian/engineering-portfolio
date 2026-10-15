import { Controller, Get, Optional, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Connection } from 'mongoose';
import { Public } from '../auth/roles.decorator';

@ApiTags('health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(@Optional() @InjectConnection() private readonly conn?: Connection) {}

  @Get()
  @ApiOperation({ summary: 'Liveness + MongoDB readiness' })
  async check(): Promise<{ status: string; mongo: string }> {
    if (!this.conn) return { status: 'ok', mongo: 'not-configured' };
    try {
      await this.conn.db!.admin().ping();
    } catch {
      throw new ServiceUnavailableException('MongoDB unreachable');
    }
    return { status: 'ok', mongo: 'up' };
  }
}
