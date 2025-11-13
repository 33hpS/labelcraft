import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { registerRobotoFont } from '../lib/pdfFonts';

const createMockFontData = () => {
  const bytes = new Uint8Array(2048);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = i % 256;
  }
  return bytes.buffer;
};

const mockFontData = createMockFontData();

let originalFetch: typeof fetch | undefined;

beforeEach(() => {
  originalFetch = global.fetch;
  global.fetch = (vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input instanceof Request
          ? input.url
          : '';

    if (url.endsWith('Roboto-Regular.ttf') || url.endsWith('Roboto-Bold.ttf')) {
      return new Response(mockFontData, { status: 200 });
    }

    return new Response(null, { status: 404 });
  }) as typeof fetch);
});

afterEach(() => {
  if (originalFetch) {
    global.fetch = originalFetch;
  }
  vi.restoreAllMocks();
});

describe('pdf font registration', () => {
  it('registers Roboto fonts with Identity-H encoding', async () => {
    const addFileToVFS = vi.fn();
    const addFont = vi.fn();
    const pdf = { addFileToVFS, addFont } as unknown as any;

    const registered = await registerRobotoFont(pdf);

    expect(registered).toBe(true);
    expect(addFileToVFS).toHaveBeenCalledWith('Roboto-Regular.ttf', expect.any(String));
    expect(addFont).toHaveBeenCalledWith('Roboto-Regular.ttf', 'Roboto', 'normal', 'Identity-H');
    expect(addFont).toHaveBeenCalledWith('Roboto-Bold.ttf', 'Roboto', 'bold', 'Identity-H');
  });
});
