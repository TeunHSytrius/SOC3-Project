import { useId, type ReactNode } from 'react';
import { AppMenu } from './AppMenu';
import type { NavigationItem } from './AppMenu';
import './AppShell.css';

export interface CustomerOption {
  id: string;
  name: string;
}

export interface AppUser {
  displayName: string;
  role: string;
}

interface AppShellProps {
  user: AppUser;
  customer: CustomerOption;
  customerOptions?: CustomerOption[];
  onCustomerChange?: (customerId: string) => void;
  navigationItems: NavigationItem[];
  children: ReactNode;
  currentPath?: string;
  onNavigate?: (href: string) => void;
  actions?: ReactNode;
}

export function AppShell({
  user,
  customer,
  customerOptions = [],
  onCustomerChange,
  navigationItems,
  children,
  currentPath,
  onNavigate,
  actions,
}: AppShellProps) {
  const customerSelectId = useId();
  const canSwitchCustomer = customerOptions.length > 1 && onCustomerChange !== undefined;

  return (
    <div className="AppShell">
      <header className="AppShell__header">
        <div className="AppShell__topbar">
          <a
            className="AppShell__brand"
            href="/"
            aria-label="SOC3 startpagina"
            onClick={(event) => {
              if (onNavigate) {
                event.preventDefault();
                onNavigate(navigationItems[0]?.href ?? '/');
              }
            }}
          >
            <span className="AppShell__brandMark" aria-hidden="true">
              SOC
            </span>
            <span>SOC Management</span>
          </a>
          <AppMenu items={navigationItems} currentPath={currentPath} onNavigate={onNavigate} />
        </div>
        <div className="AppShell__context">
          <div className="AppShell__user" aria-label="Ingelogde gebruiker">
            <span className="AppShell__userName">{user.displayName}</span>
            <span className="AppShell__role">{user.role}</span>
          </div>
          <div className="AppShell__customer">
            {canSwitchCustomer ? <label htmlFor={customerSelectId}>Klant</label> : <span className="AppShell__customerLabel">Klant</span>}
            {canSwitchCustomer ? (
              <>
                <select
                  id={customerSelectId}
                  aria-label="Actieve klant"
                  value={customer.id}
                  onChange={(event) => onCustomerChange(event.currentTarget.value)}
                >
                  {customerOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <span className="AppShell__customerName">{customer.name}</span>
            )}
          </div>
          {actions && <div className="workspace-actions">{actions}</div>}
        </div>
      </header>
      <main className="AppShell__content">
        {children}
      </main>
    </div>
  );
}
