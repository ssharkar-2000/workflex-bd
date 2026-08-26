import { Jimp } from 'jimp';

export interface RawImage {
  /** RGBA, 4 bytes per pixel. */
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Decode a stored photo into raw RGBA.
 *
 * Everything downstream — OpenCV Mats, TensorFlow tensors — wants pixels, not
 * a JPEG. Jimp is pure JavaScript, which matters here: a native decoder would
 * mean node-gyp builds on every developer machine and in CI.
 */
export async function decodeImage(buffer: Buffer): Promise<RawImage> {
  const image = await Jimp.read(buffer);
  return {
    data: new Uint8ClampedArray(image.bitmap.data),
    width: image.bitmap.width,
    height: image.bitmap.height,
  };
}

/**
 * Downscale before analysis. A 12-megapixel phone photo costs many seconds of
 * CPU in OpenCV and TensorFlow for no gain — the signals we need survive at a
 * fraction of the size.
 */
export async function decodeAndResize(
  buffer: Buffer,
  maxEdge = 1280,
): Promise<RawImage> {
  const image = await Jimp.read(buffer);
  const longest = Math.max(image.bitmap.width, image.bitmap.height);

  if (longest > maxEdge) {
    const scale = maxEdge / longest;
    image.resize({
      w: Math.round(image.bitmap.width * scale),
      h: Math.round(image.bitmap.height * scale),
    });
  }

  return {
    data: new Uint8ClampedArray(image.bitmap.data),
    width: image.bitmap.width,
    height: image.bitmap.height,
  };
}

/** Greyscale JPEG, which is what Tesseract reads most reliably. */
export async function toOcrInput(buffer: Buffer): Promise<Buffer> {
  const image = await Jimp.read(buffer);
  const longest = Math.max(image.bitmap.width, image.bitmap.height);

  // Tesseract wants roughly 300 DPI worth of glyph height; upscaling a small
  // photo helps more than it costs.
  if (longest < 1000) {
    const scale = 1000 / longest;
    image.resize({
      w: Math.round(image.bitmap.width * scale),
      h: Math.round(image.bitmap.height * scale),
    });
  }

  image.greyscale().contrast(0.2);
  return Buffer.from(await image.getBuffer('image/jpeg'));
}
