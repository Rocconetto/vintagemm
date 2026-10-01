// Client-side photo preparation: decode (respecting EXIF orientation), downscale, re-encode.
// Smaller uploads keep the analysis fast and the archive light.

export interface PreparedPhoto {
  photo: Blob; // up to 1600px, used for analysis and the appraisal page
  thumb: Blob; // up to 640px, used in the archive grid
  dataUrl: string;
  width: number;
  height: number;
}

export class PhotoError extends Error {}

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fall back to <img> decoding below */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function render(source: ImageBitmap | HTMLImageElement, maxSide: number, quality: number) {
  const w = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const h = 'naturalHeight' in source ? source.naturalHeight : source.height;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new PhotoError('Canvas unavailable');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise<{ blob: Blob; width: number; height: number }>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve({ blob, width: canvas.width, height: canvas.height }) : reject(new PhotoError('Encoding failed'))),
      'image/jpeg',
      quality,
    ),
  );
}

function toDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new PhotoError('Read failed'));
    reader.readAsDataURL(blob);
  });
}

export async function preparePhoto(file: Blob): Promise<PreparedPhoto> {
  if (file.type && !file.type.startsWith('image/')) throw new PhotoError('Not an image');
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await decode(file);
  } catch {
    throw new PhotoError('Unreadable image');
  }
  const photo = await render(source, 1600, 0.86);
  const thumb = await render(source, 640, 0.8);
  if ('close' in source) source.close();
  return { photo: photo.blob, thumb: thumb.blob, dataUrl: await toDataUrl(photo.blob), width: photo.width, height: photo.height };
}
