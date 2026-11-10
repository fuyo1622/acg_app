import { BACKUP_SHRINK_PHOTO_BYTES } from './constants';

export const COMPRESSION_CONFIG = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.85,
  preferredMimeType: 'image/webp',
  fallbackMimeType: 'image/jpeg',
  minSizeToCompress: 1024 * 50 // 50 KB
};

let webpEncoding;

// Safari cannot encode WebP: asked for it, a canvas hands back a PNG, which is often larger
// than the photo it was made from, so the photo used to be kept at full size. Where WebP
// cannot be made, photos are compressed as JPEG.
function compressedMimeType() {
  if (webpEncoding === undefined) {
    try {
      const probe = document.createElement('canvas');
      probe.width = 1;
      probe.height = 1;
      webpEncoding = probe.toDataURL(COMPRESSION_CONFIG.preferredMimeType).startsWith('data:image/webp');
    } catch {
      webpEncoding = false;
    }
  }
  return webpEncoding ? COMPRESSION_CONFIG.preferredMimeType : COMPRESSION_CONFIG.fallbackMimeType;
}

// For tests: forget which formats this browser can encode.
export function resetEncodingSupport() {
  webpEncoding = undefined;
}

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

      const targetMimeType = compressedMimeType();
      // JPEG has no transparency; transparent areas turn white instead of black.
      if (targetMimeType === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
      }
      ctx.drawImage(decoded.source, 0, 0, width, height);
      decoded.release();

      canvas.toBlob((blob) => {
        releaseCanvas(canvas);
        if (!blob) return resolve(file);
        
        // Only return compressed version if it actually saves space
        if (blob.size >= file.size) return resolve(file);
        
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

// A photo for a backup: one larger than BACKUP_SHRINK_PHOTO_BYTES is compressed the way a
// newly added photo is, so a backup of photos stored at full size stays small enough to save
// on a phone. GIFs are kept, so they stay animated. Returns the photo itself when it is small
// already or cannot be made smaller.
export async function shrinkPhotoForBackup(photo) {
  if (!(photo instanceof Blob) || photo.size <= BACKUP_SHRINK_PHOTO_BYTES || photo.type === 'image/gif') {
    return photo;
  }
  return compressImage(photo);
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
