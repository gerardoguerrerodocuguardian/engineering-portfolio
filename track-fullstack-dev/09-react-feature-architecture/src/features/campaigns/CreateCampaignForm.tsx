import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Field } from '@/components/Field';
import { useAnnounce } from '@/components/LiveRegion';
import { useI18n, type MessageKey } from '@/i18n';
import { useCreateCampaign } from './api';
import { createCampaignSchema, toCents, type CreateCampaignValues } from './schema';

export function CreateCampaignForm() {
  const { t } = useI18n();
  const announce = useAnnounce();
  const create = useCreateCampaign();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateCampaignValues>({ resolver: zodResolver(createCampaignSchema) });
  const msg = (e?: { message?: string }) => (e?.message ? t(e.message as MessageKey) : undefined);

  const onSubmit = handleSubmit((v) =>
    create.mutateAsync({ name: v.name, dailyBudgetCents: toCents(v.dailyBudget), maxBidCents: toCents(v.maxBid) }).then(
      () => {
        reset();
        announce(t('campaigns.created'));
      },
      () => announce(t('error.title')),
    ),
  );

  return (
    <form onSubmit={onSubmit} noValidate aria-label={t('campaigns.new')} className="card">
      <h2>{t('campaigns.new')}</h2>
      <Field label={t('form.name')} error={msg(errors.name)} {...register('name')} />
      <Field label={t('form.budget')} type="number" step="0.01" inputMode="decimal" error={msg(errors.dailyBudget)} {...register('dailyBudget', { valueAsNumber: true })} />
      <Field label={t('form.bid')} type="number" step="0.01" inputMode="decimal" error={msg(errors.maxBid)} {...register('maxBid', { valueAsNumber: true })} />
      <button type="submit" disabled={create.isPending}>
        {t('form.submit')}
      </button>
    </form>
  );
}
