import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, ScrollView, StatusBar, TouchableOpacity, View, Text } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { CardWrapper, LogoHeader, PrimaryGradientButton } from '../../../Components';
import AppText from '../../../Components/text';
import { ROUTES } from '../../../Navigation/ROUTES';
import { updateFuelEvent } from '../../../Store/Actions';
import { fixImageOrientation, getSignedUrl } from '../../../Utils';
import { styles } from './styles';
import { MAX_UPLOAD_RETRIES, S3_BUCKET_BASEURL } from '../../../Constants';

const PreFuelGaugeScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  const progressPips = [0, 1, 2, 3, 4, 5];
  const cameraRef = useRef(null);
  const device = useCameraDevice('back');
  const dispatch = useDispatch();

  const {
    user: { token, data },
  } = useSelector(state => state.auth);
  const { selectedInspectionID, variant } = useSelector(state => state.newInspection);
  const fuelEvent = useSelector(state => state.fuel?.fuelEvent);

  const [hasPermission, setHasPermission] = useState(false);
  const [capturedImageUri, setCapturedImageUri] = useState('');
  const [capturedS3Key, setCapturedS3Key] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [isWaitingForConnection, setIsWaitingForConnection] = useState(false);
  const isUploadCancelled = useRef(false);
  const [showResult, setShowResult] = useState(false);

  const uploadOptions = {
    onRetry: attempt => setRetryAttempt(attempt),
    onWaitingForConnection: isWaiting => setIsWaitingForConnection(isWaiting),
    isCancelled: () => isUploadCancelled.current,
  };

  useEffect(() => () => { isUploadCancelled.current = true; }, []);

  useEffect(() => {
    const initPermission = async () => {
      const permission = await Camera.getCameraPermissionStatus();
      if (permission === 'granted') {
        setHasPermission(true);
        return;
      }
      const requested = await Camera.requestCameraPermission();
      if (requested === 'granted') {
        setHasPermission(true);
        return;
      }
      Alert.alert(t('fuelVerification.cameraPermissionRequiredTitle'), t('fuelVerification.cameraPermissionCaptureFuelGauge'));
    };
    initPermission();
  }, [t]);

  const handleUploadError = () => {
    setIsUploading(false);
    setProgress(0);
    setRetryAttempt(0);
    setIsWaitingForConnection(false);
    if (isUploadCancelled.current) {
      return;
    }
    Alert.alert(t('fuelVerification.uploadFailedTitle'), t('fuelVerification.uploadFailedFuelGauge'));
  };

  const handleResponse = async (key) => {
    setCapturedS3Key(key);
    const imageUrl = `${S3_BUCKET_BASEURL}${key}`;
    const body = {
      preGaugeImageUrl: imageUrl,
      currentStep: 4,
    };
    try {
      const response = await dispatch(updateFuelEvent(fuelEvent?.id, body));
      console.log('pre fuel gauge ai response /////', response);
      if (response?.status === 200) {
        setShowResult(true);
        setIsUploading(false);
      } else {
        console.log('pre fuel gauge ai response /////', response?.message);
        setIsUploading(false);
        Alert.alert(t('fuelVerification.uploadFailedTitle'), t('fuelVerification.uploadFailedPreFuelGauge'));
      }
    } catch (error) {
      setIsUploading(false);
      console.log('error', error);
    }
  };

  const handleCapture = async () => {
    if (capturedImageUri) {
      setCapturedImageUri('');
      setCapturedS3Key('');
      setShowResult(false);
      setProgress(0);
      return;
    }

    if (!hasPermission) {
      const requested = await Camera.requestCameraPermission();
      if (requested !== 'granted') {
        Alert.alert(t('fuelVerification.cameraPermissionRequiredTitle'), t('fuelVerification.cameraPermissionContinue'));
        return;
      }
      setHasPermission(true);
    }

    if (!cameraRef.current) { return; }

    try {
      const photo = await cameraRef.current.takePhoto({ flash: 'off' });
      const normalizedUri = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;
      setCapturedImageUri(normalizedUri);
      setIsUploading(true);
      isUploadCancelled.current = false;
      setRetryAttempt(0);
      setIsWaitingForConnection(false);

      const extension = photo.path.split('.').pop() || 'jpeg';
      const mime = `image/${extension}`;
      const normalizedPath = Platform.OS === 'ios' ? await fixImageOrientation(photo.path) : photo.path;

      await getSignedUrl(
        token,
        mime,
        normalizedPath,
        setProgress,
        handleResponse,
        handleUploadError,
        dispatch,
        fuelEvent?.event?.id || selectedInspectionID,
        'preFuelGauge',
        variant || 0,
        'app',
        data?.companyId,
        'CarVerification',
        uploadOptions
      );
      setRetryAttempt(0);
      setIsWaitingForConnection(false);
    } catch (error) {
      setIsUploading(false);
      Alert.alert(t('fuelVerification.captureFailedTitle'), t('fuelVerification.captureFailedFuelGauge'));
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <View style={styles.blueHeaderContainer}>
        <LogoHeader />
        <View style={styles.flowHeader}>
          <AppText style={styles.stepText}>{t('fuelVerification.stepPreFuelGauge')}</AppText>
          <AppText style={styles.title}>{t('fuelVerification.preFuelGaugeTitle')}</AppText>
          <AppText style={styles.subtitle}>{t('fuelVerification.preFuelGaugeSubtitle')}</AppText>
          <View style={styles.progressTrack}>
            {progressPips.map(index => (
              <View key={index} style={[styles.progressPip, index < 4 && styles.progressPipDone]} />
            ))}
          </View>
        </View>
      </View>

      <View style={styles.cardWrapper}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>
          <View style={styles.odometerCameraWrap}>
            {!capturedImageUri && hasPermission && device ? (
              <Camera ref={cameraRef} style={styles.odometerCameraPreview} device={device} isActive photo />
            ) : capturedImageUri ? (
              <Image source={{ uri: capturedImageUri }} style={styles.odometerCapturedImage} />
            ) : (
              <View style={styles.odometerPlaceholder}>
                <AppText style={styles.cardDescription}>{t('fuelVerification.cameraUnavailable')}</AppText>
              </View>
            )}
          </View>

          {isUploading ? (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator size="small" color="#1D4ED8" />
              <AppText style={styles.uploadingText}>
                {isWaitingForConnection
                  ? t('fuelVerification.waitingForConnection')
                  : retryAttempt > 0
                    ? t('fuelVerification.retryingUpload', { attempt: retryAttempt, total: MAX_UPLOAD_RETRIES })
                    : t('fuelVerification.uploadingWithProgress', { progress })}
              </AppText>
            </View>
          ) : null}

          {!showResult && !isUploading ? (
            <TouchableOpacity style={styles.ghostButton} onPress={handleCapture} activeOpacity={0.8}>
              <AppText style={styles.ghostButtonText}>{t('fuelVerification.captureFuelGauge')}</AppText>
            </TouchableOpacity>
          ) : null}

          {showResult ? (
            <CardWrapper style={styles.odometerResultCard}>
              <AppText style={styles.modalTitle}>{t('fuelVerification.fuelGaugeReading')}</AppText>
              <View style={styles.odometerResultRow}>
                <AppText style={styles.vehicleMeta}>{t('fuelVerification.preFuelLevel')}</AppText>
                <Text style={styles.vehicleName}>{fuelEvent?.preGaugePct}</Text>
              </View>
              <View style={[styles.odometerResultRow, styles.odometerResultRowLast]}>
                <AppText style={styles.vehicleMeta}>{t('fuelVerification.expectedFillToFull')}</AppText>
                <Text style={styles.vehicleName}>{fuelEvent?.preGaugeRemainingGallons}</Text>
              </View>
            </CardWrapper>
          ) : null}

          <PrimaryGradientButton
            text={t('fuelVerification.gaugeCapturedGoPump')}
            buttonStyle={styles.ctaButton}
            buttonDisabled={!showResult || isUploading}
            onPress={() =>
              navigation.navigate(ROUTES.CAPTURE_RECEIPT, {
                vehicle: route?.params?.vehicle,
                location: route?.params?.location,
                odometerImage: route?.params?.odometerImage,
                odometerMileage: route?.params?.odometerMileage,
                odometerS3Key: route?.params?.odometerS3Key,
                preFuelGaugeImage: capturedImageUri,
                preFuelGaugeS3Key: capturedS3Key,
              })
            }
          />

          {showResult ? (
            <TouchableOpacity style={styles.ghostButton} onPress={handleCapture} activeOpacity={0.8}>
              <AppText style={styles.ghostButtonText}>{t('fuelVerification.retakePhoto')}</AppText>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
};

export default PreFuelGaugeScreen;
