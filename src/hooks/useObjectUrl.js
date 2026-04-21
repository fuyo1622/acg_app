import { useState, useEffect } from 'react';

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
