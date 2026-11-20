export function deriveUserName(email?: string | null): string {
  if (!email) return 'Counselor';
  const localPart = email.split('@')[0] ?? '';
  if (!localPart) return 'Counselor';

  // Specific common patterns in guidance office
  if (/^artuzjrchristopher/i.test(localPart)) return 'Christopher Artuz';
  if (/^chriszelartuz/i.test(localPart)) return 'Chriszel Artuz';

  const firstToken = localPart.split('.')[0] ?? localPart;
  if (!firstToken) return 'Counselor';
  return firstToken.charAt(0).toUpperCase() + firstToken.slice(1);
}

export function deriveInitials(name?: string | null): string {
  if (!name) return 'AC';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function truncateEmail(email?: string | null): string {
  if (!email) return '';
  return email.length > 20 ? `${email.slice(0, 17)}...` : email;
}

export function truncateText(str: string | null | undefined, max = 30, ellipsis = '...'): string {
  if (!str) return '';
  return str.length > max ? `${str.slice(0, max)}${ellipsis}` : str;
}

export function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

export function formatLongDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-US', {
    month: 'long',
    day: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

