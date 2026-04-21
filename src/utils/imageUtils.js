export const COMPRESSION_CONFIG = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.85,
  preferredMimeType: 'image/webp'
};

export function compressImage(file) {
  if (!file || !(file instanceof Blob) || !file.type.startsWith('image/')) {
    return Promise.resolve(file);
  }

  return new Promise((resolve) => {
    (async () => {
      try {
      let imageObj = null;
      let width = 0;
      let height = 0;
      let isBitmap = false;

      // Try EXIF-safe decoding first
      try {
        imageObj = await createImageBitmap(file, { imageOrientation: 'from-image' });
        width = imageObj.width;
        height = imageObj.height;
        isBitmap = true;
      } catch {
        // Fallback for browsers that failed createImageBitmap or lack orientation support
        const url = URL.createObjectURL(file);
        imageObj = await new Promise((res, rej) => {
          const img = new Image();
          img.onload = () => { URL.revokeObjectURL(url); res(img); };
          img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Image load failed')); };
          img.src = url;
        });
        width = imageObj.width;
        height = imageObj.height;
      }

      // Calculate preserved aspect ratio bounded dimensions
      if (width > COMPRESSION_CONFIG.maxWidth || height > COMPRESSION_CONFIG.maxHeight) {
        if (width > height) {
          height = Math.round((height * COMPRESSION_CONFIG.maxWidth) / width);
          width = COMPRESSION_CONFIG.maxWidth;
        } else {
          width = Math.round((width * COMPRESSION_CONFIG.maxHeight) / height);
          height = COMPRESSION_CONFIG.maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        if (isBitmap) imageObj.close();
        return resolve(file);
      }

      ctx.drawImage(imageObj, 0, 0, width, height);
      if (isBitmap) imageObj.close();

      // Export canvas
      const targetMimeType = COMPRESSION_CONFIG.preferredMimeType;
      
      canvas.toBlob((blob) => {
        if (!blob) return resolve(file);
        
        // Only return compressed version if it actually saves space
        if (blob.size >= file.size) return resolve(file);
        
        // Browsers unsupported by targeted MimeType safely default to image/png
        const finalMimeType = blob.type || targetMimeType;
        const resultFileName = file instanceof File ? file.name : 'image';
        
        const compressedFile = new File([blob], resultFileName, { type: finalMimeType, lastModified: Date.now() });
        resolve(compressedFile);

      }, targetMimeType, COMPRESSION_CONFIG.quality);

    } catch {
      // Complete fallback
      resolve(file);
    }
    })();
  });
}
