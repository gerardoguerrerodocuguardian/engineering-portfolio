import { Injectable, NotFoundException } from '@nestjs/common';
import { CampaignEntity, CampaignRepository } from './campaign.repository';
import {
  CampaignPageDto,
  CampaignReportDto,
  CampaignResponseDto,
  CreateCampaignDto,
  ListCampaignsQueryDto,
  UpdateCampaignDto,
} from './dto/campaign.dto';

export function toResponse(doc: CampaignEntity): CampaignResponseDto {
  return {
    id: doc.id,
    name: doc.name,
    status: doc.status,
    dailyBudgetCents: doc.dailyBudgetCents,
    maxBidCents: doc.maxBidCents,
    keywords: doc.keywords,
    createdAt: doc.createdAt.toISOString(),
  };
}

@Injectable()
export class CampaignsService {
  constructor(private readonly repo: CampaignRepository) {}

  async create(dto: CreateCampaignDto, ownerId: string): Promise<CampaignResponseDto> {
    const doc = await this.repo.create({ ...dto, keywords: dto.keywords ?? [], ownerId });
    return toResponse(doc);
  }

  async list(query: ListCampaignsQueryDto): Promise<CampaignPageDto> {
    const { items, total } = await this.repo.findPage(query.page, query.pageSize, query.status);
    return { items: items.map(toResponse), page: query.page, pageSize: query.pageSize, total };
  }

  async get(id: string): Promise<CampaignResponseDto> {
    const doc = await this.repo.findById(id);
    if (!doc) throw new NotFoundException(`Campaign ${id} not found`);
    return toResponse(doc);
  }

  async update(id: string, dto: UpdateCampaignDto): Promise<CampaignResponseDto> {
    const doc = await this.repo.update(id, dto);
    if (!doc) throw new NotFoundException(`Campaign ${id} not found`);
    return toResponse(doc);
  }

  async remove(id: string): Promise<void> {
    if (!(await this.repo.delete(id))) throw new NotFoundException(`Campaign ${id} not found`);
  }

  async report(id: string): Promise<CampaignReportDto> {
    if (!(await this.repo.findById(id))) throw new NotFoundException(`Campaign ${id} not found`);
    const raw = await this.repo.aggregateReport(id);
    const ctr = raw.impressions === 0 ? 0 : Number((raw.clicks / raw.impressions).toFixed(4));
    return { campaignId: id, ...raw, ctr };
  }
}
