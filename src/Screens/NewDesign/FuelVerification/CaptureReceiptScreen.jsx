import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, ScrollView, StatusBar, TouchableOpacity, View } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { CardWrapper, LogoHeader, PrimaryGradientButton } from '../../../Components';
import AppText from '../../../Components/text';
import { updateFuelEvent } from '../../../Store/Actions';
import { fixImageOrientation, getSignedUrl } from '../../../Utils';
import { styles } from './styles';
import { MAX_UPLOAD_RETRIES, S3_BUCKET_BASEURL } from '../../../Constants';
import { ROUTES } from '../../../Navigation/ROUTES';

const CaptureReceiptScreen = ({ navigation, route }) => {
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
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [isWaitingForConnection, setIsWaitingForConnection] = useState(false);
  const isUploadCancelled = useRef(false);
  const [showResult, setShowResult] = useState(false);
  const [isNoReceiptLoading, setIsNoReceiptLoading] = useState(false);

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

      Alert.alert(t('fuelVerification.cameraPermissionRequiredTitle'), t('fuelVerification.cameraPermissionCaptureReceipt'));
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
    Alert.alert(t('fuelVerification.uploadFailedTitle'), t('fuelVerification.uploadFailedReceipt'));
  };

  const handleResponse = async (key, shouldUseNullImageUrl = false) => {
    const imageUrl = shouldUseNullImageUrl ? null : `${S3_BUCKET_BASEURL}${key}`;
    console.log('imageUrl /////', imageUrl);
    const body = {
      currentStep: 5,
      receiptImageUrl: imageUrl,
    };
    try {
      const response = await dispatch(updateFuelEvent(fuelEvent?.id, body));
      console.log('receipt ai response /////', response);
      if (response?.status === 200) {
        setShowResult(true);
        setIsUploading(false);
      } else {
        console.log('pre fuel gauge ai response /////', response?.message);
        setIsUploading(false);
        Alert.alert(t('fuelVerification.uploadFailedTitle'), t('fuelVerification.uploadFailedReceipt'));
      }
    } catch (error) {
      console.log('error', error);
      setIsUploading(false);
    }
  };

  const handleCapture = async () => {
    if (capturedImageUri) {
      setCapturedImageUri('');
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

    if (!cameraRef.current) {
      return;
    }

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
        'receipt',
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
      Alert.alert(t('fuelVerification.captureFailedTitle'), t('fuelVerification.captureFailedReceipt'));
    }
  };

  const handleNoReceiptAvailable = async () => {
    if (isNoReceiptLoading || isUploading) {
      return;
    }
    setIsNoReceiptLoading(true);
    await handleResponse(null, true);
    setIsNoReceiptLoading(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <View style={styles.blueHeaderContainer}>
        <LogoHeader />
        <View style={styles.flowHeader}>
          <AppText style={styles.stepText}>{t('fuelVerification.stepReceipt')}</AppText>
          <AppText style={styles.title}>{t('fuelVerification.captureReceiptTitle')}</AppText>
          <AppText style={styles.subtitle}>{t('fuelVerification.captureReceiptSubtitle')}</AppText>
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
              <AppText style={styles.ghostButtonText}>{t('fuelVerification.captureReceiptImage')}</AppText>
            </TouchableOpacity>
          ) : null}

          {showResult ? (
            <CardWrapper style={styles.odometerResultCard}>
              <AppText style={styles.modalTitle}>{t('fuelVerification.receiptData')}</AppText>
              <View style={styles.odometerResultRow}>
                <AppText style={styles.vehicleMeta}>{t('fuelVerification.gallons')}</AppText>
                <AppText style={styles.vehicleName}>{fuelEvent?.receiptGallons ?? '--'}</AppText>
              </View>
              <View style={styles.odometerResultRow}>
                <AppText style={styles.vehicleMeta}>{t('fuelVerification.price')}</AppText>
                <AppText style={styles.vehicleName}>{fuelEvent?.receiptPricePerGallon ?? '--'}</AppText>
              </View>
              <View style={styles.odometerResultRow}>
                <AppText style={styles.vehicleMeta}>{t('fuelVerification.total')}</AppText>
                <AppText style={styles.vehicleName}>{fuelEvent?.receiptTotal ?? '--'}</AppText>
              </View>
              <View style={styles.odometerResultRow}>
                <AppText style={styles.vehicleMeta}>{t('fuelVerification.merchant')}</AppText>
                <AppText style={styles.vehicleName}>{fuelEvent?.receiptMerchant || '--'}</AppText>
              </View>
            </CardWrapper>
          ) : null}

          <PrimaryGradientButton
            text={t('common.continue')}
            buttonStyle={styles.ctaButton}
            buttonDisabled={!showResult || isUploading}
            onPress={() => navigation.navigate(ROUTES.FUEL_VERIFIED_SUBMIT)}
          />

          <TouchableOpacity
            style={styles.ghostButton}
            activeOpacity={0.8}
            onPress={handleNoReceiptAvailable}
            disabled={isNoReceiptLoading || isUploading}
          >
            {isNoReceiptLoading ? (
              <ActivityIndicator size="small" color="#1D4ED8" />
            ) : (
              <AppText style={styles.ghostButtonText}>{t('fuelVerification.noReceiptAvailable')}</AppText>
            )}
          </TouchableOpacity>

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

export default CaptureReceiptScreen;
