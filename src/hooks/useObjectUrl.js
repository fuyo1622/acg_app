import { useState, useEffect, useMemo, useRef } from 'react';

export function useObjectUrl(file) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }

    // Create the object URL
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);

    // Revoke the object URL on unmount or when file changes
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return url;
}

// Object URLs for a list of Blobs, in the same order; null for a Blob whose URL is not
// ready yet. Each Blob keeps its URL while it stays in the list, so reordering does not
// recreate URLs; URLs of removed Blobs are revoked, and all of them on unmount. Pass a
// list whose identity changes only when its contents do (state, or a memoized value).
export function useObjectUrls(blobs) {
  const cacheRef = useRef(new Map());
  const [urlsByBlob, setUrlsByBlob] = useState(() => new Map());

  useEffect(() => {
    const cache = cacheRef.current;
    const list = blobs ?? [];
    list.forEach(blob => {
      if (blob instanceof Blob && !cache.has(blob)) cache.set(blob, URL.createObjectURL(blob));
    });

    const kept = new Set(list);
    for (const [blob, url] of cache) {
      if (!kept.has(blob)) {
        URL.revokeObjectURL(url);
        cache.delete(blob);
      }
    }
    setUrlsByBlob(new Map(cache));
  }, [blobs]);

  useEffect(() => {
    const cache = cacheRef.current;
    return () => {
      for (const url of cache.values()) URL.revokeObjectURL(url);
      cache.clear();
    };
  }, []);

  // Looked up by Blob rather than by position: in the render right after photos are
  // reordered or merged, before the effect above runs, each photo still shows its own image.
  return useMemo(
    () => (blobs ?? []).map(blob => urlsByBlob.get(blob) ?? null),
    [blobs, urlsByBlob],
  );
}
