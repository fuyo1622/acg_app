import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { compressImage, createThumbnail } from './imageUtils';

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

describe('createThumbnail', () => {
  const photo = new File(['photo'], 'photo.webp', { type: 'image/webp' });

  beforeEach(() => {
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:photo'), revokeObjectURL: vi.fn() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function stubBitmap(width, height) {
    const bitmap = { width, height, close: vi.fn() };
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
    return bitmap;
  }

  function stubCanvas() {
    const context = { drawImage: vi.fn() };
    const stub = { sizeWhenExported: null, context };
    const canvas = {
      getContext: () => context,
      toBlob: (callback, type) => {
        stub.sizeWhenExported = [canvas.width, canvas.height];
        callback(new Blob(['thumbnail'], { type }));
      },
    };
    stub.canvas = canvas;
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(tag => (tag === 'canvas' ? canvas : createElement(tag)));
    return stub;
  }

  // An image element that loads, or fails, the way a browser's would.
  function stubImageElement({ width, height, fails = false }) {
    const created = [];
    vi.stubGlobal('Image', class {
      width = width;

      height = height;

      removeAttribute = vi.fn();

      constructor() {
        created.push(this);
      }

      set src(_url) {
        setTimeout(() => (fails ? this.onerror(new Error('cannot decode')) : this.onload()), 0);
      }
    });
    return created;
  }

  it('returns the photo itself when it cannot be decoded', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('cannot decode')));
    stubImageElement({ width: 0, height: 0, fails: true });

    expect(await createThumbnail(photo)).toBe(photo);
  });

  it('keeps a photo that is already thumbnail-sized', async () => {
    const bitmap = stubBitmap(300, 200);

    expect(await createThumbnail(photo)).toBe(photo);
    expect(bitmap.close).toHaveBeenCalled();
  });

  it('scales a large photo down to a small JPEG with the same proportions', async () => {
    const bitmap = stubBitmap(1600, 1200);
    const stub = stubCanvas();

    const thumbnail = await createThumbnail(photo);

    expect(stub.context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 320, 240);
    expect(stub.sizeWhenExported).toEqual([320, 240]);
    // The canvas gives its memory back as soon as the image is out.
    expect([stub.canvas.width, stub.canvas.height]).toEqual([0, 0]);
    expect(thumbnail).not.toBe(photo);
    expect(thumbnail.type).toBe('image/jpeg');
    expect(bitmap.close).toHaveBeenCalled();
  });

  it('honours the size it is asked for', async () => {
    const bitmap = stubBitmap(1200, 1600);
    const { context } = stubCanvas();

    await createThumbnail(photo, 480);

    expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 360, 480);
  });

  it('falls back to an image element where the browser refuses the orientation option', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new TypeError('Unknown imageOrientation')));
    const created = stubImageElement({ width: 1600, height: 1200 });
    const { context } = stubCanvas();

    const thumbnail = await createThumbnail(photo);

    const [element] = created;
    expect(context.drawImage).toHaveBeenCalledWith(element, 0, 0, 320, 240);
    expect(thumbnail.type).toBe('image/jpeg');
    // It lets go of the decoded photo at once instead of waiting for memory to be collected.
    expect(element.removeAttribute).toHaveBeenCalledWith('src');
  });
});
