import { forwardRef, type ElementType, type ComponentPropsWithoutRef } from 'react';
import { cx } from '../internal/utils';

type BadgeOwnProps<T extends ElementType> = {
  tone?: 'neutral' | 'success' | 'warning' | 'info' | 'danger';
  /** Polymorphic root element. Defaults to span. */
  as?: T;
};
export type BadgeProps<T extends ElementType = 'span'> = BadgeOwnProps<T> & Omit<ComponentPropsWithoutRef<T>, keyof BadgeOwnProps<T>>;

/** Status is conveyed by text (never colour alone); tone only adds emphasis. */
function BadgeImpl<T extends ElementType = 'span'>({ tone = 'neutral', as, className, ...rest }: BadgeProps<T>, ref: React.Ref<Element>) {
  const Component: ElementType = as ?? 'span';
  return <Component ref={ref} className={cx('adf-badge', className)} data-tone={tone} {...rest} />;
}

export const Badge = forwardRef(BadgeImpl) as <T extends ElementType = 'span'>(
  props: BadgeProps<T> & { ref?: React.Ref<Element> },
) => React.ReactElement | null;
