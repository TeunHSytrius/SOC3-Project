import type { FormEvent } from 'react';

// All current dialogs contain text fields, not file uploads.
export function formData(event: FormEvent<HTMLFormElement>): Record<string, string> {
  event.preventDefault();
  return Object.fromEntries(
    Array.from(new FormData(event.currentTarget), ([name, value]) => [name, String(value)]),
  );
}
