import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ')

export function Button({
  variant = 'default',
  className,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'ghost' | 'danger' | 'primary'
}) {
  return (
    <button
      {...p}
      className={cx(
        'inline-flex h-10 items-center justify-center gap-2 rounded-sm border px-3 text-sm font-medium transition-colors duration-200 disabled:opacity-40',
        variant === 'default' && 'border-line-strong bg-surface text-ink hover:bg-hover',
        variant === 'primary' &&
          'border-accent bg-accent text-accent-fg hover:border-accent-hover hover:bg-accent-hover',
        variant === 'ghost' && 'border-transparent text-ink-soft hover:bg-hover hover:text-ink',
        variant === 'danger' && 'border-line-strong bg-danger-bg text-danger hover:bg-hover',
        className,
      )}
    />
  )
}

const control = 'h-10 w-full rounded-sm border border-line-strong bg-surface px-3 text-sm text-ink'

export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx(control, className)} />
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <label className="block space-y-1 text-xs text-ink-soft">
      <span className="font-semibold">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export function Card({
  title,
  children,
  className,
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cx('rounded-sm border border-edge bg-surface p-6', className)}>
      {title && (
        <h3 className="mb-4 flex items-center text-xl font-bold tracking-tight">
          <span className="mr-2.5 inline-block size-2 bg-accent" />
          {title}
        </h3>
      )}
      {children}
    </section>
  )
}

export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={control} />
)
