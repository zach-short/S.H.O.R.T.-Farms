import clsx from 'clsx';
import type { ComponentProps, ReactNode } from 'react';

export function Panel({ className, ...props }: ComponentProps<'div'>) {
  return <div className={clsx('panel rounded-xl', className)} {...props} />;
}

export function PanelTitle({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 pt-2.5 pb-1.5 text-[10px] font-semibold tracking-[0.12em] text-slate-400 uppercase">
      {children}
    </div>
  );
}

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'ghost' | 'solid' | 'danger';
};

export function Button({ className, variant = 'ghost', ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition',
        'focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-40',
        variant === 'ghost' && 'text-slate-300 hover:bg-white/10 hover:text-white',
        variant === 'solid' && 'bg-sky-500 text-white hover:bg-sky-400',
        variant === 'danger' && 'text-rose-300 hover:bg-rose-500/15 hover:text-rose-200',
        className,
      )}
      {...props}
    />
  );
}

export function TextInput({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={clsx(
        'w-full rounded-lg border border-white/10 bg-slate-950/60 px-2.5 py-1.5 text-sm text-slate-100',
        'placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none',
        className,
      )}
      {...props}
    />
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={clsx(
        'flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs transition',
        disabled
          ? 'cursor-not-allowed text-slate-500 opacity-60'
          : 'text-slate-300 hover:bg-white/5',
      )}
    >
      <span>{label}</span>
      <span
        className={clsx(
          'relative h-4 w-7 rounded-full transition',
          checked ? 'bg-sky-500' : 'bg-slate-600',
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all',
            checked ? 'left-3.5' : 'left-0.5',
          )}
        />
      </span>
    </button>
  );
}
