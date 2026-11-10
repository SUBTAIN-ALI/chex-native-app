// Photo-first selection can otherwise choose a high-resolution still format
// with a tiny live stream. Keep photo quality high within usable preview formats.
export function deviceWithDetailedPreview(device) {
  if (!device?.formats?.length) { return device; }

  const supports30Fps = device.formats.filter(format => format.minFps <= 30 && format.maxFps >= 30);
  if (!supports30Fps.length) { return device; }

  const detailedFormats = supports30Fps.filter(format =>
    Math.min(format.videoWidth, format.videoHeight) >= 1080 &&
    Math.max(format.videoWidth, format.videoHeight) >= 1920
  );
  if (detailedFormats.length) { return { ...device, formats: detailedFormats }; }

  // Older devices: use their best available preview rather than a photo-first
  // fallback that could select a much smaller stream.
  const largestPreview = Math.max(...supports30Fps.map(format => format.videoWidth * format.videoHeight));
  return {
    ...device,
    formats: supports30Fps.filter(format => format.videoWidth * format.videoHeight === largestPreview),
  };
}
