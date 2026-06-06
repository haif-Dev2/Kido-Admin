import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Some browser APIs jsdom doesn't ship by default. Stub them so components
// that read them don't blow up under test.
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}
