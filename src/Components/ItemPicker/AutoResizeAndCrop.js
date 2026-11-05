import ImageEditor from '@react-native-community/image-editor';
import {Platform} from 'react-native';
import {heightPercentageToDP as hp, widthPercentageToDP as wp} from 'react-native-responsive-screen';
import ImageResizer from '@bam.tech/react-native-image-resizer';

const PREVIEW_ASPECT = wp('100%') / hp('25%');
const NORMALIZE_MAX = 4096;

const normalizeForIOS = async (path, rawW, rawH) => {
  const maxDim = Math.max(rawW, rawH, NORMALIZE_MAX);
  const result = await ImageResizer.createResizedImage(
    path.startsWith('file://') ? path : `file://${path}`,
    maxDim,
    maxDim,
    'JPEG',
    100,
    0,
    undefined,
    false,
    {mode: 'contain', onlyScaleDown: true}
  );
  return result.path ?? result.uri?.replace?.(/^file:\/\//, '') ?? result.uri;
};

const cropWithImageResizer = async (path, targetWidth, targetHeight) => {
  const uri = path.startsWith('file://') ? path : `file://${path}`;
  const result = await ImageResizer.createResizedImage(uri, targetWidth, targetHeight, 'JPEG', 100, 0, undefined, false, {
    mode: 'cover',
    onlyScaleDown: true,
  });
  return {
    uri: result.uri,
    path: result.path ?? result.uri?.replace?.(/^file:\/\//, '') ?? result.uri,
    width: result.width,
    height: result.height,
  };
};

const autoCropToPreview = async photo => {
  try {
    const {width: rawW, height: rawH, path, orientation} = photo;

    if (Platform.OS === 'ios') {
      // Step 1: Normalize (bake EXIF into pixels) - avoids wrong dimensions from orientation
      const normalizedPath = await normalizeForIOS(path, rawW, rawH);

      // Step 2: Use ImageResizer 'cover' - bypasses ImageEditor's iOS white-space issues.
      // Target dimensions: preserve quality, match preview aspect ratio exactly.
      const maxDim = Math.max(rawW, rawH);
      const targetWidth = Math.round(maxDim);
      const targetHeight = Math.round(maxDim / PREVIEW_ASPECT);

      const result = await cropWithImageResizer(normalizedPath, targetWidth, targetHeight);

      const resolvedUri = result.uri?.startsWith('file://') ? result.uri : `file://${result.path}`;
      const resolvedPath = result.path ?? result.uri?.replace?.(/^file:\/\//, '') ?? result.uri;

      return {
        uri: resolvedUri,
        path: resolvedPath,
        width: result.width,
        height: result.height,
      };
    }

    // Android: use ImageEditor (works correctly)
    const sourceUri = `file://${path}`;

    const isPortrait = orientation === 'portrait' || orientation === 'portrait-upside-down' || (!orientation && rawW > rawH);
    const imgW = isPortrait ? Math.min(rawW, rawH) : Math.max(rawW, rawH);
    const imgH = isPortrait ? Math.max(rawW, rawH) : Math.min(rawW, rawH);

    const previewAspect = PREVIEW_ASPECT;
    const imgAspect = imgW / imgH;

    let cropX = 0;
    let cropY = 0;
    let cropW = imgW;
    let cropH = imgH;

    if (imgAspect > previewAspect) {
      cropW = Math.round(imgH * previewAspect);
      cropX = Math.round((imgW - cropW) / 2);
    } else {
      cropH = Math.round(imgW / previewAspect);
      cropY = Math.round((imgH - cropH) / 2);
    }

    cropW = Math.min(cropW, imgW - cropX);
    cropH = Math.min(cropH, imgH - cropY);

    const cropData = {
      offset: {x: cropX, y: cropY},
      size: {width: cropW, height: cropH},
      quality: 1,
    };

    const croppedUri = await ImageEditor.cropImage(sourceUri, cropData);

    const resolvedUri = typeof croppedUri === 'string' ? croppedUri : croppedUri?.uri;
    const resolvedPath = resolvedUri?.startsWith('file://') ? resolvedUri.replace('file://', '') : resolvedUri;

    return {
      uri: resolvedUri,
      path: resolvedPath,
      width: cropW,
      height: cropH,
    };
  } catch (error) {
    console.log('autoCropToPreview failed:', error);
    return {
      ...photo,
      uri: Platform.OS === 'android' ? `file://${photo.path}` : photo.path,
    };
  }
};

export default autoCropToPreview;
