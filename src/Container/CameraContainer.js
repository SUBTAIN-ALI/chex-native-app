import { useIsFocused } from '@react-navigation/native';

import React, { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Platform, StatusBar, StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import FastImage from 'react-native-fast-image';
import ImagePicker from 'react-native-image-crop-picker';
import { heightPercentageToDP as hp, widthPercentageToDP as wp } from 'react-native-responsive-screen';
import { Camera, useCameraDevice, useCameraFormat } from 'react-native-vision-camera';
import { useDispatch, useSelector } from 'react-redux';

import { BackArrow } from '../Assets/Icons';
import { getVehicleFrames } from '../Assets/Images';
import { colors, PreviewStyles } from '../Assets/Styles';
import {CameraFooter, CameraPreview, CaptureImageModal, DiscardInspectionModal, ExpiredInspectionModal, OdometerGuidanceModal} from '../Components';
import {
  darkImageError,
  HARDWARE_BACK_PRESS,
  INSPECTION,
  IS_BACK_CAMERA,
  PHYSICAL_DEVICES,
  S3_BUCKET_BASEURL,
  SWITCH_CAMERA,
  uploadFailed,
  VEHICLE_TYPES,
  VEHICLE_TYPES_WITH_FRAMES,
} from '../Constants';
import { ROUTES, TABS } from '../Navigation/ROUTES';
import {
  clearInspectionImages,
  getMileage,
  setImageDimensions,
  setLicensePlateModalVisible,
  setLicensePlateNumber,
  setOdometerModalVisible,
  setVinModalVisible,
  updateVehicleImage,
} from '../Store/Actions';
import {
  checkRelevantType,
  exteriorVariant,
  fixImageOrientation,
  getCurrentDate,
  getSignedUrl,
  handle_Session_Expired,
  handleNewInspectionPress,
  hasCameraAndMicrophoneAllowed,
  isNotEmpty,
  newInspectionUploadError,
  uploadFile,
} from '../Utils';
import { navigateBackWithParams, styleMapping, switchFrameIcon, switchOrientation } from '../Utils/helpers';
import { useTranslation } from 'react-i18next';
import autoResizeAndCrop from '../Components/ItemPicker/AutoResizeAndCrop';

const { white } = colors;
const defaultOrientation = 'portrait';
const { container, headerContainer } = PreviewStyles;

const { NEW_INSPECTION } = ROUTES;
const isUploadFailedInitialState = { visible: false, title: '', message: '' };

const CameraContainer = ({ route, navigation }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { goBack, canGoBack } = navigation;
  const {
    user: { token, data },
  } = useSelector(state => state?.auth);
  const inspectionScreen = route?.params?.returnToParams?.isLicensePlateCapture || route?.params?.returnToParams?.isMileageCapture || route?.params?.returnToParams?.isVinCapture || false;
  const {
    vehicle_Type,
    variant,
    selectedVehicleKind,
    selectedInspectionID,
    isShowOdometerModal,
    isShowLicensePlateModal,
    isShowVinModal,
  } = useSelector(state => state.newInspection);
  const isFocused = useIsFocused();
  const cameraRef = useRef(null);
  const appState = useRef(AppState.currentState);
  const [selectedCamera, setSelectedCamera] = useState('back');
  const device = useCameraDevice(selectedCamera, {
    physicalDevices: PHYSICAL_DEVICES,
  });
  const [isBackCamera, setIsBackCamera] = useState(IS_BACK_CAMERA[selectedCamera]);
  const [isImageURL, setIsImageURL] = useState('');
  const [isImageFile, setIsImageFile] = useState({});
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isExpiryInspectionVisible, setIsExpiryInspectionVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [isWaitingForConnection, setIsWaitingForConnection] = useState(false);
  const isUploadCancelled = useRef(false);
  const [isUploadFailed, setIsUploadFailed] = useState(isUploadFailedInitialState);
  const { type, modalDetails, inspectionId } = route.params;
  const format = useCameraFormat(device, [{ videoResolution: { width: 1280, height: 720 }, photoResolution: { width: 1280, height: 720 } }, { fps: 60 }]);
  const [isLoading, setIsLoading] = useState(false);
  const [orientation, setOrientation] = useState(defaultOrientation);
  const [isGuidanceModalVisible, setIsGuidanceModalVisible] = useState(true);
  const { category, subCategory, instructionalText, source, title, isVideo, groupType, afterFileUploadNavigationParams,categoryId,companyConfigId } = modalDetails;
  const routeType = route?.params?.type;
  const isOdometerScreen = routeType === 'odometer';
  const isLicensePlateScreen = routeType === 'licensePlate';
  const isVinScreen = routeType === 'vin';
  const isGuidanceTypeScreen = isOdometerScreen || isLicensePlateScreen || isVinScreen;
  const shouldSkipGuidanceModal =
    (isOdometerScreen && isShowOdometerModal) ||
    (isLicensePlateScreen && isShowLicensePlateModal) ||
    (isVinScreen && isShowVinModal);
  const shouldShowGuidanceModal = isGuidanceTypeScreen && !shouldSkipGuidanceModal && isGuidanceModalVisible;

  const frameStyles = {
    portrait: {
      ...styles.portraitFrame,
      ...styleMapping[orientation][subCategory],
    },
    landscape: {
      ...styles.landscapeFrame,
      ...styleMapping[orientation][subCategory],
      ...(selectedVehicleKind == 'sedan' && styles.sedanLandscape),
      ...(((selectedVehicleKind == 'sedan' && subCategory == 'exterior_front') || subCategory == 'exterior_rear') &&
        styles.sedanFrontBackInLandscape),
    },
  };
  const activeFrameStyle = frameStyles[orientation];
  const frameUri = getVehicleFrames(selectedVehicleKind)?.[orientation]?.[subCategory] || '';
  const RightIcon = switchFrameIcon[orientation];
  const haveFrame = isNotEmpty(frameUri) && VEHICLE_TYPES_WITH_FRAMES.includes(selectedVehicleKind);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
      resetAllStates();
    };
  }, []);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(HARDWARE_BACK_PRESS, handle_Hardware_Back_Press);
    return () => backHandler.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isImageURL]);

  useEffect(() => {
    setSelectedCamera(SWITCH_CAMERA[isBackCamera]);
  }, [isBackCamera, device]);

  useEffect(() => {
    if (isGuidanceTypeScreen && !shouldSkipGuidanceModal) {
      setIsGuidanceModalVisible(true);
    } else {
      setIsGuidanceModalVisible(false);
    }
  }, [isGuidanceTypeScreen, shouldSkipGuidanceModal]);

  function resetAllStates() {
    isUploadCancelled.current = true;
    setIsImageURL('');
    setIsImageFile({});
    setIsModalVisible(false);
    setProgress(0);
    setRetryAttempt(0);
    setIsWaitingForConnection(false);
    setIsExpiryInspectionVisible(false);
    setOrientation(defaultOrientation);
    setIsUploadFailed(isUploadFailedInitialState);
  }

  const uploadOptions = {
    onRetry: attempt => setRetryAttempt(attempt),
    onWaitingForConnection: isWaiting => setIsWaitingForConnection(isWaiting),
    isCancelled: () => isUploadCancelled.current,
  };

  function handle_Hardware_Back_Press() {
    if (isImageURL) {
      handleRetryPress();
      return true;
    } else if (route?.params?.returnTo) {
      if (route?.params?.returnTo === ROUTES.DVIR_INSPECTION_CHECKLIST) { navigation.popTo(ROUTES.DVIR_INSPECTION_CHECKLIST); }
      else if (route?.params?.returnTo === ROUTES.NEW_INSPECTION) { navigation.popTo(ROUTES.NEW_INSPECTION); }
      else { navigation.popTo(ROUTES.TABS, { name: route.params.returnTo }); }
      return true;
    } else if (route?.params?.prevScreen === ROUTES.DVIR_INSPECTION_CHECKLIST && selectedVehicleKind == VEHICLE_TYPES.TRUCK) {
      navigation.goBack();
      return true;
    } else if (canGoBack()) {
      navigation.popTo(NEW_INSPECTION);
      return true;
    }
    return false;
  }

  const handleNavigationBackPress = () => goBack();

  const handleSwitchCamera = () => setIsBackCamera(!isBackCamera);
  const handleDismissOdometerModal = (isChecked = false) => {
    if (isChecked) {
      handleDoNotShowOdometerModal();
    } else {
      setIsGuidanceModalVisible(false);
    }
  };
  const handleDoNotShowOdometerModal = () => {
    if (isOdometerScreen) {
      dispatch(setOdometerModalVisible(true));
    } else if (isLicensePlateScreen) {
      dispatch(setLicensePlateModalVisible(true));
    } else if (isVinScreen) {
      dispatch(setVinModalVisible(true));
    }
    setIsGuidanceModalVisible(false);
  };

  // const handleCaptureNowPress = async () => {
  //   hasCameraAndMicrophoneAllowed().then();
  //   if (cameraRef.current) {
  //     let file = await cameraRef?.current?.takePhoto();
  //     const filePath = `file://${file.path}`;
  //     setIsImageFile(file);
  //     dispatch(setImageDimensions(file));
  //     setIsImageURL(filePath);
  //   }
  // };
  const handleCaptureNowPress = async () => {
    try {
      await hasCameraAndMicrophoneAllowed();

      if (!cameraRef.current) { return; }

      const photo = await cameraRef.current.takePhoto();

      if (inspectionScreen) {
        const cropped = await autoResizeAndCrop(photo);

        setIsImageFile(cropped);
        dispatch(setImageDimensions(cropped));
        setIsImageURL(cropped.uri);
      } else {
        const filePath = `file://${photo.path}`;
        setIsImageFile(photo);
        dispatch(setImageDimensions(photo));
        setIsImageURL(filePath);
      }

    } catch (e) {
      console.log('Capture error:', e);
    }
  };


  const handleRetryPress = () => {
    isUploadCancelled.current = true;
    setRetryAttempt(0);
    setIsWaitingForConnection(false);
    setIsImageURL('');
    setIsImageFile({});
  };
  const handleResponse = async key => {
    const haveType = checkRelevantType(groupType);
    let extension = isImageFile.path.split('.').pop() || 'jpeg';
    const mime = 'image/' + extension;
    let body = {
      category: subCategory,
      url: key,
      extension: mime,
      groupType: groupType,
      dateImage: getCurrentDate(),
      hasAdded: vehicle_Type,
      categoryId: categoryId || null,
      companyConfigId:companyConfigId || null,
    };
    if (haveType) {
      body = { ...body, variant: variant };
    }
    const image_url = `${S3_BUCKET_BASEURL}${key}`;

    // if (category === 'CarVerification' && type === 'licensePlate') {
    //   await handleExtractNumberPlate(image_url);
    // }
    // if (category === 'CarVerification' && type === 'odometer') {
    //   try {
    //     dispatch(getMileage(image_url));
    //   } catch (error) {
    //     throw error;
    //   }
    // }

    // If returnTo is present, navigate to the target screen with the captured image
    if (route?.params?.returnTo) {
      const targetScreen = route.params.returnTo;
      const navParams = {
        capturedImageUri: image_url,
        capturedImageMime: extension,
        capturedImageS3Key: key,
        ...route?.params?.returnToParams,
      };
      if (targetScreen == ROUTES.VEHICLE_INFORMATION) {
        navigation.popTo(ROUTES.TABS, { screen: TABS.INSPECTION, params: { screen: ROUTES.VEHICLE_INFORMATION, params: navParams } });
      } else if (targetScreen == ROUTES.DVIR_INSPECTION_CHECKLIST) {
        navigation.popTo(ROUTES.DVIR_INSPECTION_CHECKLIST, navParams);
      } else if (targetScreen == ROUTES.NEW_INSPECTION) {
        navigation.popTo(ROUTES.NEW_INSPECTION, navParams);
      }

      return;
    }

    try {
      await uploadFile(c => uploadImageToStore(c, image_url), body, inspectionId, token, handleError, dispatch, uploadOptions);
    } catch (error) {
      console.log('handleResponse error:', error);
      onUploadFailed(error);
    }
  };

  function onUploadFailed(error) {
    setRetryAttempt(0);
    setIsWaitingForConnection(false);
    if (isUploadCancelled.current) {
      return;
    }
    const { statusCode = null } = error?.response?.data || {};
    const { message } = error;
    const { title = uploadFailed.title, message: msg = uploadFailed.message } = newInspectionUploadError(statusCode || '');
    let body = { visible: true, title, message: msg };
    const isDarkImage = message === darkImageError.message;
    const message_ = isDarkImage ? message : uploadFailed.message;
    setIsModalVisible(false);

    if (isDarkImage) {
      body = { ...body, message: message_ };
      setIsUploadFailed(body);
    } else if (statusCode === 401) {
      handle_Session_Expired(statusCode, dispatch);
    } else if (statusCode === 403) {
      console.log('Error, Why The Inspection Expired Modal Displaying: ', error?.response?.data);
      handleError(true);
    } else {
      setIsUploadFailed(body);
    }
  }

  function uploadImageToStore(imageID, image_url) {
    const isLicensePlate = category === 'CarVerification' && type === 'licensePlate';
    const isOdometer = category === 'CarVerification' && type === 'odometer';
    const types = ['Interior', 'Exterior'];
    const haveType = types.includes(category);
    const annotationDetails = { uri: isImageURL };
    let type_ = type;
    if (haveType) {
      type_ = exteriorVariant(type_, variant);
    }
    const displayAnnotation = haveType && vehicle_Type === 'new';
    dispatch(updateVehicleImage(groupType, type_, isImageURL, imageID));
    const params = {
      isLicensePlate: isLicensePlate,
      isOdometer: isOdometer,
      displayAnnotation: displayAnnotation,
      fileId: imageID,
      annotationDetails: annotationDetails,
      is_Exterior: haveType,
    };
    if (route?.params?.prevScreen === ROUTES.DVIR_INSPECTION_CHECKLIST && (selectedVehicleKind === 'dvir-truck' || selectedVehicleKind === 'regular-truck' || selectedVehicleKind === 'truck')) {
      navigation.popTo(ROUTES.DVIR_INSPECTION_CHECKLIST, { afterFileUploadImageUrl: image_url, fileId: imageID, ...afterFileUploadNavigationParams });
    } else {
      navigation.popTo(NEW_INSPECTION, params);
    }
  }

  // const handleExtractNumberPlate = async imageUrl => {
  //   dispatch(setLicensePlateNumber(imageUrl));
  // };

  const handleError = (inspectionDeleted = false) => {
    setIsUploadFailed(isUploadFailedInitialState);
    setRetryAttempt(0);
    setIsWaitingForConnection(false);
    if (inspectionDeleted === true) {
      setIsExpiryInspectionVisible(true);
    } else {
      setProgress(0);
    }
  };

  const handleNextPress = async () => {
    let extension = isImageFile.path.split('.').pop() || 'jpeg';
    const mime = 'image/' + extension;
    setIsModalVisible(true);
    isUploadCancelled.current = false;
    setRetryAttempt(0);
    setIsWaitingForConnection(false);
    const normalizedPath = Platform.OS === 'ios' ? await fixImageOrientation(isImageFile.path) : isImageFile.path;

    try {
      await getSignedUrl(
        token,
        mime,
        normalizedPath,
        setProgress,
        handleResponse,
        handleError,
        dispatch,
        selectedInspectionID,
        subCategory,
        variant || 0,
        'app',
        data?.companyId,
        category,
        uploadOptions
      );
      setRetryAttempt(0);
      setIsWaitingForConnection(false);
    } catch (error) {
      onUploadFailed(error);
    }
  };

  function onRetryPress() {
    handleError(false);
  }

  const onNewInspectionPress = async () => {
    await handleNewInspectionPress(dispatch, setIsLoading, data?.companyId, navigation, resetAllStates)
      .then(() => {
        dispatch(clearInspectionImages());
      })
      .catch(error => console.log(error))
      .finally(() => setIsLoading(false));
  };

  const handleExitPress = () => {
    resetAllStates();
    navigation.popTo(TABS.HOME, { screen: ROUTES.VEHICLE_INFORMATION });
  };

  const handleOnRightIconPress = () => setOrientation(prevState => switchOrientation[prevState]);

  const handleImagePicker = () => {
    ImagePicker.openPicker({
      width: 300,
      height: 400,
      cropping: true,
      // includeBase64: true,
    })
      .then(image => {
        const { sourceURL, path } = image;
        setIsImageFile(image);
        setIsImageURL(sourceURL || path);
      })
      .catch(error => console.log(error.code));
  };

  let resizeMode = 'stretch';
  if (orientation == 'landscape' || selectedVehicleKind == 'sedan') { resizeMode = 'contain'; }
  return (
    <>
      {isModalVisible && (
        <CaptureImageModal
          isLoading={true}
          isVideo={isVideo}
          instructionalText={instructionalText}
          source={source ? source : { uri: isImageURL }}
          title={title}
          progress={progress}
          retryAttempt={retryAttempt}
          isWaitingForConnection={isWaitingForConnection}
          handleNavigationBackPress={handleNavigationBackPress}
          isExterior={checkRelevantType(groupType)}
          isCarVerification={groupType === INSPECTION.carVerificiationItems}
          // handleVisible={handleVisible}
          inspectionScreen={inspectionScreen}
        />
      )}
      {isImageURL ? (
        <CameraPreview
          handleNavigationBackPress={handleNavigationBackPress}
          handleRetryPress={handleRetryPress}
          handleNextPress={handleNextPress}
          isImageURL={isImageURL}
          orientation={isImageFile?.orientation}
          inspectionScreen={inspectionScreen}
        />
      ) : (
        <View style={container}>
          {isImageURL ? (
            <FastImage priority={'normal'} resizeMode={'stretch'} style={[StyleSheet.absoluteFill, { borderRadius: 25 }]} source={{ uri: isImageURL }} />
          ) : (
            selectedCamera && (
              inspectionScreen ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  {haveFrame && (
                    <View style={styles.frameContainer}>
                      <FastImage resizeMode={resizeMode} priority={'high'} style={activeFrameStyle} source={frameUri} />
                    </View>
                  )}
                  <View style={styles.captureInstructionBox}>
                    <Text style={styles.captureInstructionText} numberOfLines={2}>
                      {t('common.captureImageInstruction')}
                    </Text>
                  </View>
                  <View style={{ height: hp('25%'), width: wp('100%'), overflow: 'hidden' }}>
                    <Camera
                      ref={cameraRef}
                      style={StyleSheet.absoluteFill}
                      device={device}
                      photo={true}
                      audio={false}
                      isActive={isFocused && appState.current === 'active'}
                      enableZoomGesture={true}
                      includeBase64={true}
                      format={format}
                    />
                  </View>
                </View>
              ) : (
                <>
                  {haveFrame && (
                    <View style={styles.frameContainer}>
                      <FastImage resizeMode={resizeMode} priority={'high'} style={activeFrameStyle} source={frameUri} />
                    </View>
                  )}
                  <Camera
                    ref={cameraRef}
                    style={StyleSheet.absoluteFill}
                    device={device}
                    photo={true}
                    audio={false}
                    isActive={isFocused && appState.current === 'active'}
                    enableZoomGesture={true}
                    includeBase64={true}
                    format={format}
                  />
                </>
              )
            )
          )}
          <View
            style={{
              ...headerContainer,
              zIndex: 19,
              ...(inspectionScreen
                ? { position: 'absolute', marginTop: '10%' }
                : {}),
            }}
          >
            <TouchableOpacity onPress={handleNavigationBackPress}>
              <BackArrow height={hp('8%')} width={wp('8%')} color={white} />
            </TouchableOpacity>
          </View>

          <CameraFooter
            isCamera={true}
            handleSwitchCamera={handleSwitchCamera}
            handleCaptureNowPress={handleCaptureNowPress}
            RightIcon={RightIcon}
            onRightIconPress={handleOnRightIconPress}
            displayFrame={haveFrame}
            handleImagePicker={handleImagePicker}
          />
        </View>
      )}
      {isExpiryInspectionVisible && (
        <ExpiredInspectionModal
          onConfirmPress={onNewInspectionPress}
          onCancelPress={handleExitPress}
          visible={true}
          isLoading={isLoading}
          confirmButtonText={t('expiryInspection.confirmButton')}
        />
      )}
      {isUploadFailed.visible && (
        <DiscardInspectionModal
          onYesPress={onRetryPress}
          title={isUploadFailed.title}
          description={isUploadFailed.message}
          yesButtonText={t('common.retry')}
          dualButton={false}
          onNoPress={undefined}
          noButtonText={undefined}
          noButtonStyle={undefined}
        />
      )}
      <OdometerGuidanceModal
        visible={shouldShowGuidanceModal}
        onClose={handleDismissOdometerModal}
        videoSource={
          isLicensePlateScreen
            ? require('../Assets/Videos/Car_Number_Plate_Capture_Demo.mp4')
            : isVinScreen
              ? require('../Assets/Videos/VIN_Capture_Demo_Video.mp4')
              : require('../Assets/Videos/Realistic_Car_Odometer_Capture_Demo.mp4')
        }
        titleKey={
          isLicensePlateScreen
            ? 'licensePlateGuidance.title'
            : isVinScreen
              ? 'vinGuidance.title'
              : 'odometerGuidance.title'
        }
        descriptionKey={
          isLicensePlateScreen
            ? 'licensePlateGuidance.description'
            : isVinScreen
              ? 'vinGuidance.description'
              : 'odometerGuidance.description'
        }
        doNotShowAgainKey={
          isLicensePlateScreen
            ? 'licensePlateGuidance.doNotShowAgain'
            : isVinScreen
              ? 'vinGuidance.doNotShowAgain'
              : 'odometerGuidance.doNotShowAgain'
        }
      />

      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent={true} />
    </>
  );
};
const styles = StyleSheet.create({
  captureInstructionBox: {
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('0.8%'),
    marginBottom: hp('0.5%'),
    alignSelf: 'center',
    maxWidth: wp('90%'),
  },
  captureInstructionText: {
    color: white,
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.95,
  },
  frameContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 19,
  },
  landscapeFrame: {
    height: hp('30%'),
    transform: [{ scale: 1.5 }, { rotate: '-90deg' }],
  },
  portraitFrame: {
    width: wp('95%'),
  },
  sedanLandscape: {
    minWidth: wp('100%'),
  },
  sedanFrontBackInLandscape: {
    minWidth: wp('80%'),
  },
});
export default CameraContainer;
