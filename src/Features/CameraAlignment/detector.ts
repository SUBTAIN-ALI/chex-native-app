import labels from '../../Assets/Models/labels.json';
import type {Detection} from './alignment';
// Verified graph: TFLite_Detection_PostProcess outputs are exposed in native order:
// boxes [ymin,xmin,ymax,xmax], zero-based classes, scores, count.
export function decode(outputs: ArrayLike<number>[]): Detection[] {
  'worklet';
  if (outputs.length !== 4) {
    throw new Error('Unexpected detector output count');
  }
  const boxes = outputs[0];
  const classes = outputs[1];
  const scores = outputs[2];
  const count = outputs[3];
  const n = Math.min(Number(count[0]), classes.length, scores.length, boxes.length / 4);
  if (!Number.isFinite(n)) {
    throw new Error('Invalid detector output');
  }
  const detections: Detection[] = [];
  for (let i = 0; i < n; i++) {
    const confidence = Number(scores[i]);
    const objectClass = labels[Number(classes[i])];
    if (confidence < 0.25 || !objectClass || objectClass === '???') {
      continue;
    }
    detections.push({
      objectClass,
      confidence,
      box: {
        x: Number(boxes[i * 4 + 1]),
        y: Number(boxes[i * 4]),
        width: Number(boxes[i * 4 + 3]) - Number(boxes[i * 4 + 1]),
        height: Number(boxes[i * 4 + 2]) - Number(boxes[i * 4]),
      },
    });
  }
  return detections;
}

export function uprightGeometry(width: number, height: number, orientation: string) {
  'worklet';
  const rotation =
    orientation === 'landscape-left'
      ? '270deg'
      : orientation === 'landscape-right'
      ? '90deg'
      : orientation === 'portrait-upside-down'
      ? '180deg'
      : '0deg';
  const sideways = rotation === '90deg' || rotation === '270deg';
  return {rotation, width: sideways ? height : width, height: sideways ? width : height} as const;
}
export function isSupportedClass(objectClass: string): boolean {
  return objectClass !== '???' && labels.includes(objectClass);
}
