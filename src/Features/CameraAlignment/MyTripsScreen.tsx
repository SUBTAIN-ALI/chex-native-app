import React, {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, AppState, BackHandler, Image, Linking, Pressable, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useIsFocused} from '@react-navigation/native';
import {Camera, useCameraDevice, useCameraFormat, useCameraPermission} from 'react-native-vision-camera';
import {useTensorflowModel, type TensorflowPlugin} from 'react-native-fast-tflite';
import {bottleTarget} from './alignment';
import {MAX_RESULT_AGE_MS, useObjectDetection} from './useObjectDetection';

type ButtonProps = {title: string; onPress: () => void; disabled?: boolean};
function Button({title, onPress, disabled = false}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{disabled}}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && styles.disabled]}>
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}
function LiveCamera({onPhoto, onClose, width, height, plugin}: {onPhoto: (uri: string) => void; onClose: () => void; width: number; height: number; plugin: TensorflowPlugin}) {
  const camera = useRef<Camera>(null);
  const mounted = useRef(true);
  const busy = useRef(false);
  const [capturing, setCapturing] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const device = useCameraDevice('back');
  const format = useCameraFormat(device, [{photoResolution: 'max'}, {videoResolution: {width: 1280, height: 720}}, {fps: 30}]);
  const detection = useObjectDetection(plugin, width, height);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const canCapture = initialized && detection.ready && detection.result.state === 'ALIGNED' && !capturing && !cameraError;
  const capture = async () => {
    if (
      !canCapture ||
      busy.current ||
      detection.latest.current.result.state !== 'ALIGNED' ||
      Date.now() - detection.latest.current.timestamp > MAX_RESULT_AGE_MS ||
      !camera.current
    ) {
      return;
    }
    busy.current = true;
    setCapturing(true);
    try {
      const photo = await camera.current.takePhoto();
      if (mounted.current) {
        onPhoto(`file://${photo.path}`);
      }
    } catch (_) {
      if (mounted.current) {
        setCameraError('Photo capture failed. Reopen the camera to retry.');
      }
    } finally {
      busy.current = false;
      if (mounted.current) {
        setCapturing(false);
      }
    }
  };
  const frame = bottleTarget.frame;
  const green = canCapture;
  return (
    <View style={styles.fill}>
      {device && (
        <Camera
          ref={camera}
          style={StyleSheet.absoluteFill}
          device={device}
          format={format}
          fps={30}
          photo
          photoQualityBalance="quality"
          isActive={!cameraError}
          resizeMode="cover"
          isMirrored={false}
          outputOrientation="preview"
          frameProcessor={detection.frameProcessor}
          onInitialized={() => setInitialized(true)}
          onError={e => setCameraError(e.message)}
        />
      )}
      <View
        pointerEvents="none"
        style={[
          styles.guide,
          green ? styles.alignedGuide : styles.invalidGuide,
          {
            left: frame.x * width,
            top: frame.y * height,
            width: frame.width * width,
            height: frame.height * height,
          },
        ]}
      />
      <View pointerEvents="none" style={styles.message}>
        <Text style={styles.status}>
          {cameraError ||
            detection.error ||
            (!device ? 'No rear camera available.' : !detection.ready ? 'Loading object detector…' : detection.result.message)}
        </Text>
        {!detection.ready && !detection.error && <ActivityIndicator color="white" />}
      </View>
      <View style={styles.controls}>
        <Button title="Close" onPress={onClose} />
        <Button title={capturing ? 'Capturing…' : 'Capture'} disabled={!canCapture} onPress={capture} />
      </View>
    </View>
  );
}
export default function MyTripsScreen() {
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [open, setOpen] = useState(false);
  const [uri, setUri] = useState('');
  const [permissionMessage, setPermissionMessage] = useState('');
  const [size, setSize] = useState({width: 0, height: 0});
  const {hasPermission, requestPermission} = useCameraPermission();
  const plugin = useTensorflowModel(require('../../Assets/Models/efficientdet_lite0.tflite'));
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (!focused) {
      return;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!open && !uri) {
        return false;
      }
      setUri('');
      setOpen(false);
      return true;
    });
    return () => subscription.remove();
  }, [focused, open, uri]);
  const launch = async () => {
    if (hasPermission || (await requestPermission())) {
      setUri('');
      setOpen(true);
      setPermissionMessage('');
    } else {
      setPermissionMessage('Camera permission is required. Enable it in Settings.');
    }
  };
  return (
    <SafeAreaView style={styles.page}>
      {uri ? (
        <View style={styles.fill}>
          <Image source={{uri}} resizeMode="contain" style={styles.fill} />
          <View style={styles.controls}>
            <Button title="Retake" onPress={launch} />
            <Button
              title="Done"
              onPress={() => {
                setUri('');
                setOpen(false);
              }}
            />
          </View>
        </View>
      ) : open ? (
        <View style={styles.fill} onLayout={e => setSize(e.nativeEvent.layout)}>
          {focused && active && size.width > 0 && (
            <LiveCamera
              key={`${size.width}:${size.height}`}
              {...size}
              plugin={plugin}
              onPhoto={photo => {
                setUri(photo);
                setOpen(false);
              }}
              onClose={() => setOpen(false)}
            />
          )}
        </View>
      ) : (
        <View style={styles.home}>
          <Text style={styles.title}>My Trip</Text>
          <Text style={styles.description}>Phone alignment demo</Text>
          <Text style={styles.description}>Fit a phone inside the guide and hold steady. Capture becomes available when the frame turns green.</Text>
          <Button title="Open alignment camera" onPress={launch} />
          {!!permissionMessage && (
            <>
              <Text style={styles.description}>{permissionMessage}</Text>
              <Button title="Open Settings" onPress={() => Linking.openSettings()} />
            </>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  page: {flex: 1, backgroundColor: '#101820'},
  fill: {flex: 1},
  home: {flex: 1, justifyContent: 'center', padding: 24},
  title: {fontSize: 28, color: 'white', marginBottom: 20},
  description: {fontSize: 16, color: '#ddd', marginBottom: 20},
  button: {backgroundColor: '#006fa6', borderRadius: 12, padding: 16, margin: 6},
  buttonText: {color: 'white', fontSize: 16, textAlign: 'center'},
  disabled: {opacity: 0.4},
  alignedGuide: {borderColor: '#28d76f'},
  invalidGuide: {borderColor: '#ff4545'},
  guide: {position: 'absolute', borderWidth: 3, borderRadius: 12},
  message: {position: 'absolute', top: 8, left: 12, right: 12, padding: 12, backgroundColor: '#000a', borderRadius: 10},
  status: {color: 'white', textAlign: 'center', fontSize: 16},
  controls: {position: 'absolute', bottom: 12, left: 8, right: 8, flexDirection: 'row', justifyContent: 'space-around'},
});
