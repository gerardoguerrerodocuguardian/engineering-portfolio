import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthenticatedRequest } from '../auth/auth.types';
import { Roles, Scopes } from '../auth/roles.decorator';
import { CampaignsService } from './campaigns.service';
import {
  CampaignPageDto,
  CampaignReportDto,
  CampaignResponseDto,
  CreateCampaignDto,
  ListCampaignsQueryDto,
  UpdateCampaignDto,
} from './dto/campaign.dto';

@ApiTags('campaigns')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token (problem+json)' })
@Controller('v1/campaigns')
export class CampaignsController {
  constructor(private readonly service: CampaignsService) {}

  @Get()
  @Scopes('campaigns:read')
  @ApiOperation({ summary: 'List campaigns (paginated)' })
  @ApiOkResponse({ type: CampaignPageDto })
  list(@Query() query: ListCampaignsQueryDto): Promise<CampaignPageDto> {
    return this.service.list(query);
  }

  @Post()
  @Roles('ADVERTISER', 'ADMIN')
  @Scopes('campaigns:write')
  @ApiOperation({ summary: 'Create a campaign (role ADVERTISER or ADMIN)' })
  @ApiCreatedResponse({ type: CampaignResponseDto })
  @ApiBadRequestResponse({ description: 'Validation error (problem+json)' })
  @ApiForbiddenResponse({ description: 'Role not allowed (problem+json)' })
  create(
    @Body() dto: CreateCampaignDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<CampaignResponseDto> {
    return this.service.create(dto, req.user!.sub);
  }

  @Get(':id')
  @Scopes('campaigns:read')
  @ApiOperation({ summary: 'Get one campaign' })
  @ApiOkResponse({ type: CampaignResponseDto })
  @ApiNotFoundResponse({ description: 'Not found (problem+json)' })
  get(@Param('id') id: string): Promise<CampaignResponseDto> {
    return this.service.get(id);
  }

  @Patch(':id')
  @Roles('ADVERTISER', 'ADMIN')
  @Scopes('campaigns:write')
  @ApiOperation({ summary: 'Update a campaign' })
  @ApiOkResponse({ type: CampaignResponseDto })
  @ApiBadRequestResponse({ description: 'Validation error (problem+json)' })
  @ApiNotFoundResponse({ description: 'Not found (problem+json)' })
  update(@Param('id') id: string, @Body() dto: UpdateCampaignDto): Promise<CampaignResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('ADMIN')
  @Scopes('campaigns:delete')
  @ApiOperation({ summary: 'Delete a campaign (role ADMIN)' })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiForbiddenResponse({ description: 'Role not allowed (problem+json)' })
  @ApiNotFoundResponse({ description: 'Not found (problem+json)' })
  remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id);
  }

  @Get(':id/report')
  @Scopes('campaigns:read')
  @ApiOperation({ summary: 'Aggregated performance report for a campaign' })
  @ApiOkResponse({ type: CampaignReportDto })
  @ApiNotFoundResponse({ description: 'Not found (problem+json)' })
  report(@Param('id') id: string): Promise<CampaignReportDto> {
    return this.service.report(id);
  }
}
