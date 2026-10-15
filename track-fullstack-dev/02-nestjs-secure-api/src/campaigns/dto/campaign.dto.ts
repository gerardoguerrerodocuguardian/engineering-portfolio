import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CAMPAIGN_STATUSES, CampaignStatus } from '../schemas/campaign.schema';

export class CreateCampaignDto {
  @ApiProperty({ minLength: 3, maxLength: 120, example: 'Autumn Sale' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ type: 'integer', minimum: 0, example: 50000 })
  @IsInt()
  @Min(0)
  dailyBudgetCents!: number;

  @ApiProperty({ type: 'integer', minimum: 1, example: 120 })
  @IsInt()
  @Min(1)
  maxBidCents!: number;

  @ApiPropertyOptional({ type: [String], example: ['shoes', 'running'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  keywords?: string[];
}

export class UpdateCampaignDto extends PartialType(CreateCampaignDto) {
  @ApiPropertyOptional({ enum: CAMPAIGN_STATUSES })
  @IsOptional()
  @IsEnum(CAMPAIGN_STATUSES)
  status?: CampaignStatus;
}

export class ListCampaignsQueryDto {
  @ApiPropertyOptional({ type: 'integer', minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional({ enum: CAMPAIGN_STATUSES })
  @IsOptional()
  @IsEnum(CAMPAIGN_STATUSES)
  status?: CampaignStatus;
}

export class CampaignResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: CAMPAIGN_STATUSES }) status!: CampaignStatus;
  @ApiProperty({ type: 'integer', minimum: 0 }) dailyBudgetCents!: number;
  @ApiProperty({ type: 'integer', minimum: 1 }) maxBidCents!: number;
  @ApiPropertyOptional({ type: [String] }) keywords?: string[];
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class CampaignPageDto {
  @ApiProperty({ type: [CampaignResponseDto] }) items!: CampaignResponseDto[];
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() total!: number;
}

export class CampaignReportDto {
  @ApiProperty() campaignId!: string;
  @ApiProperty({ type: 'integer' }) impressions!: number;
  @ApiProperty({ type: 'integer' }) clicks!: number;
  @ApiProperty({ type: 'integer' }) spendCents!: number;
  @ApiProperty({ description: 'clicks / impressions' }) ctr!: number;
}
