import React, {useCallback, useEffect, useRef, useState} from 'react';
import {TouchableOpacity, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useDispatch, useSelector} from 'react-redux';
import {useTranslation} from 'react-i18next';

import ImagePicker_New from '../ItemPicker/ImagePicker_New';
import DiscardInspectionModal from '../PopUpModals/DiscardInspectionModal';
import AppText from '../text';
import {ROUTES} from '../../Navigation/ROUTES';
import {OdometerDetails, getCurrentDate, handle_Session_Expired, newInspectionUploadError} from '../../Utils';
import {ai_Mileage_Extraction, deleteImageFromDatabase, uploadFileToDatabase} from '../../services/inspection';
import {withRetry} from '../../Utils/retry';
import {removeVehicleImage, setMileage, setMileageMessage, setMileageVisible, updateVehicleImage} from '../../Store/Actions';
import {styles} from './styles';

const sanitize = text => (text || '').replace(/[^0-9]/g, '');
const uploadFailedInitialState = {visible: false, title: '', message: '', canRetry: false};
// Retrying these can't succeed: the inspection expired (403) or the image is a duplicate (409).
const NON_RETRYABLE_STATUS_CODES = [403, 409];

const OdometerSection = ({handleMediaModalDetailsPress}) => {
  const {t} = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const returnTo = ROUTES.NEW_INSPECTION;

  const {
    selectedInspectionID: inspectionId,
    vehicle_Type,
    mileage: reduxMileage,
    carVerificiationItems,
  } = useSelector(state => state?.newInspection) || {};

  const existingOdometerUrl = carVerificiationItems?.odometer || '';
  const existingOdometerID = carVerificiationItems?.odometerID || null;

  const [loading, setLoading] = useState(false);
  const [imageUri, setImageUri] = useState(existingOdometerUrl);
  const [uploadFailedState, setUploadFailedState] = useState(uploadFailedInitialState);
  const fileIdRef = useRef(existingOdometerID);
  // Capture whose file record failed to save; the image is already on S3, so a retry only re-sends the record.
  const pendingUploadRef = useRef(null);

  useEffect(() => {
    if (existingOdometerUrl) {
      setImageUri(existingOdometerUrl);
      fileIdRef.current = existingOdometerID || null;
    }
  }, [existingOdometerUrl, existingOdometerID]);

  const openMileageModal = useCallback(
    (prefill = '') => {
      dispatch(setMileageMessage(''));
      dispatch(setMileage(prefill));
      dispatch(setMileageVisible(true));
    },
    [dispatch]
  );

  const uploadOdometerImage = useCallback(
    async (s3Key, mime) => {
      if (!s3Key || !inspectionId) {
        return {id: null, error: null};
      }
      const body = {
        category: OdometerDetails.subCategory,
        url: s3Key,
        extension: `image/${mime}`,
        groupType: OdometerDetails.groupType,
        dateImage: getCurrentDate(),
        hasAdded: vehicle_Type,
        categoryId: null,
        companyConfigId: null,
      };
      try {
        const response = await withRetry(() => uploadFileToDatabase(inspectionId, body), {label: 'odometer-file-record'});
        const id = response?.data?.id ?? null;
        return {id, error: id ? null : new Error('Odometer file record returned no id')};
      } catch (err) {
        console.log('Odometer image upload failed:', err?.response?.data || err?.message);
        return {id: null, error: err};
      }
    },
    [inspectionId, vehicle_Type]
  );

  const handleUploadFailed = useCallback(
    error => {
      const statusCode = error?.response?.data?.statusCode || error?.response?.status || null;
      if (statusCode === 401) {
        pendingUploadRef.current = null;
        handle_Session_Expired(statusCode, dispatch);
        return;
      }
      const {title, message} = newInspectionUploadError(statusCode || '');
      setUploadFailedState({visible: true, title, message, canRetry: !NON_RETRYABLE_STATUS_CODES.includes(statusCode)});
    },
    [dispatch]
  );

  // Saves the file record for an image already on S3. The mileage modal only opens once the
  // image is saved, so the driver never enters a mileage for a photo the server doesn't have.
  const saveCapturedOdometer = useCallback(
    async (capture, mileagePrefillPromise) => {
      const {capturedImageUri, capturedImageMime, capturedImageS3Key} = capture;

      // Snapshot the OLD id now, before any async work begins
      const previousFileId = fileIdRef.current;

      setLoading(true);
      setImageUri(capturedImageUri);

      const {id: newFileId, error} = await uploadOdometerImage(capturedImageS3Key, capturedImageMime);

      if (!newFileId) {
        // Not saved: show what the server still has, keep its id, and offer a retry.
        setImageUri(existingOdometerUrl);
        fileIdRef.current = previousFileId;
        pendingUploadRef.current = {capture, mileagePrefillPromise};
        setLoading(false);
        handleUploadFailed(error);
        return;
      }

      pendingUploadRef.current = null;
      fileIdRef.current = newFileId;
      dispatch(updateVehicleImage(OdometerDetails.groupType, OdometerDetails.key, capturedImageUri, newFileId));

      if (previousFileId && previousFileId !== newFileId) {
        deleteImageFromDatabase(previousFileId).catch(err => console.log('Odometer image delete failed:', err?.response?.data || err?.message));
      }

      openMileageModal(await mileagePrefillPromise);
      setLoading(false);
    },
    [dispatch, existingOdometerUrl, uploadOdometerImage, openMileageModal, handleUploadFailed]
  );

  const processCapturedOdometer = useCallback(
    async capture => {
      if (!inspectionId) {
        return;
      }

      // OCR runs alongside the save; its result is used only once the image is saved.
      const mileagePrefillPromise = ai_Mileage_Extraction(capture.capturedImageUri)
        .then(response => {
          const {mileage, status = false} = response?.data || {};
          return status === true && mileage ? sanitize(String(mileage)) : '';
        })
        .catch(() => '');

      await saveCapturedOdometer(capture, mileagePrefillPromise);
    },
    [inspectionId, saveCapturedOdometer]
  );

  const handleRetryUpload = useCallback(() => {
    setUploadFailedState(uploadFailedInitialState);
    const pending = pendingUploadRef.current;
    if (pending) {
      saveCapturedOdometer(pending.capture, pending.mileagePrefillPromise);
    }
  }, [saveCapturedOdometer]);

  const handleDismissUploadFailed = useCallback(() => {
    setUploadFailedState(uploadFailedInitialState);
    pendingUploadRef.current = null;
  }, []);

  useEffect(() => {
    const {isMileageCapture, capturedImageUri, capturedImageMime, capturedImageS3Key} = route?.params || {};
    if (!isMileageCapture) {
      return;
    }

    navigation.setParams({
      isMileageCapture: undefined,
      capturedImageUri: undefined,
      capturedImageMime: undefined,
      capturedImageS3Key: undefined,
    });

    if (!capturedImageUri) {
      return;
    }
    processCapturedOdometer({capturedImageUri, capturedImageMime, capturedImageS3Key});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.isMileageCapture, route?.params?.capturedImageUri]);

  const handlePressCamera = useCallback(() => {
    if (loading) {
      return;
    }
    navigation.navigate(ROUTES.CAMERA, {
      modalDetails: {uri: '', fileId: '', ...OdometerDetails},
      type: OdometerDetails.key,
      returnTo,
      returnToParams: {isMileageCapture: true},
    });
  }, [loading, navigation, returnTo]);

  const handleOdometerImagePress = useCallback(() => {
    if (!imageUri || loading) {
      return;
    }
    if (handleMediaModalDetailsPress) {
      handleMediaModalDetailsPress(OdometerDetails.title, imageUri, false, fileIdRef.current);
    }
  }, [handleMediaModalDetailsPress, imageUri, loading]);

  const handleClearImage = useCallback(async () => {
    const idToDelete = fileIdRef.current;
    console.log('🚀 ~ OdometerSection ~ idToDelete:', idToDelete);
    setImageUri('');
    fileIdRef.current = null;
    dispatch(removeVehicleImage(OdometerDetails.groupType, OdometerDetails.key));
    if (idToDelete) {
      await deleteImageFromDatabase(idToDelete).catch(err => console.log('Odometer image delete failed:', err?.response?.data || err?.message));
    }
  }, [dispatch]);

  const handleOpenEditModal = useCallback(() => openMileageModal(reduxMileage || ''), [openMileageModal, reduxMileage]);

  return (
    <View>
      <View style={styles.body}>
        <View style={styles.odometerRow}>
          <AppText style={styles.odometerLabel}>{OdometerDetails.title}</AppText>
          {!!imageUri && (
            <TouchableOpacity onPress={handleOpenEditModal} activeOpacity={0.7}>
              <AppText style={styles.editMileageText}>{`+ ${t('common.edit')} ${t('vehicleInfo.mileageLabel')}`}</AppText>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.imagePickerWrapper}>
          <ImagePicker_New
            onPress={handlePressCamera}
            pickerText={t('carVerification.uploadImage')}
            text={OdometerDetails.title}
            imageURL={imageUri}
            isLoading={loading}
            onClearPress={handleClearImage}
            handleMediaModalDetailsPress={handleOdometerImagePress}
          />
        </View>
      </View>
      {uploadFailedState.visible && (
        <DiscardInspectionModal
          title={uploadFailedState.title}
          description={uploadFailedState.message}
          yesButtonText={uploadFailedState.canRetry ? t('common.retry') : t('common.ok')}
          onYesPress={uploadFailedState.canRetry ? handleRetryUpload : handleDismissUploadFailed}
          dualButton={uploadFailedState.canRetry}
          onNoPress={handleDismissUploadFailed}
        />
      )}
    </View>
  );
};

export default OdometerSection;
