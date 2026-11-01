import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useObjectUrls } from './useObjectUrl';

const [front, back, box] = ['front', 'back', 'box'].map(name => new Blob([name], { type: 'image/png' }));

describe('useObjectUrls', () => {
  let names;

  beforeEach(() => {
    names = new Map();
    const TestUrl = class extends globalThis.URL {};
    TestUrl.createObjectURL = vi.fn(blob => {
      const url = `blob:${names.size + 1}`;
      names.set(url, blob);
      return url;
    });
    TestUrl.revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', TestUrl);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Records what every render returned, including renders before the effects ran.
  function renderUrls(initialBlobs) {
    const renders = [];
    const hook = renderHook(({ blobs }) => {
      const urls = useObjectUrls(blobs);
      renders.push({ blobs, urls });
      return urls;
    }, { initialProps: { blobs: initialBlobs } });
    return { ...hook, renders };
  }

  it('gives each Blob its own URL in list order', () => {
    const { result } = renderUrls([front, back]);

    expect(result.current.map(url => names.get(url))).toEqual([front, back]);
  });

  it('never shows one photo with the URL of another while the list changes', () => {
    const { rerender, renders } = renderUrls([front, back, box]);
    const [frontUrl, backUrl, boxUrl] = renders.at(-1).urls;

    rerender({ blobs: [box, front] });

    renders.forEach(({ blobs, urls }) => {
      urls.forEach((url, index) => {
        if (url !== null) expect(names.get(url)).toBe(blobs[index]);
      });
    });
    expect(renders.at(-1).urls).toEqual([boxUrl, frontUrl]);
    // Reordering reuses the URLs; only the photo that left the list loses its URL.
    expect(URL.createObjectURL).toHaveBeenCalledTimes(3);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(backUrl);
  });

  it('revokes every URL when the component goes away', () => {
    const { result, unmount } = renderUrls([front, back]);
    const urls = result.current;

    unmount();

    expect(URL.revokeObjectURL.mock.calls.map(([url]) => url).sort()).toEqual([...urls].sort());
  });
});
