/* Seeds synthetic campaigns + events. Usage: npm run seed (MONGODB_URI optional). */
import mongoose from 'mongoose';
import { CampaignSchema } from '../src/campaigns/schemas/campaign.schema';
import { AdEventSchema } from '../src/campaigns/schemas/event.schema';

const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/adflow';
const NAMES = ['Autumn Sale', 'Back To School', 'Launch Week', 'Holiday Push', 'Spring Clearance'];
const STATUSES = ['ACTIVE', 'ACTIVE', 'PAUSED', 'DRAFT', 'EXHAUSTED'] as const;

async function main(): Promise<void> {
  await mongoose.connect(uri);
  const Campaign = mongoose.model('Campaign', CampaignSchema);
  const AdEvent = mongoose.model('AdEvent', AdEventSchema);
  await Promise.all([Campaign.deleteMany({}), AdEvent.deleteMany({})]);
  await Promise.all([Campaign.syncIndexes(), AdEvent.syncIndexes()]);

  for (let i = 0; i < 25; i++) {
    const c = await Campaign.create({
      name: `${NAMES[i % NAMES.length]} #${i + 1}`,
      status: STATUSES[i % STATUSES.length],
      dailyBudgetCents: 10000 * (1 + (i % 5)),
      maxBidCents: 50 + (i % 7) * 10,
      keywords: ['demo', `segment-${i % 4}`],
      ownerId: 'advertiser@adflow.test',
    });
    const impressions = 200 + i * 20;
    const events = Array.from({ length: impressions }, (_, n) => {
      const click = n % (8 + (i % 5)) === 0;
      return {
        campaignId: c._id,
        type: click ? 'CLICK' : 'IMPRESSION',
        costCents: click ? 20 + (i % 7) * 5 : 0,
        occurredAt: new Date(Date.now() - n * 60_000),
      };
    });
    await AdEvent.insertMany(events);
  }
  console.log('Seeded 25 campaigns with events');
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
