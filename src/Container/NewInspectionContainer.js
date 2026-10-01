import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Platform } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import {
  ExteriorItemsExpandedCard,
  ExteriorItemsExpandedCard_Old,
  InteriorItemsAnnotationExpandedCard,
  InteriorItemsExpandedCard,
} from '../Components';
import {
  Delete_Messages,
  HARDWARE_BACK_PRESS,
  INSPECTION,
  INSPECTION_SUBCATEGORY,
  VEHICLE_TYPES,
} from '../Constants';
import { ROUTES } from '../Navigation/ROUTES';
import { NewInspectionScreen } from '../Screens';
import {
  clearTires,
  deleteImageFromDatabase,
  extractNumberPlate,
  imageAnnotation,
  inspectionSubmission,
  location,
  vehicleTireStatus,
} from '../services/inspection';
import {
  categoryVariant,
  clear_Tires,
  clearNewInspection,
  file_Details,
  removeVehicleImage,
  setMileageVisible,
  setRequired,
  setSelectedVehicleKind,
  setVehicleType,
  showToast,
  skipLeft,
  skipLeftCorners,
  skipRight,
  skipRightCorners,
  updateIsLicensePlateUploaded,
} from '../Store/Actions';
import {
  exteriorVariant,
  EXTRACT_INSPECTION_ITEM_ID,
  extractCoordinates,
  extractIDs,
  get_Inspection_Details,
  handle_Session_Expired,
  haveOneValue,
  isNotEmpty,
  isObjectEmpty,
  LicensePlateDetails,
} from '../Utils';
import { removeAlphabets } from '../Utils/helpers';
import { useInspectionExpiry } from '../hooks/useInspectionExpiry';
import { useIsFocused, usePreventRemove } from '@react-navigation/native';
import AppText from '../Components/text';

const IS_ALL_VEHICLE_PARTS_INITIAL_STATE = {
  isAllCarVerification: true,
  isAllInterior: false,
  isAllExterior: false,
  isAllTires: false,
  isAllParts: false,
};

const { INSPECTION_IN_PROGRESS, VIDEO, CAMERA, COMPLETED_INSPECTION } = ROUTES;
const { OS } = Platform;
const annotationModalInitialState = {
  title: '',
  type: '',
  uri: '',
  fileId: '',
  source: '',
};
const selectedOptionInitialState = {
  isCarVerification: true,
  isInterior: false,
  isExterior: false,
  isTires: false,
};

const exteriorItemsExpandedCards = {
  existing: ExteriorItemsExpandedCard_Old,
  new: ExteriorItemsExpandedCard,
};
const interiorItemsExpandedCards = {
  existing: InteriorItemsExpandedCard,
  new: InteriorItemsAnnotationExpandedCard,
};
const delay = {
  ios: 1000,
  android: 0,
};

// Tire categoryName from API may be id-style (tdrf, tdlf) or name-style (left_front_tire)
const TIRE_CATEGORY_TO_KEY = {
  tdrf: 'rightFrontTire',
  tdrr: 'rightRearTire',
  tdlf: 'leftFrontTire',
  tdlr: 'leftRearTire',
};

const NewInspectionContainer = ({ route, navigation }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { canGoBack, goBack, navigate } = navigation;
  let {
    carVerificiationItems,
    exteriorItems,
    interiorItems,
    tires,
    selectedInspectionID,
    plateNumber,
    /* skipLeft,
    skipLeftCorners,
    skipRight,
    skipRightCorners,*/
    isLicensePlateUploaded,
    vehicle_Type,
    variant,
    fileDetails,
    mileage = '',
    feedback,
    imageDimensions,
  } = useSelector(state => state.newInspection) || {};
  const { user } = useSelector(state => state?.auth) || {};
  const { inspectionFrequency } = useSelector(state => state.newInspection) || {};
  const inspectionFrequencyList = Array.isArray(inspectionFrequency) ? inspectionFrequency : [];
  const interiorItemsConfig = inspectionFrequencyList.filter(item => item?.groupType === 'interiorItems');
  const exteriorItemsConfig = inspectionFrequencyList.filter(item => item?.groupType === 'exteriorItems');
  const tiresItemsConfig = inspectionFrequencyList.filter(item => item?.groupType === 'tires');

  const isScreenFocused = useIsFocused();
  const { companyId } = user?.data || {};
  const sanitizedMileage = removeAlphabets(String(mileage || ''));
  const hasValidMileage = Number(sanitizedMileage) > 0;
  const [modalVisible, setModalVisible] = useState(false);
  const [mediaModalVisible, setMediaModalVisible] = useState(false);
  const [mediaModalDetails, setMediaModalDetails] = useState({});
  const [selectedOption, setSelectedOption] = useState(selectedOptionInitialState);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingIndicator, setLoadingIndicator] = useState(false);
  const [deleteItem, setDeleteItem] = useState({ category: null, key: null });
  const [isDiscardInspectionModalVisible, setIsDiscardInspectionModalVisible] = useState(false);
  const [isInspectionInProgressModalVisible, setIsInspectionInProgressModalVisible] = useState(false);
  const [isLicenseModalVisible, setIsLicenseModalVisible] = useState(false);
  // const [previousRoute, setPreviousRoute] = useState('');
  const [errorTitle, setErrorTitle] = useState('');
  const [inUseErrorTitle, setInUseErrorTitle] = useState('');
  // Expiry watcher is shared with the DVIR checklist screen; resetAllStates clears this screen's local state.
  const { isInspectionExpired, handleExpiredInspectionPress } = useInspectionExpiry({ onAcknowledge: resetAllStates });
  const [inspectionID, setInspectionID] = useState(null);
  const modalDetailsInitialState = {
    ...LicensePlateDetails,
    isVideo: false,
  };
  const [modalDetails, setModalDetails] = useState(modalDetailsInitialState);
  const [annotationModalDetails, setAnnotationModalDetails] = useState(annotationModalInitialState);
  const [displayTires, setDisplayTires] = useState(true);
  const [displayAnnotationPopUp, setDisplayAnnotationPopUp] = useState(false);
  const [displayAnnotation, setDisplayAnnotation] = useState(false);
  const [checkTireStatus, setCheckTireStatus] = useState(true);
  const [isAllVehicleParts, setIsAllVehicleParts] = useState(IS_ALL_VEHICLE_PARTS_INITIAL_STATE);
  const [fileID, setFileID] = useState('');
  const [isExterior, setIsExterior] = useState(false);
  const [requiredFields, setRequiredFields] = useState({});

  const ActiveExteriorItemsExpandedCard = exteriorItemsExpandedCards[vehicle_Type];
  const ActiveInteriorItemsExpandedCard = interiorItemsExpandedCards[vehicle_Type];

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(HARDWARE_BACK_PRESS, handle_Hardware_Back_Press);
    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    if ((route.params?.routeName === INSPECTION_IN_PROGRESS || route?.params?.routeName === ROUTES.VEHICLE_INFORMATION) && checkTireStatus) {
      vehicleTireStatusToRender(selectedInspectionID);
    }

    handleIsAllVehicleParts();

    if (route.params) {
      // OdometerSection lives in the Interior card and saves the returned capture on mount; keep it mounted.
      if (route.params.isMileageCapture) {
        setSelectedOption(prevState => ({ ...prevState, isInterior: true }));
      }
      const { isLicensePlate, isOdometer, displayAnnotation, fileId, annotationDetails, is_Exterior, routeName } = route.params;
      if (routeName !== ROUTES.VEHICLE_INFORMATION) {
        setTimeout(() => {
          setIsLicenseModalVisible(isLicensePlate || false);
          isOdometer && dispatch(setMileageVisible(true));
          setDisplayAnnotationPopUp(displayAnnotation || false);
        }, delay[OS]);
        setFileID(fileId || '');
        setAnnotationModalDetails(prevState => ({
          ...prevState,
          uri: annotationDetails?.uri || '',
        }));
        setIsExterior(is_Exterior || false);
      }
    }
  }, [route?.params]);

  useEffect(() => {
    handleExteriorLeft();
    handleExteriorRight();
  }, [exteriorItems]);
  useEffect(() => {
    handleIsAllVehicleParts();
  }, [carVerificiationItems, interiorItems, exteriorItems, tires, displayTires, modalVisible, inspectionFrequency, hasValidMileage]);
  useEffect(() => {
    const isTiresUploaded = haveOneValue(tires);
    if (!displayTires && isTiresUploaded) {
      handleRemovedAllTires().then();
    } else if (!displayTires) {
      setLoadingIndicator(false);
    } else {
      setLoadingIndicator(false);
    }
  }, [displayTires]);
  useEffect(() => {
    if (!isNotEmpty(selectedInspectionID)) {
      resetAllStates();
    }
  }, [selectedInspectionID]);
  useEffect(() => {
    const licenseBoolean = isNotEmpty(carVerificiationItems.licensePlate);
    dispatch(updateIsLicensePlateUploaded(licenseBoolean));
  }, [carVerificiationItems.licensePlate]);
  useEffect(() => {
    !isLicensePlateUploaded && setSelectedOption(selectedOptionInitialState);
  }, [isLicensePlateUploaded]);

  useEffect(() => {
    if (route?.params?.isInProgress && isScreenFocused && selectedInspectionID) {
      setIsLoading(true);
      dispatch(file_Details(selectedInspectionID)).then(onInProgressInspectionSuccess).catch(onInProgressInspectionFail);
    }
  }, [route?.params?.isInProgress, selectedInspectionID, isScreenFocused]);

  // // Cleanup ONLY on screen unmount
  usePreventRemove(true, ({ data }) => {
    dispatch(clearNewInspection());
    dispatch(setRequired());

    navigation.dispatch(data.action);
  });

  const shouldAnnotate = vehicle_Type === 'new' && isExterior;
  function handle_Hardware_Back_Press() {
    if (canGoBack()) {
      goBack();
      return true;
    }
    return false;
  }

  function resetAllStates() {
    setSelectedOption(selectedOptionInitialState);
    setModalDetails(modalDetailsInitialState);
    setModalVisible(false);
    setIsLoading(false);
    dispatch(clearNewInspection());
    setIsDiscardInspectionModalVisible(false);
    setDeleteItem({ category: null, key: null });
    setIsDiscardInspectionModalVisible(false);
    setIsAllVehicleParts(IS_ALL_VEHICLE_PARTS_INITIAL_STATE);
    setInUseErrorTitle('');
    setLoadingIndicator(false);
    setDisplayTires(true);
    setCheckTireStatus(true);
    setFileID('');
    setDisplayAnnotationPopUp(false);
    setDisplayAnnotation(false);
    setIsExterior(false);
    setRequiredFields({});
  }
  function handleExteriorLeft() {
    if (isNotEmpty(exteriorItems?.exteriorLeft)) {
      dispatch(skipLeftCorners(true));
    } else if (isNotEmpty(exteriorItems?.exteriorFrontLeftCorner) || isNotEmpty(exteriorItems?.exteriorRearLeftCorner)) {
      dispatch(skipLeft(true));
    } else {
      dispatch(skipLeft(false));
      dispatch(skipLeftCorners(false));
    }
  }
  function handleExteriorRight() {
    if (isNotEmpty(exteriorItems?.exteriorRight)) {
      dispatch(skipRightCorners(true));
    } else if (isNotEmpty(exteriorItems?.exteriorFrontRightCorner) || isNotEmpty(exteriorItems?.exteriorRearRightCorner)) {
      dispatch(skipRight(true));
    } else {
      dispatch(skipRight(false));
      dispatch(skipRightCorners(false));
    }
  }
  function handleIsAllVehicleParts() {
    const {
      exteriorFront,
      exteriorFront_1,
      exteriorFront_2,
      exteriorRear,
      exteriorRear_1,
      exteriorRear_2,
      exteriorFrontLeftCorner,
      exteriorFrontLeftCorner_1,
      exteriorFrontLeftCorner_2,
      exteriorFrontRightCorner,
      exteriorFrontRightCorner_1,
      exteriorFrontRightCorner_2,
      exteriorRearLeftCorner,
      exteriorRearLeftCorner_1,
      exteriorRearLeftCorner_2,
      exteriorRearRightCorner,
      exteriorRearRightCorner_1,
      exteriorRearRightCorner_2,
      exteriorInsideCargoRoof,
      exteriorInsideCargoRoof_1,
      exteriorInsideCargoRoof_2,
    } = exteriorItems;
    const { driverSide, driverSide_1, driverSide_2, passengerSide, passengerSide_1, passengerSide_2 } = interiorItems;
    //Annotation or without annotation
    const interior__ = {
      driverSide: driverSide || driverSide_1 || driverSide_2,
      passengerSide: passengerSide || passengerSide_1 || passengerSide_2,
    };
    const exterior__ = {
      exteriorFront: exteriorFront || exteriorFront_1 || exteriorFront_2,
      exteriorRear: exteriorRear || exteriorRear_1 || exteriorRear_2,
      exteriorFrontLeftCorner: exteriorFrontLeftCorner || exteriorFrontLeftCorner_1 || exteriorFrontLeftCorner_2,
      exteriorFrontRightCorner: exteriorFrontRightCorner || exteriorFrontRightCorner_1 || exteriorFrontRightCorner_2,
      exteriorRearLeftCorner: exteriorRearLeftCorner || exteriorRearLeftCorner_1 || exteriorRearLeftCorner_2,
      exteriorRearRightCorner: exteriorRearRightCorner || exteriorRearRightCorner_1 || exteriorRearRightCorner_2,

      exteriorInsideCargoRoof: exteriorInsideCargoRoof || exteriorInsideCargoRoof_1 || exteriorInsideCargoRoof_2,
    };
    if (vehicle_Type === 'new') {
      updateRequiredFields(interior__, exterior__);
    }
    // const allCarVerification = !isObjectEmpty(carVerificiationItems);
    const allCarVerification = true;

    // When config is present, only check completion for configured categories (avoids false negative from empty '' in non-shown keys)
    const allInterior =
      interiorItemsConfig.length > 0
        ? !interiorItemsConfig.some(item => {
            const baseKey = INSPECTION_SUBCATEGORY[item?.categoryName];
            if (!baseKey) {
              return false;
            }
            if (item?.categoryName === 'odometer') {
              const hasOdometerImage = carVerificiationItems[baseKey] || interiorItems[baseKey];
              return !(hasOdometerImage && hasValidMileage);
            }
            return !(interiorItems[baseKey] || interiorItems[`${baseKey}_1`] || interiorItems[`${baseKey}_2`]);
          })
        : !isObjectEmpty(interior__);
    const allExterior =
      exteriorItemsConfig.length > 0
        ? !exteriorItemsConfig?.some(item => {
            const baseKey = INSPECTION_SUBCATEGORY[item?.categoryName];
            if (!baseKey) {
              return false;
            }
            return !(exteriorItems[baseKey] || exteriorItems[`${baseKey}_1`] || exteriorItems[`${baseKey}_2`]);
          })
        : !isObjectEmpty(exterior__);
    const allTires =
      tiresItemsConfig.length > 0
        ? !tiresItemsConfig.some(item => {
            const baseKey = INSPECTION_SUBCATEGORY[item?.categoryName] || TIRE_CATEGORY_TO_KEY[item?.categoryName];
            if (!baseKey) {
              return false;
            }
            return !tires[baseKey];
          })
        : !isObjectEmpty(tires);

    // Only require completion for sections that are shown (based on config)
    const interiorSectionShown = interiorItemsConfig.length > 0;
    const exteriorSectionShown = exteriorItemsConfig.length > 0;
    const tiresSectionShown = displayTires && tiresItemsConfig.length > 0;
    const allParts =
      allCarVerification &&
      (!interiorSectionShown || allInterior) &&
      (!exteriorSectionShown || allExterior) &&
      (!tiresSectionShown || allTires);
    const skipOnlyTires =
      allCarVerification &&
      (!interiorSectionShown || allInterior) &&
      (!exteriorSectionShown || allExterior);
    const shouldDisplayTire = {
      true: {
        isAllTires: allTires,
        isAllParts: allParts,
      },
      false: {
        isAllTires: false,
        isAllParts: skipOnlyTires,
      },
    };
    setIsAllVehicleParts({
      isAllCarVerification: allCarVerification,
      isAllInterior: allInterior,
      isAllExterior: allExterior,
      ...shouldDisplayTire[displayTires],
    });
  }

  function toggleFieldRequired(required = null) {
    dispatch(setRequired(required));
  }
  const handleBackPress = () => {
    resetAllStates();
    goBack();
    // navigate(previousRoute);
  };
  function updateRequiredFields(interiorFields, exteriorFields) {
    setRequiredFields({ ...interiorFields, ...exteriorFields });
  }
  //Collapsed Cards Functions starts here
  const handleCardExpansion = key => {
    setSelectedOption(prevState => ({
      ...prevState,
      [key]: !selectedOption[key],
    }));
  };
  //Collapsed Cards Functions ends here
  const handleItemPickerPress = (details, variant = 0) => {
    const haveType = checkCategory(details.category || null);
    displayAnnotationPopUp && setDisplayAnnotationPopUp(false);
    dispatch(categoryVariant(variant));

    // SHOULD DISPLAY REQUIRED TAG ON INFO MODAL
    if (haveType) {
      const { key } = details;
      const isRequired = isNotEmpty(requiredFields[key]);
      toggleFieldRequired(!isRequired);
    } else {
      toggleFieldRequired(true);
    }
    // INFO MODAL STATES
    setModalDetails(details);
    setModalVisible(true);
  };
  function checkCategory(category) {
    const types = ['Interior', 'Exterior'];
    return types.includes(category);
  }
  const handleModalVisible = () => setModalVisible(!modalVisible);
  // Media Modal logic starts here
  const handleMediaModalDetailsPress = (title, mediaURL, isVideo = false, image_ID = '') => {
    const coordinates = extractCoordinates(fileDetails, image_ID);
    setMediaModalDetails({
      title: title,
      source: mediaURL,
      isVideo: isVideo,
      coordinates: coordinates,
    });
    setMediaModalVisible(true);
  };
  const handleMediaModalDetailsCrossPress = () => {
    setMediaModalVisible(false);
    setMediaModalDetails({});
  };
  // Media Modal logic ends here
  const handleCaptureNowPress = (isVideo, key) => {
    // HIDE INFO MODAL FIRST!
    setModalVisible(false);

    // READY DETAILS FOR THE CAMERA SCREEN
    const paths = {
      true: VIDEO,
      false: CAMERA,
    };

    const path = paths[isVideo];
    const details = {
      title: modalDetails.title,
      type: key,
      uri: '',
      source: modalDetails.source,
      fileId: '',
    };

    setAnnotationModalDetails(details);
    setModalDetails(modalDetailsInitialState);

    navigate(path, {
      type: key,
      modalDetails: modalDetails,
      inspectionId: selectedInspectionID,
    });
  };
  const handleSubmitPress = async () => {
    setIsLoading(true);
    await inspectionSubmission(selectedInspectionID, companyId, feedback || null)
      .then(handleGetLocation)
      .catch(onSubmitPressFail)
      .finally(() => setIsLoading(false));
  };
  async function handleGetLocation() {
    await location(selectedInspectionID).then(onGetLocationSuccess).catch(onGetLocationFail);
  }
  function onGetLocationSuccess() {
    dispatch(clearNewInspection());
    resetAllStates();
    navigation.replace(COMPLETED_INSPECTION);
  }
  function onGetLocationFail(error) {
    const { statusCode = null } = error?.response?.data;
    setIsLoading(false);
    if (statusCode === 401) {
      handle_Session_Expired(statusCode, dispatch);
    }
  }
  function onSubmitPressFail(error) {
    const { statusCode = null } = error?.response?.data;
    console.log('Completed Inspection error :', error);
    if (statusCode === 401) {
      handle_Session_Expired(statusCode, dispatch);
    }
  }
  const handleOnCrossPress = (category, key, variant = 0) => {
    dispatch(categoryVariant(variant));
    setIsDiscardInspectionModalVisible(true);
    setDeleteItem({ category: category, key: key });
  };
  const handleYesPress = async () => {
    const { key, category } = deleteItem;
    const { interiorItems: interior, exteriorItems: exterior } = INSPECTION;
    const types = [interior, exterior];
    const haveType = types.includes(category);
    let key_ = key;
    if (haveType) {
      key_ = exteriorVariant(key_, variant);
    }
    setIsDiscardInspectionModalVisible(false);
    const imageID = EXTRACT_INSPECTION_ITEM_ID(key_);

    await deleteImageFromDatabase(imageID)
      .then(() => onImageDeleteSuccess(category, key_))
      .catch(e => onImageDeleteFail(e, category, key_));
  };
  function onImageDeleteSuccess(category, key_) {
    dispatch(showToast(Delete_Messages.success, 'success'));
    dispatch(removeVehicleImage(category, key_));
  }
  function onImageDeleteFail(e, category, key_) {
    const { success, failed } = Delete_Messages;
    const message = {
      types: {
        true: 'success',
        error: 'error',
      },
      messages: {
        true: success,
        false: failed,
      },
    };
    console.log('error deleting image => ', e);
    const statusCode = e?.response?.data?.statusCode;
    const alreadyRemoved = statusCode === 404;
    const activeMessage = message.messages[alreadyRemoved] || t('errors.imageAlreadyDeleted');
    const activeType = message.types[alreadyRemoved] || 'error';
    if (statusCode === 401) {
      handle_Session_Expired(statusCode, dispatch);
    }

    if (alreadyRemoved) {
      dispatch(removeVehicleImage(category, key_));
    }
    dispatch(showToast(activeMessage, activeType));
  }
  const handleNoPress = () => {
    setIsDiscardInspectionModalVisible(false);
    setDeleteItem({ category: null, key: null });
  };
  const handleConfirmModalVisible = () => setIsLicenseModalVisible(prevState => !prevState);
  const handleConfirmVehicleDetail = async numberPlate => {
    if (isNotEmpty(numberPlate.trim())) {
      setIsLoading(true);
      await extractNumberPlate(numberPlate, companyId, selectedInspectionID)
        .then(onNumberPlateExtractSuccess)
        .catch(onNumberPlateExtractFailure)
        .finally(() => {
          setLoadingIndicator(false);
          handleConfirmModalVisible();
          setIsLoading(false);
        });
    }
  };
  function onNumberPlateExtractSuccess(res) {
    const vehicleType = res?.data?.hasAdded || 'existing';
    dispatch(setVehicleType(vehicleType));
    vehicleTireStatusToRender(selectedInspectionID).then(() => setLoadingIndicator(false));
  }
  function onNumberPlateExtractFailure(e) {
    const {
      statusCode = null,
      hasAdded = 'existing',
      inspectionId = null,
      errorMessage = t('errors.genericError'),
      message = t('errors.genericError'),
    } = e?.response?.data || {};

    if (statusCode === 409) {
      const vehicleType = hasAdded || 'existing';
      dispatch(setVehicleType(vehicleType));
      setInspectionID(inspectionId);
      setTimeout(() => {
        setIsInspectionInProgressModalVisible(true); // FOR IOS LITTLE DELAY
      }, 100);
      setErrorTitle(errorMessage);
    } else if (statusCode === 400) {
      setInUseErrorTitle(message);
    }
  }
  const handleYesPressOfInProgressInspection = async () => {
    setIsInspectionInProgressModalVisible(false);
    setLoadingIndicator(true);
    setErrorTitle('');
    dispatch(file_Details(inspectionID)).then(onInProgressInspectionSuccess).catch(onInProgressInspectionFail);
  };
  function onInProgressInspectionSuccess(res) {
    vehicleTireStatusToRender(selectedInspectionID).then();
  }
  function onInProgressInspectionFail(error) {
    const { statusCode = null } = error?.response?.data || {};
    setLoadingIndicator(false);
    setIsLoading(false);
    if (statusCode === 401) {
      handle_Session_Expired(statusCode, dispatch);
    }
    console.log('error of selected inspection in progress => ', error);
  }
  //Tire Rendering logic start here
  async function vehicleTireStatusToRender(inspection_ID) {
    setIsLoading(true);

    vehicleTireStatus(inspection_ID)
      .then(onVehicleTireStatusToRenderSuccess)
      .catch(onVehicleTireStatusToRenderFail)
      .finally(() => {
        setIsLoading(false);
      });
  }
  function onVehicleTireStatusToRenderSuccess(res) {
    const {
      data: { displayTire },
    } = res;
    setDisplayTires(displayTire);
    setLoadingIndicator(!displayTire);
  }
  function onVehicleTireStatusToRenderFail(e) {
    console.log('error while check tire status again inspection => ', e.message);
  }
  async function handleRemovedAllTires() {
    let removeTiresList = extractIDs(tires) || [];

    await clearTires(removeTiresList)
      .then(res => {
        dispatch(clear_Tires());
      })
      .catch()
      .finally(() => {
        setLoadingIndicator(false);
      });
  }
  //Tire Rendering logic ends here

  //Annotation logic starts here
  const handleSkipPress = () => {
    setDisplayAnnotationPopUp(!displayAnnotationPopUp);
  };
  const handleAnnotationPress = () => {
    setDisplayAnnotationPopUp(!displayAnnotationPopUp);
    setDisplayAnnotation(!displayAnnotation);
  };
  const handleAnnotationSubmit = async (details, callback) => {
    setIsLoading(true);

    await imageAnnotation(details, selectedInspectionID, fileID)
      .then(onAnnotationSubmitSuccess)
      .catch(onAnnotationSubmitFail)
      .finally(() => {
        setIsLoading(false);
        setDisplayAnnotation(!displayAnnotation);
        callback();
      });
  };
  async function onAnnotationSubmitSuccess(res) {
    await get_Inspection_Details(dispatch, selectedInspectionID);
  }
  function onAnnotationSubmitFail(error, callback) {
    const { statusCode = null } = error?.response?.data;
    console.log({ error });
    callback();
    if (statusCode === 401) {
      handle_Session_Expired(statusCode, dispatch);
    }
  }
  const handleAnnotationCancel = () => {
    get_Inspection_Details(dispatch, selectedInspectionID).then();
    setDisplayAnnotation(!displayAnnotation);
  };
  //Annotation logic ends here

  const requiresMileage = inspectionFrequencyList.some(item => String(item?.categoryName || '').trim().toLowerCase() === 'odometer');
  const canSubmitInspection = isAllVehicleParts.isAllParts && (!requiresMileage || hasValidMileage);

  return (
    <NewInspectionScreen
      selectedOption={selectedOption}
      modalVisible={modalVisible}
      handleModalVisible={handleModalVisible}
      source={modalDetails?.source}
      instructionalText={modalDetails?.instructionalText}
      buttonText={modalDetails?.buttonText}
      title={modalDetails?.title}
      isVideo={modalDetails?.isVideo}
      modalKey={modalDetails?.key}
      isExterior={modalDetails?.groupType === INSPECTION.exteriorItems}
      isInterior={modalDetails?.groupType === INSPECTION.interiorItems}
      isCarVerification={modalDetails?.groupType === INSPECTION.carVerificiationItems}
      instructionalSubHeadingText={modalDetails?.instructionalSubHeadingText}
      instructionalSubHeadingText_1={modalDetails?.instructionalSubHeadingText_1}
      instructionalSubHeadingText_2={modalDetails?.instructionalSubHeadingText_2}
      handleItemPickerPress={handleItemPickerPress}
      handleCaptureNowPress={handleCaptureNowPress}
      carVerificiationItems={carVerificiationItems}
      interiorItems={interiorItems}
      exteriorItems={exteriorItems}
      tires={tires}
      isBothCarVerificationImagesAvailable={isAllVehicleParts.isAllCarVerification}
      isAllInteriorImagesAvailable={isAllVehicleParts.isAllInterior}
      isAllExteriorImagesAvailable={isAllVehicleParts.isAllExterior}
      isBothTiresImagesAvailable={isAllVehicleParts.isAllTires}
      isVehicleAllPartsImagesAvailable={canSubmitInspection}
      handleSubmitPress={handleSubmitPress}
      isLoading={isLoading}
      handleMediaModalDetailsPress={handleMediaModalDetailsPress}
      handleMediaModalDetailsCrossPress={handleMediaModalDetailsCrossPress}
      mediaModalDetails={mediaModalDetails}
      mediaModalVisible={mediaModalVisible}
      onYesPress={handleYesPress}
      onNoPress={handleNoPress}
      isDiscardInspectionModalVisible={isDiscardInspectionModalVisible}
      handleOnCrossPress={handleOnCrossPress}
      handleBackPress={handleBackPress}
      isLicenseModalVisible={isLicenseModalVisible}
      handleConfirmModalVisible={handleConfirmModalVisible}
      handleConfirmVehicleDetail={handleConfirmVehicleDetail}
      plateNumber={plateNumber}
      errorTitle={errorTitle}
      handleYesPressOfInProgressInspection={handleYesPressOfInProgressInspection}
      isInspectionInProgressModalVisible={isInspectionInProgressModalVisible}
      inUseErrorTitle={inUseErrorTitle}
      isInspectionExpired={isInspectionExpired}
      handleExpiredInspectionPress={handleExpiredInspectionPress}
      handleCardExpansion={handleCardExpansion}
      /*skipLeft={skipLeft}
      skipLeftCorners={skipLeftCorners}
      skipRight={skipRight}
      skipRightCorners={skipRightCorners}*/
      displayTires={displayTires}
      loadingIndicator={loadingIndicator}
      displayAnnotationPopUp={displayAnnotationPopUp}
      handleSkipPress={handleSkipPress}
      handleAnnotatePress={handleAnnotationPress}
      displayAnnotation={displayAnnotation}
      handleAnnotationSubmit={handleAnnotationSubmit}
      handleAnnotationCancel={handleAnnotationCancel}
      annotationModalDetails={annotationModalDetails}
      isLicensePlateUploaded={isLicensePlateUploaded}
      ActiveExteriorItemsExpandedCard={ActiveExteriorItemsExpandedCard}
      vehicle_Type={shouldAnnotate}
      ActiveInteriorItemsExpandedCard={ActiveInteriorItemsExpandedCard}
      coordinates={mediaModalDetails?.coordinates?.coordinateArray || []}
      displayInstructions={vehicle_Type === 'new'}
      imageDimensions={imageDimensions}
      interiorItemsConfig={interiorItemsConfig}
      exteriorItemsConfig={exteriorItemsConfig}
      tiresItemsConfig={tiresItemsConfig}
    />
  );
};

export default NewInspectionContainer;
