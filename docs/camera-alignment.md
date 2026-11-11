# My Trip camera alignment demo

Open **My Trip → Open alignment camera**. Grant camera permission, fit a bottle inside the red rectangle, and hold steady. Four consecutive valid detections enable manual Capture and turn the guide green. Capture opens a local original-photo preview with Retake and Done. Android Back closes the camera/preview. Inspection capture, cropping, Redux, uploads, and return navigation are untouched. There is no gallery import or automatic capture.

## Dependencies and configuration

Exact additions:
- react-native-fast-tflite 1.6.1 (CPU TFLite runtime)
- vision-camera-resize-plugin 3.2.0 (native RGB conversion, resize and rotation)
- react-native-worklets-core 1.6.2 (VisionCamera worklet runtime)
- Dev: @babel/plugin-proposal-optional-chaining 7.21.0 and @babel/plugin-proposal-nullish-coalescing-operator 7.18.6. Worklets Core's Babel compiler explicitly requires these older plugin names; they were absent in this app.

Existing RN 0.78.0, React 19.0.0, VisionCamera 4.7.3 (lockfile resolution), Reanimated 4.0.2 and Worklets 0.4.2 remain unchanged. Resize 3.2.0 declares VisionCamera >=4.0.1 and Worklets Core >=1.2.0. These are minimum versions, not conflicting requirements. Worklets Core and Software Mansion Worklets are different runtimes; both stay installed.

Babel scopes the Core transform to the camera feature and camera libraries, and the existing Worklets transform to other files. Do not use Reanimated worklets in this feature directory without adjusting that boundary. Metro retains default assets and adds tflite. Native packages autolink; Android already enables New Architecture and Hermes. CocoaPods confirms frame processors are enabled and installs TensorFlowLiteC 2.17.0. No Gradle or Podfile changes are needed. Podfile.lock is ignored by this repository.

## Bundled model

EfficientDet-Lite0, quantized detection variant with integrated TFLite_Detection_PostProcess:
https://storage.googleapis.com/download.tensorflow.org/models/tflite/task_library/object_detection/android/lite-model_efficientdet_lite0_detection_metadata_1.tflite

File: src/Assets/Models/efficientdet_lite0.tflite
Size: 4,563,519 bytes
SHA-256: 2e04c53bfeac0ac2a30c057c7e2a777594ce39baaac35a92f74fb1e8c4fc4e0b

The originally proposed MediaPipe float32 artifact was inspected and has raw outputs [1,19206,90] and [1,19206,4]. It was replaced explicitly with this postprocessed variant, rather than interpreting those raw tensors as final detections.

Input: serving_default_images:0, uint8 RGB [1,320,320,3]. Pass raw RGB bytes (0–255), not floats divided by 255. Quantization scale is 1/128, zero point 127.

The graph's TFLite_Detection_PostProcess outputs [598,599,600,601] are also the subgraph outputs in that order:
1. StatefulPartitionedCall:3 — float32 boxes [1,N,4], ymin,xmin,ymax,xmax, normalized.
2. StatefulPartitionedCall:2 — float32 zero-based class IDs [1,N].
3. StatefulPartitionedCall:1 — float32 scores [1,N].
4. StatefulPartitionedCall:0 — float32 detection count [1].

Output dimensions are allocated by the postprocess operator at runtime. Decoding uses the count and actual array lengths. The bundled labels.json was extracted from the model's labelmap.txt: 90 COCO slots including unused ??? slots, with bottle=43, cup=46, cell phone=76 and car=2. Unused/unknown labels are ignored. Unsupported configured classes are rejected. Task Library is not required because the model graph contains the postprocessor.

## Inference and mapping

useFrameProcessor → runAtTargetFps(7) → native RGB resize → model.runSync → compact detections transferred via Worklets Core to JS. Resize and synchronous inference stay in the same frame-processor runtime. The extra runAsync runtime boundary was removed after an input-buffer native crash on both Android emulator and phone. Full frames never enter React state or the main JS thread. CPU inference speed must be measured on real devices; 7 Hz is a throttle, not a guaranteed rate. Slow inference can delay frame-processor callbacks; async offloading needs a separately validated buffer/runtime integration before reintroduction.

Explicit full-buffer crop avoids the resize plugin's default square center crop. The buffer is resized to 320×320 and counter-rotated using frame.orientation. Normalized model boxes map into the upright source dimensions, then into the measured preview using cover scaling and centered cropping. The overlay and validator use normalized coordinates in that same preview. The demo uses only the rear camera with mirroring disabled. The mapper tests mirroring, but front-camera inference is not exposed or device-validated.

Inference/camera unmount on tab blur, app background, close, photo preview, or preview size changes. Late callbacks are ignored; a fresh session must qualify again. Frames are consumed synchronously during their frame-processor callback. A 1-second freshness limit gates capture; a timer also clears stale visual alignment.

## Alignment settings and future custom guides

Edit bottleTarget in alignment.ts. Confidence is 0.60; this is NOT a measured 60% accuracy claim. Initial IoU is 0.75, maximum center distance 0.08 in normalized preview units, width/height ratios 0.8–1.2 relative to the guide, and four consecutive valid detections. Consecutive boxes must overlap to avoid accumulating stability across different bottles. Detection loss invalidates capture immediately. Entry stability prevents a single positive frame turning green.

The target class and rectangle are configurable, and the hook accepts a target. The UI currently exposes bottle only. Confidence, geometry, and model output decoding are separate concerns. Custom vehicle silhouettes can later share the overlay surface, but this implementation validates bounding boxes only. Silhouette fit, vehicle pose/angle, and body-part checks require segmentation/keypoints or a custom model; a green rectangle does not prove those properties.

## Files

Modified: package.json, yarn.lock, babel.config.js, metro.config.js, src/Navigation/stacks.js.
Added: src/Assets/Models/{efficientdet_lite0.tflite,labels.json}; src/Features/CameraAlignment/{MyTripsScreen.tsx,useObjectDetection.ts,alignment.ts,detector.ts,__tests__/alignment.test.ts}; this document.

## Run and verify

1. `yarn install --frozen-lockfile`
2. `cd ios && pod install` (the local Bundler-locked gem versions were unavailable; installed CocoaPods succeeded).
3. `yarn start --reset-cache`
4. Rebuild using `yarn android` or `yarn ios`. Fast Refresh alone cannot add native modules.
5. On a real device, test bottle missing, wrong object, low light, offset, too small/large, hold steady, capture, retake, back, tab switching, background/resume, and rotation. Verify existing inspection capture/upload separately.
6. `yarn test src/Features/CameraAlignment --runInBand`; `yarn test --runInBand`; `yarn tsc --noEmit`; `yarn lint`.

Photo files use VisionCamera's temporary storage and are not uploaded, cropped, or composited with the guide. Preview confirmation does not add them to a trip record. Device rotation and physical-camera correspondence still require device testing; synthetic coordinate tests cannot establish optical accuracy.
