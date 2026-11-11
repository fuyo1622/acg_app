import { useCallback, useEffect, useState } from 'react';
import { getCardImage } from '../services/thumbnails';
import { getCoverPhoto } from '../utils/photoUtils';
import { useObjectUrl } from './useObjectUrl';

// A `ref` that shows a small copy of a record's cover photo in its card's image, or null
// until the copy is ready. The ref sets the source itself so that it can also drop it: a
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
    getCardImage(storeName, record, cover, controller.signal).then((result) => {
      if (result && !controller.signal.aborted) setImage(result);
    });
    return () => controller.abort();
  }, [storeName, record, cover]);

  const url = useObjectUrl(image);
  const showImage = useCallback((element) => {
    element.src = url;
    return () => element.removeAttribute('src');
  }, [url]);

  return url ? showImage : null;
}
