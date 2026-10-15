import { Body, Controller, Get, HttpCode, NotFoundException, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AppConfig } from '../config/configuration';
import { RefreshRequestDto, TokenRequestDto, TokenResponseDto } from './dto/auth.dto';
import { Public } from './roles.decorator';
import { TokenService } from './token.service';

/** Local dev token issuer. Disabled with AUTH_DEV_ISSUER=false (use a real IdP). */
@ApiTags('auth (dev issuer)')
@Public()
@Controller()
export class AuthController {
  constructor(
    private readonly tokens: TokenService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private ensureEnabled(): void {
    if (!this.config.get('auth', { infer: true }).devIssuerEnabled) throw new NotFoundException();
  }

  @Post('auth/token')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Password grant for synthetic dev users' })
  token(@Body() dto: TokenRequestDto): TokenResponseDto {
    this.ensureEnabled();
    const user = this.tokens.authenticate(dto.username, dto.password);
    return this.tokens.issuePair(user.username, user.role);
  }

  @Post('auth/refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Exchange a refresh token for a new access/refresh pair (rotation)' })
  refresh(@Body() dto: RefreshRequestDto): TokenResponseDto {
    this.ensureEnabled();
    return this.tokens.refresh(dto.refreshToken);
  }

  @Get('.well-known/jwks.json')
  @ApiOperation({ summary: 'Public signing keys (JWKS) of the dev issuer' })
  jwks() {
    this.ensureEnabled();
    return this.tokens.jwks;
  }
}
