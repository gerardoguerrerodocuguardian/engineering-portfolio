import { forwardRef, type CSSProperties, type HTMLAttributes } from 'react';
import { cx } from '../internal/utils';

export interface SkeletonProps extends HTMLAttributes<HTMLSpanElement> {
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  circle?: boolean;
}

/**
 * Decorative placeholder (aria-hidden). Mark the *container* with aria-busy="true" and give
 * assistive tech a text/status alternative; the shimmer is disabled under prefers-reduced-motion.
 */
export const Skeleton = forwardRef<HTMLSpanElement, SkeletonProps>(function Skeleton(
  { width, height = '1em', circle, className, style, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={cx('adf-skeleton', className)}
      data-shape={circle ? 'circle' : 'rect'}
      style={{ width: circle ? height : width, height, ...style }}
      {...rest}
    />
  );
});
