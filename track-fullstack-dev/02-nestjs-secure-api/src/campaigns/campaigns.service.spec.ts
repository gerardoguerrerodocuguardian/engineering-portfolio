import { NotFoundException } from '@nestjs/common';
import { CampaignRepository } from './campaign.repository';
import { CampaignsService } from './campaigns.service';

const doc = (over: Record<string, unknown> = {}) =>
  ({
    id: '65f0000000000000000000aa',
    name: 'Test',
    status: 'DRAFT',
    dailyBudgetCents: 100,
    maxBidCents: 5,
    keywords: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...over,
  }) as never;

describe('CampaignsService', () => {
  let repo: jest.Mocked<CampaignRepository>;
  let service: CampaignsService;

  beforeEach(() => {
    repo = {
      create: jest.fn(),
      findById: jest.fn(),
      findPage: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregateReport: jest.fn(),
    } as unknown as jest.Mocked<CampaignRepository>;
    service = new CampaignsService(repo);
  });

  it('creates with default keywords and maps to the contract shape', async () => {
    repo.create.mockResolvedValue(doc());
    const res = await service.create({ name: 'Test', dailyBudgetCents: 100, maxBidCents: 5 }, 'u1');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ keywords: [], ownerId: 'u1' }),
    );
    expect(res.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('lists with pagination metadata', async () => {
    repo.findPage.mockResolvedValue({ items: [doc()], total: 41 });
    const res = await service.list({ page: 2, pageSize: 20 });
    expect(res).toMatchObject({ page: 2, pageSize: 20, total: 41 });
    expect(res.items).toHaveLength(1);
  });

  it('throws NotFound for missing campaign on get/update/remove/report', async () => {
    repo.findById.mockResolvedValue(null);
    repo.update.mockResolvedValue(null);
    repo.delete.mockResolvedValue(false);
    await expect(service.get('x')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update('x', {})).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('x')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.report('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('computes CTR and handles zero impressions', async () => {
    repo.findById.mockResolvedValue(doc());
    repo.aggregateReport.mockResolvedValueOnce({ impressions: 200, clicks: 5, spendCents: 90 });
    expect((await service.report('id')).ctr).toBe(0.025);
    repo.aggregateReport.mockResolvedValueOnce({ impressions: 0, clicks: 0, spendCents: 0 });
    expect((await service.report('id')).ctr).toBe(0);
  });
});
