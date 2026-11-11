import {bottleTarget as target, Detection, iou, mapCover, searching, validate} from '../alignment';
import {decode, uprightGeometry, isSupportedClass} from '../detector';
const bottle: Detection = {objectClass: 'cell phone', confidence: 0.9, box: target.frame};
const centered = (scale: number) => ({
  ...bottle,
  box: {
    x: target.frame.x + (target.frame.width * (1 - scale)) / 2,
    y: target.frame.y + (target.frame.height * (1 - scale)) / 2,
    width: target.frame.width * scale,
    height: target.frame.height * scale,
  },
});
test('missing, wrong class and low confidence', () => {
  expect(validate([], target).state).toBe('SEARCHING');
  expect(validate([{...bottle, objectClass: 'car'}], target).state).toBe('WRONG_OBJECT');
  // minConfidence is 0.35; use 0.30 (above 0.25 decode floor, below alignment threshold)
  expect(validate([{...bottle, confidence: 0.30}], target).state).toBe('LOW_CONFIDENCE');
});
test.each([
  ['small', 0.5, 'Move closer.'],
  ['large', 1.5, 'Move farther away.'],
])('%s object', (_, scale, message) => {
  expect(validate([centered(Number(scale))], target).message).toBe(message);
});
test.each([
  ['x', 0.4, 'left'],
  ['x', 0, 'right'],
  ['y', 0.4, 'up'],
  ['y', 0, 'down'],
])('offset %s %s', (axis, value, direction) => {
  expect(validate([{...bottle, box: {...bottle.box, [axis]: value}}], target).message).toContain(direction);
});
test('outside target and insufficient overlap', () => {
  expect(validate([{...bottle, box: {...bottle.box, x: 1}}], target).state).toBe('MISALIGNED');
  // scale=0.80 passes minSize but IoU = 0.80² = 0.64 < minIoU (0.65) → MISALIGNED
  // scale=0.85 now passes (IoU 0.72 > 0.65) with the relaxed threshold
  expect(validate([centered(0.80)], target).state).toBe('MISALIGNED');
});
test('four consecutive valid detections, reset immediately on loss', () => {
  let result = searching;
  for (let i = 1; i <= 4; i++) {
    result = validate([bottle], target, result);
    expect(result.count).toBe(i);
    expect(result.state).toBe(i === 4 ? 'ALIGNED' : 'ALIGNING');
  }
  result = validate([], target, result);
  expect(result.state).toBe('SEARCHING');
  expect(validate([bottle], target, result).count).toBe(1);
});
test('IoU handles identical and disjoint boxes', () => {
  expect(iou(bottle.box, bottle.box)).toBeCloseTo(1);
  expect(iou(bottle.box, {...bottle.box, x: 2})).toBe(0);
});
test('portrait cover crop preserves center and scales width', () => {
  const box = mapCover({x: 0.25, y: 0.25, width: 0.5, height: 0.5}, 1080, 1920, 300, 600);
  expect(box.x + box.width / 2).toBeCloseTo(0.5);
  expect(box.width).toBeCloseTo(0.5625);
  expect(box.y).toBeCloseTo(0.25);
});
test('landscape cover crop and mirroring', () => {
  const box = {x: 0.1, y: 0.2, width: 0.2, height: 0.3};
  expect(mapCover(box, 1920, 1080, 640, 360)).toEqual(box);
  expect(mapCover(box, 1920, 1080, 640, 360, true).x).toBeCloseTo(0.7);
});
test('decoder follows actual postprocess ordering and bottle label index', () => {
  const result = decode([new Float32Array([0.1, 0.2, 0.8, 0.6]), new Float32Array([43]), new Float32Array([0.8]), new Float32Array([1])]);
  expect(result[0].objectClass).toBe('bottle');
  expect(result[0].box.width).toBeCloseTo(0.4);
  expect(result[0].box.height).toBeCloseTo(0.7);
  expect(() => decode([])).toThrow();
});

test.each([
  ['portrait', '0deg', 1920, 1080],
  ['landscape-left', '270deg', 1080, 1920],
  ['landscape-right', '90deg', 1080, 1920],
  ['portrait-upside-down', '180deg', 1920, 1080],
])('buffer orientation %s', (orientation, rotation, width, height) => {
  expect(uprightGeometry(1920, 1080, String(orientation))).toEqual({rotation, width, height});
});
test('unsupported target classes are explicit', () => {
  expect(isSupportedClass('phone charger')).toBe(false);
  for (const label of ['bottle', 'cup', 'cell phone', 'car']) {
    expect(isSupportedClass(label)).toBe(true);
  }
});
