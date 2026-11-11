import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getCardImage } from '../services/thumbnails';
import { getCoverPhoto } from '../utils/photoUtils';
import { useObjectUrl } from './useObjectUrl';

// A `ref` that shows a record's cover photo in its card's image, or null when there is
// nothing to show yet. The card shows a small copy of the photo; while the copy is being
// made, the photo itself, which the copy then replaces in place, so the photo stays on
// screen until the copy is ready.
//
// The ref sets the source itself so that it can also drop it when the card is removed: a
// removed image keeps its decoded pixels until memory is next collected, which on a phone
// can be many pages later.
export function useCardImageRef(storeName, record) {
  const [image, setImage] = useState(null);
  const cover = getCoverPhoto(record);

  useEffect(() => {
    if (!cover) {
      setImage(null);
      return undefined;
    }

    const controller = new AbortController();
    const show = (result) => {
      if (result && !controller.signal.aborted) setImage(result);
    };
    getCardImage(storeName, record, cover, { signal: controller.signal, onWait: () => show(cover) }).then(show);
    return () => controller.abort();
  }, [storeName, record, cover]);

  const url = useObjectUrl(image);
  const urlRef = useRef(url);
  const elementRef = useRef(null);

  useLayoutEffect(() => {
    urlRef.current = url;
    if (url && elementRef.current) elementRef.current.src = url;
  }, [url]);

  const showImage = useCallback((element) => {
    elementRef.current = element;
    if (urlRef.current) element.src = urlRef.current;
    return () => {
      if (elementRef.current === element) elementRef.current = null;
      element.removeAttribute('src');
    };
  }, []);

  return url ? showImage : null;
}
