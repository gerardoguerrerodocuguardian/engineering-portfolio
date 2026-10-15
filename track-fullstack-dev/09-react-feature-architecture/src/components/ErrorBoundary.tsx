import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useI18n } from '@/i18n';

function Fallback({ onReset }: { onReset: () => void }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="card">
      <h2>{t('error.title')}</h2>
      <button type="button" onClick={onReset}>
        {t('error.retry')}
      </button>
    </div>
  );
}

interface Props {
  children: ReactNode;
  /** Called on reset so callers can also reset server-state error caches (QueryErrorResetBoundary). */
  onReset?: () => void;
  onError?: (error: Error, info: ErrorInfo) => void;
}

export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }
  reset = () => {
    this.props.onReset?.();
    this.setState({ failed: false });
  };
  render() {
    return this.state.failed ? <Fallback onReset={this.reset} /> : this.props.children;
  }
}
