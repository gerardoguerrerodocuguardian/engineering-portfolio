import { DynamicModule, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CampaignRepository } from './campaign.repository';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { InMemoryCampaignRepository } from './memory-campaign.repository';
import { MongoCampaignRepository } from './mongo-campaign.repository';
import { Campaign, CampaignSchema } from './schemas/campaign.schema';
import { AdEvent, AdEventSchema } from './schemas/event.schema';

export type Persistence = 'mongo' | 'memory';

@Module({})
export class CampaignsModule {
  static register(mode: Persistence): DynamicModule {
    const mongo = mode === 'mongo';
    return {
      module: CampaignsModule,
      imports: mongo
        ? [
            MongooseModule.forFeature([
              { name: Campaign.name, schema: CampaignSchema },
              { name: AdEvent.name, schema: AdEventSchema },
            ]),
          ]
        : [],
      controllers: [CampaignsController],
      providers: [
        CampaignsService,
        {
          provide: CampaignRepository,
          useClass: mongo ? MongoCampaignRepository : InMemoryCampaignRepository,
        },
      ],
      exports: [CampaignRepository],
    };
  }
}
