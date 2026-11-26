import type React from 'react';

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
