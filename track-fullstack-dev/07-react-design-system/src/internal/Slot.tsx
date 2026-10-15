import { cloneElement, forwardRef, isValidElement, type HTMLAttributes, type Ref } from 'react';
import { composeRefs } from './utils';

type AnyProps = Record<string, unknown>;

function mergeProps(slotProps: AnyProps, childProps: AnyProps): AnyProps {
  const merged: AnyProps = { ...slotProps, ...childProps };
  for (const key of Object.keys(slotProps)) {
    const slotValue = slotProps[key];
    const childValue = childProps[key];
    if (/^on[A-Z]/.test(key) && typeof slotValue === 'function' && typeof childValue === 'function') {
      merged[key] = (...args: unknown[]) => {
        childValue(...args);
        slotValue(...args);
      };
    } else if (key === 'style') {
      merged[key] = { ...(slotValue as object), ...(childValue as object) };
    } else if (key === 'className') {
      merged[key] = [slotValue, childValue].filter(Boolean).join(' ');
    }
  }
  return merged;
}

/**
 * Renders its single child element with the Slot's props merged in. This powers `asChild`:
 * the design-system component contributes behaviour and styles, the consumer keeps the element
 * (for example a router `<Link>`).
 */
export const Slot = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(function Slot({ children, ...slotProps }, ref) {
  if (!isValidElement(children)) return null;
  const childProps = children.props as AnyProps;
  return cloneElement(children as React.ReactElement<AnyProps>, {
    ...mergeProps(slotProps as AnyProps, childProps),
    ref: composeRefs(ref, childProps.ref as Ref<HTMLElement> | undefined),
  });
});
