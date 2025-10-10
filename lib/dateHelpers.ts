export function toIsoDateUTC(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatIsoForHe(iso: string) {
  const d = new Date(iso + 'T00:00:00Z');
  return new Intl.DateTimeFormat('he-IL-u-ca-gregory', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}
