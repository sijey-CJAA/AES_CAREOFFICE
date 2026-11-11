import { describe, expect, it } from 'vitest';
import { getLearnerSchoolYearOptions } from '../lib/constants';
import { deriveUserName, formatShortDate, truncateEmail, truncateText } from '../lib/formatters';

describe('formatters & constants', () => {
  it('derives friendly display name from email like PHP index.php', () => {
    expect(deriveUserName('maria.santos@aes.edu.ph')).toBe('Maria');
    expect(deriveUserName('counselor@aes.edu.ph')).toBe('Counselor');
    expect(deriveUserName('')).toBe('Counselor');
  });

  it('truncates email over 20 characters matching topbar.php', () => {
    expect(truncateEmail('short@aes.ph')).toBe('short@aes.ph');
    expect(truncateEmail('verylongcounseloremail@aes.edu.ph')).toBe('verylongcounselor...');
  });

  it('truncates long table cell text safely', () => {
    expect(truncateText('1234567890', 5)).toBe('12345...');
    expect(truncateText(null, 30)).toBe('');
  });

  it('formats ISO dates concisely', () => {
    expect(formatShortDate('2026-03-15')).toMatch(/Mar 15, 2026/);
    expect(formatShortDate(null)).toBe('');
  });

  it('generates learner school years starting at 2024', () => {
    const years = getLearnerSchoolYearOptions();
    expect(years[0]).toBe('2024-2025');
    expect(years.length).toBeGreaterThanOrEqual(2);
  });
});

