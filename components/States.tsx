import type { ReactNode } from 'react';

/** Full-page spinner used while data loads. */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <span className="material-symbols-outlined text-[32px] text-primary animate-spin">progress_activity</span>
      <p className="font-body-sm text-body-sm text-on-surface-variant">{label}</p>
    </div>
  );
}

/** Inline error panel with an optional retry action. */
export function ErrorState({
  message,
  onRetry,
  title = 'Something went wrong',
}: {
  message: string;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div className="rounded-xl bg-error-container/60 border border-error/20 p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-on-error-container">
        <span className="material-symbols-outlined text-[20px]">error</span>
        <h3 className="font-headline-sm text-headline-sm">{title}</h3>
      </div>
      <p className="font-body-sm text-body-sm text-on-error-container">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="self-start mt-1 h-9 px-4 rounded-lg bg-surface-container-lowest text-on-surface font-headline-sm text-[14px] hover:bg-surface-container transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}

/** Neutral empty state with an optional call to action. */
export function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl bg-surface-container-lowest border border-surface-container p-8 text-center flex flex-col items-center gap-2">
      <div className="w-12 h-12 rounded-full bg-surface-container-low text-secondary flex items-center justify-center">
        <span className="material-symbols-outlined text-[24px]">{icon}</span>
      </div>
      <p className="font-body-md text-body-md text-on-surface font-medium mt-2">{title}</p>
      {description && <p className="font-body-sm text-body-sm text-on-surface-variant max-w-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Small status pill, e.g. DRAFT / PUBLISHED. */
export function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PUBLISHED: 'bg-tertiary-container/15 text-tertiary',
    DRAFT: 'bg-surface-container-high text-on-surface-variant',
    CLOSED: 'bg-error-container/40 text-error',
    READY: 'bg-tertiary-container/15 text-tertiary',
    PROCESSING: 'bg-secondary-container text-on-secondary-container',
    FAILED: 'bg-error-container/40 text-error',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-label-mono-sm text-label-mono-sm uppercase tracking-wide ${
        styles[status] || 'bg-surface-container-high text-on-surface-variant'
      }`}
    >
      {status.toLowerCase()}
    </span>
  );
}

/** Labelled statistic card. */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: string;
  tone?: 'default' | 'primary' | 'tertiary' | 'error';
}) {
  const tones: Record<string, string> = {
    default: 'text-on-surface',
    primary: 'text-primary',
    tertiary: 'text-tertiary',
    error: 'text-error',
  };
  return (
    <div className="rounded-xl bg-surface-container-lowest border border-surface-container p-4 flex flex-col gap-1">
      <span className="font-label-mono-sm text-label-mono-sm uppercase text-secondary flex items-center gap-1">
        {icon && <span className="material-symbols-outlined text-[14px]">{icon}</span>}
        {label}
      </span>
      <span className={`font-stat-mono-lg text-stat-mono-lg ${tones[tone]}`}>{value}</span>
      {hint && <span className="font-body-sm text-[12px] text-on-surface-variant">{hint}</span>}
    </div>
  );
}
