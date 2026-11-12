export type Box = {x: number; y: number; width: number; height: number};
export type Detection = {objectClass: string; confidence: number; box: Box};
export type Target = {
  objectClass: string;
  // Additional COCO class names this model may predict for the same physical object.
  // e.g. a thermos/flask is often predicted as 'cup' instead of 'bottle'.
  acceptedClasses?: string[];
  frame: Box;
  minConfidence: number;
  minIoU: number;
  maxCenterOffset: number;
  minSize: number;
  maxSize: number;
  requiredStableDetections: number;
};
export type State = 'SEARCHING' | 'WRONG_OBJECT' | 'LOW_CONFIDENCE' | 'MISALIGNED' | 'ALIGNING' | 'ALIGNED';
export type Result = {state: State; message: string; count: number; box?: Box};
export const bottleTarget: Target = {
  objectClass: 'cell phone',
  frame: {x: 0.20, y: 0.15, width: 0.59, height: 0.70},
  minConfidence: 0.35,
  minIoU: 0.65,
  maxCenterOffset: 0.08,
  minSize: 0.8,
  maxSize: 1.2,
  requiredStableDetections: 4,
};
export const personTarget: Target = {
  objectClass: 'person',
  frame: {x: 0.25, y: 0.05, width: 0.50, height: 0.90},
  minConfidence: 0.40,
  minIoU: 0.60,
  maxCenterOffset: 0.10,
  minSize: 0.70,
  maxSize: 1.30,
  requiredStableDetections: 4,
};
export const carTarget: Target = {
  objectClass: 'car',
  frame: {x: 0.05, y: 0.20, width: 0.90, height: 0.55},
  minConfidence: 0.40,
  minIoU: 0.60,
  maxCenterOffset: 0.10,
  minSize: 0.70,
  maxSize: 1.30,
  requiredStableDetections: 4,
};
export const motorcycleTarget: Target = {
  objectClass: 'motorcycle',
  frame: {x: 0.08, y: 0.20, width: 0.84, height: 0.60},
  minConfidence: 0.35,
  minIoU: 0.60,
  maxCenterOffset: 0.10,
  minSize: 0.70,
  maxSize: 1.30,
  requiredStableDetections: 4,
};
export const chairTarget: Target = {
  objectClass: 'chair',
  frame: {x: 0.15, y: 0.15, width: 0.70, height: 0.65},
  minConfidence: 0.35,
  minIoU: 0.60,
  maxCenterOffset: 0.10,
  minSize: 0.70,
  maxSize: 1.30,
  requiredStableDetections: 4,
};
export const detectionOptions: {key: string; label: string; target: Target}[] = [
  {key: 'cell phone', label: 'Phone', target: bottleTarget},
  {key: 'person', label: 'Person', target: personTarget},
  {key: 'car', label: 'Car', target: carTarget},
  {key: 'motorcycle', label: 'Motorcycle', target: motorcycleTarget},
  {key: 'chair', label: 'Chair', target: chairTarget},
];
export const searching: Result = {state: 'SEARCHING', message: 'Place the object inside the frame.', count: 0};
export function iou(a: Box, b: Box): number {
  const area =
    Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return area / (a.width * a.height + b.width * b.height - area || 1);
}
export function validate(detections: Detection[], target: Target, previous: Result = searching): Result {
  const result = (state: State, message: string): Result => ({state, message, count: 0});
  const accepted = target.acceptedClasses ?? [target.objectClass];
  const candidates = detections.filter(
    d =>
      accepted.includes(d.objectClass) &&
      Number.isFinite(d.confidence) &&
      Object.values(d.box).every(Number.isFinite) &&
      d.box.width > 0 &&
      d.box.height > 0
  );
  const d = candidates.sort((a, b) => iou(b.box, target.frame) - iou(a.box, target.frame))[0];
  if (!d) {
    return result(detections.length ? 'WRONG_OBJECT' : 'SEARCHING', `Place the ${target.objectClass} inside the frame.`);
  }
  if (d.confidence < target.minConfidence) {
    return result('LOW_CONFIDENCE', 'Improve the lighting and keep the object visible.');
  }
  const b = d.box;
  const f = target.frame;
  const dx = b.x + b.width / 2 - f.x - f.width / 2;
  const dy = b.y + b.height / 2 - f.y - f.height / 2;
  if (Math.hypot(dx, dy) > target.maxCenterOffset) {
    return result(
      'MISALIGNED',
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? 'Move the object left.'
          : 'Move the object right.'
        : dy > 0
        ? 'Move the object up.'
        : 'Move the object down.'
    );
  }
  if (b.width / f.width < target.minSize || b.height / f.height < target.minSize) {
    return result('MISALIGNED', 'Move closer.');
  }
  if (b.width / f.width > target.maxSize || b.height / f.height > target.maxSize) {
    return result('MISALIGNED', 'Move farther away.');
  }
  if (iou(b, f) < target.minIoU) {
    return result('MISALIGNED', 'Fit the object inside the frame.');
  }
  const count = Math.min(target.requiredStableDetections, (previous.box && iou(previous.box, b) > 0.5 ? previous.count : 0) + 1);
  return {
    state: count >= target.requiredStableDetections ? 'ALIGNED' : 'ALIGNING',
    message: count >= target.requiredStableDetections ? 'Object aligned. Ready to capture.' : 'Hold steady.',
    count,
    box: b,
  };
}
// The model sees the full buffer, rotated upright, stretched to a square.
// Its normalized output therefore maps directly to the upright source dimensions.
export function mapCover(box: Box, width: number, height: number, viewWidth: number, viewHeight: number, mirrored = false): Box {
  const scale = Math.max(viewWidth / width, viewHeight / height);
  return {
    x: ((mirrored ? 1 - box.x - box.width : box.x) * width * scale - (width * scale - viewWidth) / 2) / viewWidth,
    y: (box.y * height * scale - (height * scale - viewHeight) / 2) / viewHeight,
    width: (box.width * width * scale) / viewWidth,
    height: (box.height * height * scale) / viewHeight,
  };
}
