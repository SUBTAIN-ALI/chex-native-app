import {useEffect, useRef, useState} from 'react';
import {runAtTargetFps, useFrameProcessor} from 'react-native-vision-camera';
import type {TensorflowPlugin} from 'react-native-fast-tflite';
import {useResizePlugin} from 'vision-camera-resize-plugin';
import {useRunOnJS} from 'react-native-worklets-core';
import {bottleTarget, Detection, mapCover, Result, searching, Target, validate} from './alignment';
import {decode, isSupportedClass, uprightGeometry} from './detector';

export const MAX_RESULT_AGE_MS = 1000;
export function useObjectDetection(plugin: TensorflowPlugin, width: number, height: number, target: Target = bottleTarget) {
  const model = plugin.state === 'loaded' ? plugin.model : undefined;
  const {resize} = useResizePlugin();
  const [result, setResult] = useState<Result>(searching);
  const [error, setError] = useState('');
  const latest = useRef({result: searching, timestamp: 0});
  const alive = useRef(true);
  const currentTarget = useRef(target);
  currentTarget.current = target;
  useEffect(() => {
    latest.current = {result: searching, timestamp: 0};
    setResult(searching);
  }, [target]);
  useEffect(() => {
    alive.current = true;
    const timer = setInterval(() => {
      if (latest.current.timestamp && Date.now() - latest.current.timestamp > MAX_RESULT_AGE_MS) {
        latest.current = {result: searching, timestamp: 0};
        setResult(searching);
      }
    }, 200);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, []);
  const receive = useRunOnJS(
    (detections: Detection[], sourceWidth: number, sourceHeight: number, timestamp: number, failure: string) => {
      if (!alive.current || currentTarget.current !== target || Date.now() - timestamp > MAX_RESULT_AGE_MS) {
        return;
      }
      if (failure) {
        latest.current = {result: searching, timestamp: 0};
        setResult(searching);
        setError(failure);
        return;
      }
      // Explicitly copy properties rather than using spread — spread on objects crossing the
      // worklet→JS thread boundary via useRunOnJS drops string properties on Android/Hermes.
      const mapped = detections.map(d => ({objectClass: d.objectClass, confidence: d.confidence, box: mapCover(d.box, sourceWidth, sourceHeight, width, height)}));
      const previous = timestamp - latest.current.timestamp > MAX_RESULT_AGE_MS ? searching : latest.current.result;
      const next = validate(mapped, target, previous);
      latest.current = {result: next, timestamp};
      setResult(current => (current.state === next.state && current.message === next.message ? current : next));
    },
    [width, height, target]
  );
  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';
      if (!model || width <= 0 || height <= 0) {
        return;
      }
      runAtTargetFps(7, () => {
        'worklet';
        const timestamp = Date.now();
        try {
          // Frame.orientation describes rotation away from output orientation.
          // Resize uses clockwise rotation, so counter-rotate the buffer.
          const geometry = uprightGeometry(frame.width, frame.height, frame.orientation);
          const input = resize(frame, {
            crop: {x: 0, y: 0, width: frame.width, height: frame.height},
            scale: {width: 320, height: 320},
            rotation: geometry.rotation,
            pixelFormat: 'rgb',
            dataType: 'uint8',
          });
          const outputs = model.runSync([input]);
          const detections = decode(outputs as ArrayLike<number>[]);
          receive(detections, geometry.width, geometry.height, timestamp, '');
        } catch (e) {
          receive([], 1, 1, timestamp, String(e) || 'Object detection failed. Close the camera and try again.');
        }
      });
    },
    [model, resize, receive, width, height]
  );
  const acceptedClasses = target.acceptedClasses ?? [target.objectClass];
  const contractValid =
    acceptedClasses.every(isSupportedClass) &&
    (!model ||
      (model.inputs.length === 1 &&
        model.inputs[0].dataType === 'uint8' &&
        model.inputs[0].shape.join(',') === '1,320,320,3' &&
        model.outputs.length === 4 &&
        model.outputs.every(t => t.dataType === 'float32')));
  return {
    frameProcessor: contractValid && !error ? frameProcessor : undefined,
    result,
    latest,
    ready: plugin.state === 'loaded' && contractValid && !error,
    error:
      error ||
      (!acceptedClasses.every(isSupportedClass)
        ? `Unsupported object class: ${acceptedClasses.find(c => !isSupportedClass(c))}`
        : !contractValid
        ? 'Unsupported model tensors.'
        : plugin.state === 'error'
        ? 'Unable to load the object detector.'
        : ''),
  };
}
