import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams } from 'react-router';
import { Field } from '@/components/Field';
import { useI18n, type MessageKey } from '@/i18n';
import { loginSchema, signIn, type LoginValues } from './auth';

export function LoginPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [failed, setFailed] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const redirectTo = params.get('redirect');
  const target = redirectTo?.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/campaigns';

  const onSubmit = handleSubmit(async (values) => {
    setFailed(false);
    try {
      await signIn(values);
      await navigate(target, { replace: true });
    } catch {
      setFailed(true);
    }
  });

  return (
    <section aria-labelledby="login-title" className="card narrow">
      <h1 id="login-title">{t('login.title')}</h1>
      <form onSubmit={onSubmit} noValidate>
        <Field label={t('login.email')} type="email" autoComplete="username" error={errors.email && t(errors.email.message as MessageKey)} {...register('email')} />
        <Field label={t('login.password')} type="password" autoComplete="current-password" error={errors.password && t(errors.password.message as MessageKey)} {...register('password')} />
        {failed ? (
          <p role="alert" className="error">
            {t('login.failed')}
          </p>
        ) : null}
        <button type="submit" disabled={isSubmitting}>
          {t('login.submit')}
        </button>
      </form>
      <p className="hint">{t('login.hint')}</p>
    </section>
  );
}
