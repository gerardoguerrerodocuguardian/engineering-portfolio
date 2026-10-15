import { useState } from 'react';
import { useAuth } from './AuthProvider';
import { validateLogin, type LoginErrors } from './validation';

export function useLoginForm() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const found = validateLogin(email, password);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Sign-in failed');
    } finally {
      setSubmitting(false);
    }
  }

  return { email, setEmail, password, setPassword, errors, formError, submitting, submit };
}
