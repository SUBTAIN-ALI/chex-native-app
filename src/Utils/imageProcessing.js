import { Image } from 'react-native';
import imageResizer from '@bam.tech/react-native-image-resizer';

export async function fixImageOrientation(uri) {
  try {
    const sourceUri = uri.startsWith('/') ? `file://${uri}` : uri;
    const { width, height } = await new Promise((resolve, reject) => {
      Image.getSize(sourceUri, (w, h) => resolve({ width: w, height: h }), reject);
    });
    if (!(width > 0 && height > 0)) {
      return uri;
    }

    // A square containing both dimensions avoids shrinking rotated photos.
    // Keep baking orientation into pixels for upload consumers that ignore EXIF.
    const maxDimension = Math.max(width, height);
    const result = await imageResizer.createResizedImage(
      sourceUri,
      maxDimension,
      maxDimension,
      'JPEG',
      100,
      0,
      undefined,
      false,
      { mode: 'contain', onlyScaleDown: true }
    );

    return result.uri;
  } catch (error) {
    console.warn('⚠️ Error fixing image orientation:', error);
    return uri;
  }
}
