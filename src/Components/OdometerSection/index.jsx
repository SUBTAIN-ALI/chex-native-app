import React, {useCallback, useEffect, useRef, useState} from 'react';
import {TouchableOpacity, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useDispatch, useSelector} from 'react-redux';
import {useTranslation} from 'react-i18next';

import ImagePicker_New from '../ItemPicker/ImagePicker_New';
import AppText from '../text';
import {ROUTES} from '../../Navigation/ROUTES';
import {OdometerDetails, getCurrentDate} from '../../Utils';
import {ai_Mileage_Extraction, deleteImageFromDatabase, uploadFileToDatabase} from '../../services/inspection';
import {withRetry} from '../../Utils/retry';
import {removeVehicleImage, setMileage, setMileageMessage, setMileageVisible, updateVehicleImage} from '../../Store/Actions';
import {styles} from './styles';

const sanitize = text => (text || '').replace(/[^0-9]/g, '');

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
  const fileIdRef = useRef(existingOdometerID);

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
        return null;
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
        return response?.data?.id ?? null;
      } catch (err) {
        console.log('Odometer image upload failed:', err?.response?.data || err?.message);
        return null;
      }
    },
    [inspectionId, vehicle_Type]
  );

  const processCapturedOdometer = useCallback(
    async ({capturedImageUri, capturedImageMime, capturedImageS3Key}) => {
      if (!inspectionId) {
        return;
      }

      setLoading(true);
      setImageUri(capturedImageUri);

      // ✅ FIX 2: snapshot the OLD id NOW, before any async work begins
      const previousFileId = fileIdRef.current;

      // Kick off upload and OCR in parallel
      const imageUploadPromise = uploadOdometerImage(capturedImageS3Key, capturedImageMime);

      try {
        const response = await ai_Mileage_Extraction(capturedImageUri);
        const {mileage, status = false} = response?.data || {};
        openMileageModal(status === true && mileage ? sanitize(String(mileage)) : '');
      } catch (err) {
        openMileageModal('');
      } finally {
        // ✅ FIX 2 cont: resolve the new id, then update the ref, THEN delete the old one
        const newFileId = await imageUploadPromise;
        fileIdRef.current = newFileId;
        if (newFileId) {
          dispatch(updateVehicleImage(OdometerDetails.groupType, OdometerDetails.key, capturedImageUri, newFileId));
        }

        if (previousFileId && previousFileId !== newFileId) {
          deleteImageFromDatabase(previousFileId).catch(err => console.log('Odometer image delete failed:', err?.response?.data || err?.message));
        }
        setLoading(false);
      }
    },
    [dispatch, inspectionId, uploadOdometerImage, openMileageModal]
  );

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
    </View>
  );
};

export default OdometerSection;
