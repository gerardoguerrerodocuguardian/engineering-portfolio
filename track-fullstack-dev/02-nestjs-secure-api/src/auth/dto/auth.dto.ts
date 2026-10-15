import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class TokenRequestDto {
  @ApiProperty({ example: 'advertiser@adflow.test' })
  @IsString()
  @MaxLength(200)
  username!: string;

  @ApiProperty({ example: 'change-me-adv' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}

export class RefreshRequestDto {
  @ApiProperty()
  @IsString()
  @MinLength(10)
  refreshToken!: string;
}

export class TokenResponseDto {
  @ApiProperty() access_token!: string;
  @ApiProperty() refresh_token!: string;
  @ApiProperty({ example: 'Bearer' }) token_type!: string;
  @ApiProperty({ example: 900 }) expires_in!: number;
}
