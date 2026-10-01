import { Button as AriaButton, type ButtonProps as AriaButtonProps } from 'react-aria-components';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

export interface ButtonProps extends Omit<AriaButtonProps, 'className'> {
  variant?: Variant;
  size?: Size;
  className?: string;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent-fill text-on-accent hover:brightness-105',
  secondary: 'bg-surface-2 text-text hover:bg-accent-soft',
  ghost: 'bg-transparent text-text hover:bg-accent-soft',
  danger: 'bg-transparent text-danger hover:bg-danger/10',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-sm gap-1.5',
  md: 'h-10 px-3.5 text-sm gap-2',
};

export function Button({ variant = 'secondary', size = 'md', className, ...props }: ButtonProps) {
  return (
    <AriaButton
      {...props}
      className={cn(
        'inline-flex items-center justify-center rounded-panel font-medium transition-colors select-none',
        'outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-focus',
        'data-[disabled]:opacity-40 data-[pressed]:scale-[0.98]',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    />
  );
}

export interface IconButtonProps extends Omit<ButtonProps, 'size' | 'aria-label'> {
  /** Required: icon-only buttons need an accessible name. */
  label: string;
  size?: 'sm' | 'md' | 'lg';
}

const ICON_SIZES = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-12 w-12' };

export function IconButton({ label, size = 'md', variant = 'ghost', className, ...props }: IconButtonProps) {
  return (
    <Button {...props} aria-label={label} variant={variant} className={cn('!px-0', ICON_SIZES[size], className)} />
  );
}
