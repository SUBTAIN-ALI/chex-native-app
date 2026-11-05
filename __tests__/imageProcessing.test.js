import { Image } from 'react-native';
import imageResizer from '@bam.tech/react-native-image-resizer';
import ImageEditor from '@react-native-community/image-editor';
import { fixImageOrientation } from '../src/Utils/imageProcessing';
import autoCropToPreview from '../src/Components/ItemPicker/AutoResizeAndCrop';

jest.mock('react-native', () => ({ Image: { getSize: jest.fn() }, Platform: { OS: 'android' } }));
jest.mock('@bam.tech/react-native-image-resizer', () => ({ createResizedImage: jest.fn() }));
jest.mock('@react-native-community/image-editor', () => ({ cropImage: jest.fn() }));
jest.mock('react-native-responsive-screen', () => ({
  heightPercentageToDP: () => 200,
  widthPercentageToDP: () => 400,
}));

beforeEach(() => {
  jest.resetAllMocks();
});

it.each([[4032, 3024], [3024, 4032], [8064, 6048], [640, 480]])(
  'normalizes orientation without a resolution cap for %i × %i photos',
  async (width, height) => {
    Image.getSize.mockImplementation((uri, onSuccess) => onSuccess(width, height));
    imageResizer.createResizedImage.mockResolvedValue({ uri: 'file:///normalized.jpg' });

    await expect(fixImageOrientation('/original.jpg')).resolves.toBe('file:///normalized.jpg');
    expect(Image.getSize).toHaveBeenCalledWith('file:///original.jpg', expect.any(Function), expect.any(Function));
    const maxDimension = Math.max(width, height);
    expect(imageResizer.createResizedImage).toHaveBeenCalledWith(
      'file:///original.jpg', maxDimension, maxDimension, 'JPEG', 100,
      0, undefined, false, { mode: 'contain', onlyScaleDown: true }
    );
  }
);

it('keeps the original file available when dimension lookup fails', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  Image.getSize.mockImplementation((uri, onSuccess, onError) => onError(new Error('Cannot read image')));
  await expect(fixImageOrientation('/original.jpg')).resolves.toBe('/original.jpg');
  expect(imageResizer.createResizedImage).not.toHaveBeenCalled();
  warn.mockRestore();
});

it('keeps the original file available when orientation normalization fails', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  Image.getSize.mockImplementation((uri, onSuccess) => onSuccess(4032, 3024));
  imageResizer.createResizedImage.mockRejectedValue(new Error('Cannot normalize image'));
  await expect(fixImageOrientation('file:///original.jpg')).resolves.toBe('file:///original.jpg');
  warn.mockRestore();
});

it('preserves Android preview framing while using maximum JPEG quality', async () => {
  ImageEditor.cropImage.mockResolvedValue({ uri: 'file:///cropped.jpg' });
  const result = await autoCropToPreview({ path: '/original.jpg', width: 4032, height: 3024, orientation: 'portrait' });
  expect(ImageEditor.cropImage).toHaveBeenCalledWith('file:///original.jpg', {
    offset: { x: 0, y: 1260 },
    size: { width: 3024, height: 1512 },
    quality: 1,
  });
  expect(result).toEqual({ uri: 'file:///cropped.jpg', path: '/cropped.jpg', width: 3024, height: 1512 });
});
