import { deviceWithDetailedPreview } from '../src/Utils/cameraFormat';

const format = (videoWidth, videoHeight, photoWidth, photoHeight, minFps = 1, maxFps = 30) => ({
  videoWidth, videoHeight, photoWidth, photoHeight, minFps, maxFps,
});

it('excludes tiny live streams even when they support higher-resolution photos', () => {
  const tiny = format(192, 144, 8064, 6048);
  const fullHd = format(1920, 1080, 4032, 3024);
  const fourK = format(3840, 2160, 4032, 3024);
  const device = { id: 'back', formats: [tiny, fullHd, fourK] };
  expect(deviceWithDetailedPreview(device).formats).toEqual([fullHd, fourK]);
  expect(device.formats).toEqual([tiny, fullHd, fourK]);
});

it('retains full-resolution still formats when they also have a detailed preview', () => {
  const highResolution = format(3840, 2160, 8064, 6048);
  expect(deviceWithDetailedPreview({ formats: [highResolution] }).formats).toEqual([highResolution]);
});

it('excludes formats that cannot run at the configured frame rate', () => {
  const slow = format(7680, 4320, 8064, 6048, 1, 15);
  const fast = format(1920, 1080, 4032, 3024);
  expect(deviceWithDetailedPreview({ formats: [slow, fast] }).formats).toEqual([fast]);
});

it('falls back to the largest available preview on older cameras', () => {
  const tiny = format(192, 144, 4032, 3024);
  const hd = format(1280, 720, 2592, 1944);
  expect(deviceWithDetailedPreview({ formats: [tiny, hd] }).formats).toEqual([hd]);
});

it('handles unavailable cameras and empty format lists', () => {
  expect(deviceWithDetailedPreview(undefined)).toBeUndefined();
  const device = { formats: [] };
  expect(deviceWithDetailedPreview(device)).toBe(device);
});
