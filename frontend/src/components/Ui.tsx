import React from 'react';
import { labels } from '../types/domain';
import { EmptyState } from './PageStates';
const iconPaths = {
  dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  alerts: 'M12 3 2 20h20L12 3z M12 9v4 M12 16h.01',
  cases: 'M3 6h7l2 2h9v12H3z M3 6V4h7l2 2',
  customers: 'M3 21V4h13v17 M16 10h5v11 M7 8h2 M7 12h2 M7 16h2 M12 8h1 M12 12h1 M12 16h1',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-4 M16 3a4 4 0 0 1 0 8',
  keys: 'M15 3a6 6 0 1 0 4 10l3 3-3 3-2-2-3 3-3-3 5-5',
  audit: 'M5 3h14v18H5z M9 7h6 M9 12h6 M9 17h6',
  account: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M4 21v-2a8 8 0 0 1 16 0v2',
  shield: 'M12 2 3 6v6c0 5 4 8 9 10 5-2 9-5 9-10V6z M8 12l3 3 5-6',
  logout: 'M10 4H4v16h6 M10 12h11 M17 8l4 4-4 4',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M16 16l5 5',
  refresh: 'M20 11a8 8 0 1 0-2 6 M20 4v7h-7',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l4 2',
  check: 'M4 12l5 5L20 6',
  plus: 'M12 4v16 M4 12h16',
  arrow: 'M5 12h14 M14 7l5 5-5 5',
};
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={iconPaths[name] || iconPaths.dashboard} />
    </svg>
  );
}
export function Badge({ value, kind }: { value: string; kind?: string }) {
  return (
    <span
      className={
        'badge ' +
        (kind ||
          (['Immediate', 'Urgent', 'New'].includes(value)
            ? 'danger'
            : ['High', 'UnderReview', 'PendingReview'].includes(value)
              ? 'warn'
              : ['Resolved', 'Closed', 'Dismissed', 'Low'].includes(value)
                ? 'good'
                : ['Escalated', 'UnderInvestigation'].includes(value)
                  ? 'blue'
                  : 'neutral'))
      }
    >
      {labels[value] || value}
    </span>
  );
}
export function Button({
  children,
  onClick,
  primary = false,
  type = 'button',
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  primary?: boolean;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      className={primary ? 'primary' : 'secondary'}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Select({
  options,
  value,
  onChange,
  name,
  placeholder,
  required = false,
}: {
  options: (string | { id: string; name: string })[];
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  name?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <select name={name} value={value} onChange={onChange} required={required}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((option) =>
        typeof option === 'string' ? (
          <option key={option} value={option}>
            {labels[option] || option}
          </option>
        ) : (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ),
      )}
    </select>
  );
}
export function Table({
  head,
  children,
  empty = false,
}: {
  head: string[];
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            {head.map((heading) => (
              <th key={heading}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty && (
        <EmptyState
          title="Geen resultaten"
          description="Pas de filters aan of voeg gegevens toe."
        />
      )}
    </div>
  );
}
export function Panel({
  title,
  sub,
  children,
  action,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panelhead">
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

import { PageHeader as NavigationPageHeader } from './PageHeader';
export function PageHeader({
  title,
  sub,
  action,
}: {
  title: string;
  sub: string;
  action?: React.ReactNode;
}) {
  return <NavigationPageHeader title={title} description={sub} actions={action} />;
}
