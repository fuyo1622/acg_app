import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { compressImage } from './imageUtils';

describe('compressImage utility', () => {
  beforeAll(() => {
    globalThis.URL = globalThis.URL || {};
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    globalThis.URL.revokeObjectURL = vi.fn();
    globalThis.createImageBitmap = vi.fn().mockRejectedValue(new Error('Not supported in jsdom'));
    
    // Polyfill Image constructor for jsdom to instantly throw onerror reliably
    globalThis.Image = class {
      constructor() {
        setTimeout(() => {
          if (this.onerror) this.onerror(new Error('mock image error'));
        }, 0);
      }
    };
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('returns exact same input if it is null or undefined', async () => {
    const resNull = await compressImage(null);
    expect(resNull).toBeNull();

    const resUndefined = await compressImage(undefined);
    expect(resUndefined).toBeUndefined();
  });

  it('returns exact same input if it is not a Blob or File instance', async () => {
    const fakeFile = { type: 'image/jpeg', name: 'photo.jpg' };
    const res = await compressImage(fakeFile);
    expect(res).toBe(fakeFile);
  });

  it('returns exact same input if the blob type is NOT an image', async () => {
    const textFile = new File(['some content'], 'doc.txt', { type: 'text/plain' });
    const res = await compressImage(textFile);
    expect(res).toBe(textFile);
  });

  it('falls back safely to original file on Image decode failure (like during jsdom runtime)', async () => {
    // In jsdom environment, actual image processing via canvas and URLs will trigger the onerror pathway 
    // securely reverting back to the original payload perfectly.
    const fakeImageBuffer = new File(['fake binary data'], 'photo.png', { type: 'image/png' });
    const res = await compressImage(fakeImageBuffer);
    expect(res).toBe(fakeImageBuffer);
  });
});
