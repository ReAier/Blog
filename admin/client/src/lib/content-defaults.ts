function timestampSlug(prefix: string, now: Date): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${prefix}-${value.year}${value.month}${value.day}-${value.hour}${value.minute}${value.second}-${String(now.getMilliseconds()).padStart(3, '0')}`;
}

function latinSlug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function todayInShanghai(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function automaticPostSlug(title: string, now = new Date()): string {
  return latinSlug(title) || timestampSlug('post', now);
}

export function automaticClipSlug(file: string, now = new Date()): string {
  const stem = file.replace(/\.[^.]+$/, '');
  return latinSlug(stem) || timestampSlug('clip', now);
}
