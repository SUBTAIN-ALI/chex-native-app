import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import ImagePicker_New from '../ItemPicker/ImagePicker_New';
import CollapsedCard from '../Card/CollapsedCard';
import AppText from '../text';
import { ROUTES } from '../../Navigation/ROUTES';
import { OdometerDetails, getCurrentDate } from '../../Utils';
import {
  ai_Mileage_Extraction,
  deleteImageFromDatabase,
  uploadFileToDatabase,
} from '../../services/inspection';
import { setMileage, setMileageMessage, setMileageVisible } from '../../Store/Actions';
import { withRetry } from '../../Utils/retry';
import { styles } from './styles';

const sanitize = text => (text || '').replace(/[^0-9]/g, '');

/**
 * Reusable, optional odometer/mileage capture section.
 *
 * Uses the shared CollapsedCard header (same component as Interior / Exterior /
 * Tires). Expanding it shows the "Odometer" label + a "+ Edit Mileage" action
 * and the Odometer "Upload Image" box.
 *
 * The mileage number is entered / confirmed in the app's existing MileageInput
 * modal (rendered at screen level). This component just opens it via Redux
 * (setMileage to pre-fill, setMileageVisible to show) — manually via "+ Edit
 * Mileage" or automatically after an AI/OCR read. MileageInput handles the save
 * (updateMileageInDB) itself.
 *
 * The odometer image is persisted here, incrementally, via uploadFileToDatabase.
 *
 * @param {string} returnTo - Route name the CAMERA screen returns to (e.g. NEW_INSPECTION).
 * @param {number} index    - Position number shown in the header badge (defaults to 1).
 */
const MileageSection = ({ returnTo, index = 1 }) => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();

  const { selectedInspectionID: inspectionId, vehicle_Type, mileage: reduxMileage, carVerificiationItems } = useSelector(
    state => state?.newInspection
  ) || {};

  // Existing odometer image already saved on the inspection (if any).
  const existingOdometerUrl = carVerificiationItems?.odometer || '';
  const existingOdometerID = carVerificiationItems?.odometerID || null;

  const [expanded, setExpanded] = useState(false);
  const [value] = useState(reduxMileage || '');
  const [loading, setLoading] = useState(false);
  const [imageUri, setImageUri] = useState(existingOdometerUrl);
  const fileIdRef = useRef(existingOdometerID);

  // Prefill / refresh the odometer image from the inspection data once it loads.
  // Only sets when a URL is present, so a freshly captured image isn't wiped.
  useEffect(() => {
    if (existingOdometerUrl) {
      setImageUri(existingOdometerUrl);
      fileIdRef.current = existingOdometerID || null;
    }
  }, [existingOdometerUrl, existingOdometerID]);

  // "Complete" once an odometer photo is captured or a mileage value is present.
  const isComplete = !!imageUri || !!value;

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
      if (!s3Key || !inspectionId) { return null; }
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
        const response = await withRetry(() => uploadFileToDatabase(inspectionId, body), { label: 'odometer-file-record' });
        return response?.data?.id ?? null;
      } catch (err) {
        console.log('Odometer image upload failed:', err?.response?.data || err?.message);
        return null;
      }
    },
    [inspectionId, vehicle_Type]
  );

  const processCapturedOdometer = useCallback(
    async ({ capturedImageUri, capturedImageMime, capturedImageS3Key }) => {
      if (!inspectionId) { return; }
      setLoading(true);
      setImageUri(capturedImageUri); // show preview immediately

      const previousFileId = fileIdRef.current;
      // Persist the odometer image regardless of OCR outcome (parity with VehicleInformation).
      const imageUploadPromise = uploadOdometerImage(capturedImageS3Key, capturedImageMime);

      try {
        const response = await ai_Mileage_Extraction(capturedImageUri);
        const { mileage = '', status = false } = response?.data || {};
        // Open the existing MileageInput modal with the AI result (empty -> shows the
        // "unable to detect" description) for the user to confirm / enter.
        openMileageModal(status === true && mileage ? sanitize(String(mileage)) : '');
      } catch (err) {
        openMileageModal('');
      } finally {
        const newFileId = await imageUploadPromise;
        fileIdRef.current = newFileId;
        // Replace any previously uploaded odometer image so only one is kept.
        if (previousFileId && previousFileId !== newFileId) {
          deleteImageFromDatabase(previousFileId).catch(() => {});
        }
        setLoading(false);
      }
    },
    [inspectionId, uploadOdometerImage, openMileageModal]
  );

  // Receive the captured odometer image from the CAMERA screen.
  useEffect(() => {
    const { isMileageCapture, capturedImageUri, capturedImageMime, capturedImageS3Key } = route?.params || {};
    if (!isMileageCapture) { return; }

    // Clear the flags immediately so this only runs once per capture.
    navigation.setParams({
      isMileageCapture: undefined,
      capturedImageUri: undefined,
      capturedImageMime: undefined,
      capturedImageS3Key: undefined,
    });

    if (!capturedImageUri) { return; }
    setExpanded(true); // reveal the section so the user sees the result
    processCapturedOdometer({ capturedImageUri, capturedImageMime, capturedImageS3Key });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.isMileageCapture, route?.params?.capturedImageUri]);

  const handlePressCamera = useCallback(() => {
    if (loading) { return; }
    navigation.navigate(ROUTES.CAMERA, {
      modalDetails: { uri: '', fileId: '', ...OdometerDetails },
      type: OdometerDetails.key,
      returnTo,
      returnToParams: { isMileageCapture: true },
    });
  }, [loading, navigation, returnTo]);

  const handleClearImage = useCallback(() => {
    const idToDelete = fileIdRef.current;
    setImageUri('');
    fileIdRef.current = null;
    if (idToDelete) {
      deleteImageFromDatabase(idToDelete).catch(err =>
        console.log('Odometer image delete failed:', err?.response?.data || err?.message)
      );
    }
  }, []);

  const handleOpenEditModal = useCallback(() => openMileageModal(value || ''), [openMileageModal, value]);

  return (
    <View style={styles.wrapper}>
      {/* Reuse the shared category header so it matches Interior / Exterior / Tires */}
      <CollapsedCard
        text={OdometerDetails.title}
        index={index}
        isActive={expanded}
        isBothItemsAvailable={isComplete}
        onPress={() => setExpanded(prev => !prev)}
      />

      {expanded && (
        <View style={styles.body}>
          <View style={styles.odometerRow}>
            <AppText style={styles.odometerLabel}>{OdometerDetails.title}</AppText>
            {/* Only show "Edit Mileage" once an odometer image is uploaded */}
            {!!imageUri && (
              <TouchableOpacity onPress={handleOpenEditModal} activeOpacity={0.7}>
                <AppText style={styles.editMileageText}>{`+ ${t('common.edit')} ${t('vehicleInfo.mileageLabel')}`}</AppText>
              </TouchableOpacity>
            )}
          </View>

          {/* Odometer image upload box — same component/size as the Interior items (ImagePicker_New) */}
          <View style={styles.imagePickerWrapper}>
            <ImagePicker_New
              onPress={handlePressCamera}
              pickerText={t('carVerification.uploadImage')}
              text={OdometerDetails.title}
              imageURL={imageUri}
              isLoading={loading}
              onClearPress={handleClearImage}
              handleMediaModalDetailsPress={handlePressCamera}
            />
          </View>
        </View>
      )}
    </View>
  );
};

export default MileageSection;
