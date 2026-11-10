export const COMPRESSION_CONFIG = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.85,
  preferredMimeType: 'image/webp',
  minSizeToCompress: 1024 * 50 // 50 KB
};

// A phone frees a canvas only when memory is collected, and caps the total. Shrinking it
// frees its memory at once.
function releaseCanvas(canvas) {
  canvas.width = 0;
  canvas.height = 0;
}

// Decodes an image for drawing, upright whatever its EXIF orientation. Browsers where
// createImageBitmap fails or lacks orientation support go through an image element.
async function decodeImage(file) {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  } catch {
    const url = URL.createObjectURL(file);
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => { URL.revokeObjectURL(url); resolve(element); };
      element.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
      element.src = url;
    });
    // An image element keeps its decoded pixels until memory is next collected, unless its
    // source is dropped.
    return {
      source: image,
      width: image.width,
      height: image.height,
      release: () => image.removeAttribute('src'),
    };
  }
}

export function compressImage(file) {
  if (!file || !(file instanceof Blob) || !file.type.startsWith('image/')) {
    return Promise.resolve(file);
  }

  // Do not unnecessarily recompress very small images
  if (file.size < COMPRESSION_CONFIG.minSizeToCompress) {
    return Promise.resolve(file);
  }

  return new Promise((resolve) => {
    (async () => {
      try {
      const decoded = await decodeImage(file);
      let { width, height } = decoded;

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
        decoded.release();
        return resolve(file);
      }

      ctx.drawImage(decoded.source, 0, 0, width, height);
      decoded.release();

      // Export canvas
      const targetMimeType = COMPRESSION_CONFIG.preferredMimeType;
      
      canvas.toBlob((blob) => {
        releaseCanvas(canvas);
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

export const THUMBNAIL_SIZE = 320;

// A small JPEG for screens that show many photos at once, such as the album import grid:
// a full 1600px photo takes several megabytes of memory on screen, a thumbnail a fraction
// of that. Returns the photo itself when it is already small or cannot be decoded.
export async function createThumbnail(photo, size = THUMBNAIL_SIZE) {
  try {
    const decoded = await decodeImage(photo);
    const scale = size / Math.max(decoded.width, decoded.height);
    if (scale >= 1) {
      decoded.release();
      return photo;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(decoded.width * scale));
    canvas.height = Math.max(1, Math.round(decoded.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      decoded.release();
      return photo;
    }
    ctx.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
    decoded.release();

    const thumbnail = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    releaseCanvas(canvas);
    return thumbnail ?? photo;
  } catch {
    return photo;
  }
}
