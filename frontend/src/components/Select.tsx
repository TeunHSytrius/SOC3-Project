import type React from 'react';
import { labels } from '../types/domain';

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
