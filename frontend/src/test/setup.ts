import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

if (!window.confirm) {
  window.confirm = vi.fn(() => true);
}
if (!window.alert) {
  window.alert = vi.fn();
}

