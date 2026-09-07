import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { heightPercentageToDP as hp, widthPercentageToDP as wp } from 'react-native-responsive-screen';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';

import InputModal from './InputModal';
import {
  setMileageVisible,
  setMileage,
  setMileageMessage,
} from '../../Store/Actions';
import { updateMileageInDB } from '../../services/inspection';
import { removeAlphabets } from '../../Utils/helpers';
import { useInspectionExpiry } from '../../hooks/useInspectionExpiry';
import { colors } from '../../Assets/Styles';

const MileageInput = ({ crossButtonColor = colors.orangePeel }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  let { selectedInspectionID, mileageMessage,carVerificiationItems,mileage,inspectionDetail,mileageVisible,inspectionFrequency } = useSelector(
    state => state.newInspection,
  );
  const isScreenFocused = useIsFocused();
  // Detail is loaded by the screens themselves; only the expiry flag is needed here.
  const { isInspectionExpired } = useInspectionExpiry({ autoLoadDetail: false });
  let newInspectionData = useSelector(
    state => state.newInspection,
  );
  // If an odometer image was captured, pre-fill the mileage with its odometerID.
  const odometerDefault = mileage
    ? mileage : '';

  // Mileage confirmed in this session (the store copy of the inspection isn't
  // re-fetched after a save, so remember it here). Reset when the inspection changes.
  const [savedInSession, setSavedInSession] = useState(false);

  useEffect(() => {
    setSavedInSession(false);
  }, [selectedInspectionID]);

  // The store copy of the inspection is persisted (redux-persist), so it can still hold a
  // previous inspection on a fresh app start — only trust it once it matches this inspection.
  const detailId = inspectionDetail?.id;
  const isDetailForThisInspection =
    !!detailId && String(detailId) === String(selectedInspectionID);

  // Mileage already persisted on the inspection (loaded from the server).
  const persistedMileage = isDetailForThisInspection
    ? String(inspectionDetail?.mileage ?? '').trim()
    : '';
  const hasSavedMileage =
    savedInSession || (!!persistedMileage && persistedMileage !== '0');

  // Odometer is a configured category — same predicate the submit gate uses
  // (see NewInspectionContainer `requiresMileage` / DVIR `requiresOdometer`).
  const frequencyList = Array.isArray(inspectionFrequency) ? inspectionFrequency : [];
  const requiresMileage = frequencyList.some(
    item => String(item?.categoryName || '').trim().toLowerCase() === 'odometer',
  );
  const hasOdometerImage = !!carVerificiationItems?.odometer;

  // RESUME: the odometer image is saved as soon as it is captured, the mileage only when the
  // modal is confirmed. Killing the app in between leaves an inspection that can never be
  // submitted (the submit button needs both) with nothing on screen explaining why — so ask
  // for the mileage again once, when the inspection comes back with an image but no mileage.
  const promptedForRef = useRef(null);

  useEffect(() => {
    if (
      !isScreenFocused ||
      !selectedInspectionID ||
      !isDetailForThisInspection ||
      !requiresMileage ||
      !hasOdometerImage ||
      hasSavedMileage ||
      mileageVisible ||
      isInspectionExpired
    ) {
      return;
    }
    if (promptedForRef.current === selectedInspectionID) {
      return;
    }
    promptedForRef.current = selectedInspectionID;
    dispatch(setMileageMessage(''));
    dispatch(setMileageVisible(true));
  }, [
    isScreenFocused,
    selectedInspectionID,
    isDetailForThisInspection,
    requiresMileage,
    hasOdometerImage,
    hasSavedMileage,
    mileageVisible,
    isInspectionExpired,
    dispatch,
  ]);

  const onSubmit = useCallback(
    async (text, actionCreator, toggleLoading, resetStates) => {
      const mileage = removeAlphabets(text);
      // Nothing usable typed: keep the modal open and don't touch the loading
      // flag, otherwise the confirm button would stay disabled — with no way
      // out while the modal isn't dismissible.
      if (!mileage) {
        dispatch(setMileageMessage(t('mileageInput.description')));
        return;
      }

      try {
        toggleLoading();

        const response = await updateMileageInDB(mileage, selectedInspectionID);
        console.log('response',response);

        dispatch(setMileage(mileage));
        dispatch(setMileageMessage(''));
        setSavedInSession(true);
        // resetStates();
        dispatch(actionCreator());
      } catch (error) {
        onSubmitFailed(error);
      } finally {
        toggleLoading();
      }
    },
    [selectedInspectionID, dispatch, t],
  );

  function onSubmitFailed(error = {}) {
    try {
      const { status = null } = error || {};
      let message = t('mileageInput.errors.lessThanPrevious');

      if (status !== 400) {
        message = t('common.somethingWentWrong');
      }
      dispatch(setMileageMessage(message));
    } catch (error) {
      throw error;
    }
  }

  return (
    <InputModal
      visibleKey="mileage"
      valueKey="mileage"
      title={t('mileageInput.title')}
      description={t('mileageInput.description')}
      actionCreator={setMileageVisible}
      callback={onSubmit}
      placeHolder={t('mileageInput.placeHolder')}
      keyboardType={'decimal-pad'}
      inputMode={'decimal'}
      errorMessage={mileageMessage}
      defaultValue={odometerDefault}
      dismissible={hasSavedMileage || isInspectionExpired}
      crossButtonColor={crossButtonColor}
      crossButtonStyle={{
        width: wp('5%'),
        height: hp('2.5%'),
      }}
    />
  );
};

export default memo(MileageInput);
