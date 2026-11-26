export const roles = ['Analist', 'Senior analist', 'Beheerder', 'Klant', 'Accountmanager'];

export const fmt = (date: string | null | undefined) =>
  date
    ? new Date(date).toLocaleString('nl-NL', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';
