import { Alert, Platform } from 'react-native';
import { Camera } from 'react-native-vision-camera';
import { PERMISSIONS, request, RESULTS } from 'react-native-permissions';
import ReactNativeBlobUtil from 'react-native-blob-util';
import * as yup from 'yup';

import { IMAGES } from '../Assets/Images';
import { customSortOrder, darkImageError, INSPECTION, INSPECTION_SUBCATEGORY, S3_BUCKET_BASEURL, S3_UPLOAD_TIMEOUT, uploadFailed, VEHICLE_TYPES } from '../Constants';
import { ROUTES, TABS } from '../Navigation/ROUTES';
import { getInspectionDetails, isImageDarkWithAI, s3SignedUrl, uploadFileToDatabase } from '../services/inspection';
import { store } from '../Store';
import { batchUpdateVehicleImages, numberPlateSelected, sessionExpired, setCompanyId } from '../Store/Actions';
import { setFileDetails, setVehicleTypeModalVisible } from '../Store/Actions/NewInspectionAction';
import { checkAndCompleteUrl } from './helpers';
import { assertUploadResponseOk, isExpiredSignatureError, isRetryableError, markNonRetryable, withRetry } from './retry';
import imageResizer from '@bam.tech/react-native-image-resizer';
import i18n from 'i18next';

// Validation Schema
export const validationSchema = yup.object().shape({
  firstName: yup.string().required(() => i18n.t('validation.fieldRequired')),
  lastName: yup.string().required(() => i18n.t('validation.fieldRequired')),
  email: yup
    .string()
    .email(() => i18n.t('validation.emailValid'))
    .required(() => i18n.t('validation.emailRequired'))
    .matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, () => i18n.t('validation.emailInvalidFormat')),
  phoneNumber: yup
    .string()
    .matches(/^[0-9]{11}$/, () => i18n.t('validation.phoneNumberValid'))
    .required(() => i18n.t('validation.phoneNumberRequired')),
  password: yup
    .string()
    .min(6, () => i18n.t('validation.passwordMinLength8'))
    .required(() => i18n.t('validation.passwordRequired')),
});
export const signInValidationSchema = yup.object().shape({
  name: yup
    .string()
    .required(() => i18n.t('validation.firstNameRequired'))
    .min(2, () => i18n.t('validation.nameMinLength')),
  password: yup
    .string()
    .min(1, () => i18n.t('validation.passwordMinLength1'))
    .required(() => i18n.t('validation.passwordRequired')),
});
export const forgetPasswordSchema = yup.object().shape({
  email: yup
    .string()
    .required(() => i18n.t('validation.emailRequired'))
    .min(2, () => i18n.t('validation.emailMinLength'))
    .email(() => i18n.t('validation.emailInvalidAddress')),
});
export const resetPasswordSchema = yup.object().shape({
  verificationCode: yup
    .string()
    .min(6, () => i18n.t('validation.verificationCodeMinLength'))
    .required(() => i18n.t('validation.verificationCodeRequired')),
  password: yup
    .string()
    .required(() => i18n.t('validation.newPasswordRequired'))
    .min(6, () => i18n.t('validation.passwordMinLength')),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password'), null], () => i18n.t('validation.passwordsMustMatch'))
    .required(() => i18n.t('validation.confirmPasswordRequired')),
});
//New Inspection Objects starts here
//____________________________Car Verification_________________________
export const LicensePlateDetails = {
  key: 'licensePlate',
  get title() { return i18n.t('carVerification.licensePlate.title'); },
  source: IMAGES.license_Plate,
  get instructionalText() { return i18n.t('carVerification.licensePlate.instruction'); },
  instructionalSubHeadingText: '',
  category: 'CarVerification',
  subCategory: 'license_plate_number',
  groupType: INSPECTION.carVerificiationItems,
  get buttonText() { return i18n.t('carVerification.licensePlate.captureNow'); },
};
export const OdometerDetails = {
  key: 'odometer',
  get title() { return i18n.t('carVerification.odometer.title'); },
  source: IMAGES.odometer,
  get instructionalText() { return i18n.t('carVerification.odometer.instruction'); },
  // instructionalSubHeadingText: 'Vehicle mileage',
  instructionalSubHeadingText: '',
  category: 'CarVerification',
  subCategory: 'odometer',
  groupType: INSPECTION.carVerificiationItems,
  get buttonText() { return i18n.t('carVerification.odometer.captureNow'); },
};

export const VinDetails = {
  key: 'vin',
  get title() { return i18n.t('carVerification.vin.title'); },
  type: '1',
  source: '',
  category: 'CarVerification',
  subCategory: 'vin',
  groupType: 'truck',
  get instructionalText() { return i18n.t('carVerification.vin.instruction'); },
  get buttonText() { return i18n.t('carVerification.vin.captureNow'); },
};
//___________________________Exterior______________________________
export const ExteriorFrontDetails = vehicleType => ({
  key: 'exteriorFront',
  get title() { return i18n.t('exteriorItems.front.title'); },
  source:
    vehicleType === VEHICLE_TYPES.SEDAN
      ? IMAGES.sedan_exterior_front
      : vehicleType === VEHICLE_TYPES.TRUCK
        ? IMAGES.truck_exterior_front
        : IMAGES.exterior_Front,
  get instructionalText() { return i18n.t('exteriorItems.front.instruction'); },
  instructionalSubHeadingText: '',
  get buttonText() { return i18n.t('exteriorItems.captureNow'); },
  category: 'Exterior',
  subCategory: 'exterior_front',
  groupType: INSPECTION.exteriorItems,
  isVideo: false,
});

export const ExteriorRearDetails = vehicleType => ({
  key: 'exteriorRear',
  get title() { return i18n.t('exteriorItems.rear.title'); },
  source:
    vehicleType === VEHICLE_TYPES.SEDAN
      ? IMAGES.sedan_exterior_rear
      : vehicleType === VEHICLE_TYPES.TRUCK
        ? IMAGES.truck_exterior_rear_back
        : IMAGES.exterior_Rear,
  get instructionalText() { return i18n.t('exteriorItems.rear.instruction'); },
  instructionalSubHeadingText: '',
  get buttonText() { return i18n.t('exteriorItems.captureNow'); },
  category: 'Exterior',
  subCategory: 'exterior_rear',
  groupType: INSPECTION.exteriorItems,
  isVideo: false,
});

export const ExteriorLeftDetails = {
  key: 'exteriorLeft',
  get title() { return i18n.t('exteriorItems.left.title'); },
  source: IMAGES.exterior_Left,
  get instructionalText() { return i18n.t('exteriorItems.left.instruction'); },
  instructionalSubHeadingText: '',
  get buttonText() { return i18n.t('exteriorItems.captureNow'); },
  category: 'Exterior',
  subCategory: 'exterior_left',
  groupType: INSPECTION.exteriorItems,
  isVideo: false,
};

export const ExteriorRightDetails = {
  key: 'exteriorRight',
  get title() { return i18n.t('exteriorItems.right.title'); },
  source: IMAGES.exterior_Right,
  get instructionalText() { return i18n.t('exteriorItems.right.instruction'); },
  instructionalSubHeadingText: '',
  get buttonText() { return i18n.t('exteriorItems.captureNow'); },
  category: 'Exterior',
  subCategory: 'exterior_right',
  groupType: INSPECTION.exteriorItems,
  isVideo: false,
};

export const ExteriorFrontLeftCornerDetails = vehicleType => ({
  key: 'exteriorFrontLeftCorner',
  get title() { return i18n.t('exteriorItems.frontLeftCorner.title'); },
  source:
    vehicleType === VEHICLE_TYPES.SEDAN
      ? IMAGES.sedan_exterior_front_Left
      : vehicleType === VEHICLE_TYPES.TRUCK
        ? IMAGES.truck_exterior_front_Left
        : IMAGES.front_Left_Corner,
  get instructionalText() { return i18n.t('exteriorItems.frontLeftCorner.instruction'); },
  instructionalSubHeadingText: '',
  get buttonText() { return i18n.t('exteriorItems.captureNow'); },
  category: 'Exterior',
  subCategory: 'front_left_corner',
  groupType: INSPECTION.exteriorItems,
  isVideo: false,
});

export const ExteriorFrontRightCornerDetails = vehicleType => ({
  key: 'exteriorFrontRightCorner',
  get title() { return i18n.t('exteriorItems.frontRightCorner.title'); },
  source:
    vehicleType === VEHICLE_TYPES.SEDAN
      ? IMAGES.sedan_exterior_front_Right
      : vehicleType === VEHICLE_TYPES.TRUCK
        ? IMAGES.truck_exterior_front_right
        : IMAGES.front_Right_Corner,
  get instructionalText() { return i18n.t('exteriorItems.frontRightCorner.instruction'); },
  instructionalSubHeadingText: '',
  get buttonText() { return i18n.t('exteriorItems.captureNow'); },
  category: 'Exterior',
  subCategory: 'front_right_corner',
  groupType: INSPECTION.exteriorItems,
  isVideo: false,
});

export const ExteriorRearLeftCornerDetails = vehicleType => ({
  key: 'exteriorRearLeftCorner',
  get title() { return i18n.t('exteriorItems.rearLeftCorner.title'); },
  source:
    vehicleType === VEHICLE_TYPES.SEDAN
      ? IMAGES.sedan_exterior_rear_left
      : vehicleType === VEHICLE_TYPES.TRUCK
        ? IMAGES.truck_exterior_rear_left
        : IMAGES.rear_Left_Corner,
  get instructionalText() { return i18n.t('exteriorItems.rearLeftCorner.instruction'); },
  instructionalSubHeadingText: '',
  get buttonText() { return i18n.t('exteriorItems.captureNow'); },
  category: 'Exterior',
  subCategory: 'rear_left_corner',
  groupType: INSPECTION.exteriorItems,
  isVideo: false,
});

export const ExteriorRearRightCornerDetails = vehicleType => ({
  key: 'exteriorRearRightCorner',
  get title() { return i18n.t('exteriorItems.rearRightCorner.title'); },
  source:
    vehicleType === VEHICLE_TYPES.SEDAN
      ? IMAGES.sedan_exterior_rear_right
      : vehicleType === VEHICLE_TYPES.TRUCK
        ? IMAGES.truck_exterior_rear_right
        : IMAGES.rear_Right_Corner,
  get instructionalText() { return i18n.t('exteriorItems.rearRightCorner.instruction'); },
  instructionalSubHeadingText: '',
  get buttonText() { return i18n.t('exteriorItems.captureNow'); },
  category: 'Exterior',
  subCategory: 'rear_right_corner',
  groupType: INSPECTION.exteriorItems,
  isVideo: false,
});

export const ExteriorInsideCargoRoofDetails = vehicleType => ({
  key: 'exteriorInsideCargoRoof',
  get title() { return i18n.t('exteriorItems.insideCargoRoof.title'); },
  source: VEHICLE_TYPES.TRUCK === vehicleType ? IMAGES.truck_interior_back : IMAGES.inside_Cargo_Roof,
  get instructionalText() { return i18n.t('exteriorItems.insideCargoRoof.instruction'); },
  instructionalSubHeadingText: '',
  get buttonText() { return i18n.t('exteriorItems.captureNow'); },
  category: 'Exterior',
  subCategory: 'inside_cargo_roof',
  groupType: INSPECTION.exteriorItems,
  isVideo: false,
});
//___________________________Interior______________________________
export const InteriorPassengerSide = {
  key: 'passengerSide',
  get title() { return i18n.t('interiorItems.passengerSide.title'); },
  source: IMAGES.interior_passenger_side,
  get instructionalText() { return i18n.t('interiorItems.passengerSide.instruction'); },
  get instructionalSubHeadingText() { return i18n.t('interiorItems.passengerSide.details.seatBelt'); },
  get buttonText() { return i18n.t('interiorItems.captureNow'); },
  category: 'Interior',
  subCategory: 'interior_passenger_side',
  groupType: INSPECTION.interiorItems,
  isVideo: false,
};
export const InteriorDriverSide = {
  key: 'driverSide',
  get title() { return i18n.t('interiorItems.driverSide.title'); },
  source: IMAGES.interior_driver_side,
  get instructionalText() { return i18n.t('interiorItems.driverSide.instruction'); },
  get instructionalSubHeadingText() { return i18n.t('interiorItems.driverSide.details.seatBelt'); },
  get instructionalSubHeadingText_1() { return i18n.t('interiorItems.driverSide.details.rearview'); },
  get instructionalSubHeadingText_2() { return i18n.t('interiorItems.driverSide.details.brakePads'); },
  get buttonText() { return i18n.t('interiorItems.captureNow'); },
  category: 'Interior',
  subCategory: 'interior_driver_side',
  groupType: INSPECTION.interiorItems,
  isVideo: false,
};
//____________________________Tires_____________________________
export const LeftFrontTireDetails = {
  key: 'leftFrontTire',
  get title() { return i18n.t('tiresItems.leftFront'); },
  source: IMAGES.tire,
  get instructionalText() { return i18n.t('tiresItems.instruction'); },
  get instructionalSubHeadingText() { return i18n.t('tiresItems.subHeading'); },
  get buttonText() { return i18n.t('tiresItems.captureNow'); },
  category: 'Tires',
  subCategory: 'left_front_tire',
  groupType: INSPECTION.tires,
  isVideo: false,
};
export const LeftRearTireDetails = {
  key: 'leftRearTire',
  get title() { return i18n.t('tiresItems.leftRear'); },
  source: IMAGES.tire,
  get instructionalText() { return i18n.t('tiresItems.instruction'); },
  get instructionalSubHeadingText() { return i18n.t('tiresItems.subHeading'); },
  get buttonText() { return i18n.t('tiresItems.captureNow'); },
  category: 'Tires',
  subCategory: 'left_rear_tire',
  groupType: INSPECTION.tires,
  isVideo: false,
};
export const RightFrontTireDetails = {
  key: 'rightFrontTire',
  get title() { return i18n.t('tiresItems.rightFront'); },
  source: IMAGES.tire,
  get instructionalText() { return i18n.t('tiresItems.instruction'); },
  get instructionalSubHeadingText() { return i18n.t('tiresItems.subHeading'); },
  get buttonText() { return i18n.t('tiresItems.captureNow'); },
  category: 'Tires',
  subCategory: 'right_front_tire',
  groupType: INSPECTION.tires,
  isVideo: false,
};
export const RightRearTireDetails = {
  key: 'rightRearTire',
  get title() { return i18n.t('tiresItems.rightRear'); },
  source: IMAGES.tire,
  get instructionalText() { return i18n.t('tiresItems.instruction'); },
  get instructionalSubHeadingText() { return i18n.t('tiresItems.subHeading'); },
  get buttonText() { return i18n.t('tiresItems.captureNow'); },
  category: 'Tires',
  subCategory: 'right_rear_tire',
  groupType: INSPECTION.tires,
  isVideo: false,
};
//New Inspection Objects starts here

export const hasCameraAndMicrophoneAllowed = async () => {
  const cameraPermission = await Camera.getCameraPermissionStatus();
  const microphonePermission = await Camera.getMicrophonePermissionStatus();
  if (cameraPermission !== 'authorized' && cameraPermission !== 'granted') {
    await Camera.requestCameraPermission();
  }
  if (microphonePermission !== 'authorized' && microphonePermission !== 'granted') {
    await Camera.requestMicrophonePermission();
  }
};

async function requestLocationPermission() {
  const permissionType = Platform.OS === 'ios' ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;
  const result = await request(permissionType);
  return result === RESULTS.GRANTED || result === RESULTS.LIMITED;
}
export function error_Handler(callback = null, title = uploadFailed.title, message = uploadFailed.message) {
  Alert.alert(title || uploadFailed.title, message || uploadFailed.message, [{ text: 'Retry', onPress: callback }]);
}
export const getSignedUrl = async (
  token,
  mime,
  path,
  setProgress,
  handleResponse,
  handleError,
  dispatch,
  inspectionId,
  categoryName,
  variant = 0,
  source = 'app',
  companyId,
  category,
  uploadOptions = {}
) => {
  const { onRetry = null, onWaitingForConnection = null, isCancelled = null } = uploadOptions;
  const requestSignedUrl = () =>
    withRetry(() => s3SignedUrl(mime, source, inspectionId, categoryName, variant, companyId), {
      onRetry,
      onWaitingForConnection,
      isCancelled,
      label: 'signed-url',
    });

  try {
    const response = await requestSignedUrl();
    await onGetSignedUrlSuccess(response, path, mime, setProgress, handleResponse, handleError, dispatch, category, {
      onRetry,
      onWaitingForConnection,
      isCancelled,
      refreshSignedUrl: requestSignedUrl,
    });
  } catch (error) {
    console.log('error', error);

    onGetSignedUrlFail(error, handleError, dispatch);
    throw error;
  }
};
async function onGetSignedUrlSuccess(res, path, mime, setProgress, handleResponse, handleError, dispatch, category, uploadOptions = {}) {
  try {
    const { url, key } = res.data;
    await uploadToS3(url, key, path, mime, setProgress, handleResponse, handleError, dispatch, category, uploadOptions);
  } catch (error) {
    throw error;
  }
}
function onGetSignedUrlFail(error, handleError, dispatch) { }

export const uploadToS3 = async (preSignedUrl, key, path, mime, setProgress, handleResponse, handleError, _, category, uploadOptions = {}) => {
  const { onRetry = null, onWaitingForConnection = null, isCancelled = null, refreshSignedUrl = null } = uploadOptions;
  let signedUrl = preSignedUrl;
  let uploadKey = key;
  let needsFreshSignedUrl = false;

  try {
    // Normalize path (strip file://)
    const normalizedPath = path.replace(/^file:\/\//, '');

    // Try to get file size (helps progress accuracy)
    let size = 0;
    try {
      const stat = await ReactNativeBlobUtil.fs.stat(normalizedPath);
      size = Number(stat.size) || 0;
    } catch (e) {
      // fs.stat may fail on some URIs (content://, ph:// etc.)
      console.warn('Could not stat file size, progress may be less accurate');
    }

    const headers = {
      'Content-Type': mime,
      ...(size ? { 'Content-Length': String(size) } : {}),
    };

    await withRetry(
      async () => {
        if (needsFreshSignedUrl && refreshSignedUrl) {
          try {
            const { url: freshUrl, key: freshKey } = (await refreshSignedUrl())?.data || {};
            if (freshUrl) {
              signedUrl = freshUrl;
              uploadKey = freshKey || uploadKey;
            }
          } catch (e) {
            console.log('Could not refresh the pre-signed url before retrying:', e?.message);
          }
          needsFreshSignedUrl = false;
        }

        const task = ReactNativeBlobUtil.config({ timeout: S3_UPLOAD_TIMEOUT }).fetch('PUT', signedUrl, headers, ReactNativeBlobUtil.wrap(path));

        // Start with 0
        setProgress(0);

        // Progress listener
        task.uploadProgress({ interval: 100 }, (written, totalFromCb) => {
          const total = totalFromCb && totalFromCb > 0 ? totalFromCb : size;
          if (total > 0) {
            const pct = Math.min(99, Math.round((written * 100) / total));
            setProgress(pct);
          }
        });

        // Wait for upload to finish
        return assertUploadResponseOk(await task);
      },
      {
        onRetry: (attempt, retries, error) => {
          needsFreshSignedUrl = isExpiredSignatureError(error);
          onRetry?.(attempt, retries, error);
        },
        shouldRetry: error => isRetryableError(error) || isExpiredSignatureError(error),
        onWaitingForConnection,
        isCancelled,
        label: 'upload-to-s3',
      }
    );

    // Force 100 at the end
    setProgress(100);

    await onUploadToS3Success(handleResponse, uploadKey, handleError, category, mime, { onRetry, onWaitingForConnection, isCancelled });
  } catch (error) {
    handleError?.(error);
    throw error;
  }
};

async function onUploadToS3Success(handleResponse, key, handleError, category, mime, uploadOptions = {}) {
  const { onRetry = null, onWaitingForConnection = null, isCancelled = null } = uploadOptions;
  const image_url = S3_BUCKET_BASEURL + key;

  try {
    if (!SKIP_NIGHT_IMAGE_LIST.includes(category) && mime !== 'video/mp4') {
      const {
        data: { status = false },
      } = await withRetry(() => isImageDarkWithAI(image_url), { onRetry, onWaitingForConnection, isCancelled, label: 'night-image-check' });

      if (!status) {
        throw markNonRetryable(new Error(darkImageError.message));
      }
    }

    handleResponse(key);
  } catch (error) {
    throw error;
  }
}

export const uploadFile = async (callback, body, inspectionId, token, handleError, dispatch, uploadOptions = {}) => {
  const { onRetry = null, onWaitingForConnection = null, isCancelled = null } = uploadOptions;

  try {
    const response = await withRetry(() => uploadFileToDatabase(inspectionId, body), {
      onRetry,
      onWaitingForConnection,
      isCancelled,
      label: 'file-record',
    });
    onUploadFileSuccess(response, callback);
  } catch (error) {
    console.log('uploadFile error:', error);
    throw error;
  }
};
function onUploadFileSuccess(res, callback) {
  const { id = null } = res?.data || {};
  callback(id);
}

export const getCurrentDate = () => {
  const currentDate = new Date();

  const day = currentDate.getDate();
  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  return `${day}-${month}-${year}`;
};
export const extractDate = dataAndTime => {
  const date = new Date(dataAndTime);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  return `${month}/${day}/${year}`;
};
export const handleHomePress = navigation => navigation?.navigate?.(ROUTES.TABS);
export const newInspectionUploadError = (statusCode = 'noStatusCode') => {
  const errors = {
    409: {
      get title() { return i18n.t('errors.duplicateImage.title'); },
      get message() { return i18n.t('errors.duplicateImage.message'); },
    },
    403: {
      get title() { return i18n.t('errors.inspectionExpired.title'); },
      get message() { return i18n.t('errors.inspectionExpired.message'); },
    },
    noStatusCode: {
      get title() { return i18n.t('errors.uploadFailed.title'); },
      get message() { return i18n.t('errors.uploadFailed.message'); },
    },
  };
  return errors[statusCode] || errors.noStatusCode;
};
export const sortInspectionReviewedItems = list => {
  function customSort(a, b) {
    const groupTypeComparison = customSortOrder.groupType.indexOf(a.groupType) - customSortOrder.groupType.indexOf(b.groupType);
    if (groupTypeComparison !== 0) {
      return groupTypeComparison;
    }

    return customSortOrder[a.groupType].indexOf(a.name) - customSortOrder[b.groupType].indexOf(b.name);
  }

  return list.sort(customSort);
};
export const updateFiles = (files = []) => {
  if (files?.length < 1) {
    return files;
  }
  const files_Updated = [];
  for (let i = 0; i < files.length; i++) {
    const variant = files[i].llamaCost || '';
    let name = files[i].category + variant;
    const data = { ...files[i], name: name };
    files_Updated.push(data);
  }
  return files_Updated;
};
export function sortImagesByOrder(list) {
  return list.sort((a, b) => {
    // Sort by groupType
    const groupTypeAIndex = customSortOrder.groupType.indexOf(a.groupType);
    const groupTypeBIndex = customSortOrder.groupType.indexOf(b.groupType);

    if (groupTypeAIndex !== groupTypeBIndex) {
      return groupTypeAIndex - groupTypeBIndex;
    }

    // Sort by category within the groupType
    const categoryAIndex = customSortOrder[a.groupType]?.indexOf(a.category);
    const categoryBIndex = customSortOrder[b.groupType]?.indexOf(b.category);

    if (categoryAIndex !== categoryBIndex) {
      return (categoryAIndex ?? Infinity) - (categoryBIndex ?? Infinity);
    }

    // Sort by llamaCost (numerically)
    const llamaCostA = a.llamaCost !== null ? parseInt(a.llamaCost, 10) : Infinity;
    const llamaCostB = b.llamaCost !== null ? parseInt(b.llamaCost, 10) : Infinity;

    return llamaCostA - llamaCostB;
  });
}
export const sortInspection_Reviewed_Items = list => {
  // Step 1: Count occurrences
  const countMap = {};
  list.forEach(item => {
    const key = `${item.groupType}-${item.category}`;
    countMap[key] = (countMap[key] || 0) + 1;
  });

  // Step 2: Sort the list based on custom order
  const sortedList = list.sort((a, b) => {
    const groupTypeComparison = customSortOrder.groupType.indexOf(a.groupType) - customSortOrder.groupType.indexOf(b.groupType);

    if (groupTypeComparison !== 0) {
      return groupTypeComparison; // Sort by groupType first
    }

    return (
      customSortOrder[a.groupType].indexOf(a.name) - customSortOrder[b.groupType].indexOf(b.name) // Sort by category second
    );
  });

  // Step 3: Flatten the sorted list based on counts
  const finalSortedList = [];
  sortedList.forEach(item => {
    const key = `${item.groupType}-${item.category}`;
    const count = countMap[key];
    for (let i = 0; i < count; i++) {
      finalSortedList.push(item);
    }
    // Delete the count to avoid duplicates in the final list
    delete countMap[key];
  });

  return finalSortedList;
};

export function uploadInProgressMediaToStore(files, dispatch) {
  // Batch all updates into a single dispatch
  const updates = files.map(file => {
    const { url, groupType, id, category, llamaCost: variant } = file;
    const { completedUrl: imageURL } = checkAndCompleteUrl(url);

    let categoryKey = category;
    if (parseInt(variant)) {
      categoryKey += '_' + variant;
    }

    return {
      groupType,
      item: INSPECTION_SUBCATEGORY[categoryKey],
      imageURL,
      id,
    };
  });

  // Dispatch a single action with all updates
  dispatch(batchUpdateVehicleImages(updates));
}
export const generateRandomString = () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const minLength = 5;
  const maxLength = 10;
  const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;

  let randomString = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    randomString += characters[randomIndex];
  }

  return randomString;
};

export const handleNewInspectionPress = (dispatch, setIsLoading, companyId, navigation, resetAllStates) => {
  // dispatch(setVehicleTypeModalVisible(true));
  navigation.navigate(ROUTES.TABS, { screen: TABS.INSPECTION });
  dispatch(setCompanyId(companyId));
  // No API call here anymore
};

export function onNewInspectionPressSuccess(response, dispatch, navigate, resetAllStates) {
  const { id = null } = response?.data || {};

  dispatch(numberPlateSelected(id));

  setTimeout(
    () => {
      navigate(ROUTES.NEW_INSPECTION, {
        routeName: ROUTES.VEHICLE_INFORMATION,
      });
    },
    Platform.OS === 'ios' ? 200 : 0
  );
}

export function onNewInspectionPressFail(err, dispatch) {
  const { statusCode = null } = err?.response?.data || {};
  if (statusCode === 401) {
    handle_Session_Expired(statusCode, dispatch);
  }
}
export function handle_Session_Expired(statusCode = null, dispatch) {
  if (statusCode === 401) {
    dispatch(sessionExpired());
  }
}
export const EXTRACT_INSPECTION_ITEM_ID = key => {
  const { carVerificiationItems: carVerification, exteriorItems: exterior, interiorItems: interior, tires } = store.getState().newInspection;
  const {
    exteriorLeftID,
    exteriorLeft_1ID,
    exteriorLeft_2ID,
    exteriorRightID,
    exteriorRight_1ID,
    exteriorRight_2ID,
    exteriorFrontID,
    exteriorFront_1ID,
    exteriorFront_2ID,
    exteriorRearID,
    exteriorRear_1ID,
    exteriorRear_2ID,
    exteriorFrontLeftCornerID,
    exteriorFrontLeftCorner_1ID,
    exteriorFrontLeftCorner_2ID,
    exteriorFrontRightCornerID,
    exteriorFrontRightCorner_1ID,
    exteriorFrontRightCorner_2ID,
    exteriorRearLeftCornerID,
    exteriorRearLeftCorner_1ID,
    exteriorRearLeftCorner_2ID,
    exteriorRearRightCornerID,
    exteriorRearRightCorner_1ID,
    exteriorRearRightCorner_2ID,
    exteriorInsideCargoRoofID,
    exteriorInsideCargoRoof_1ID,
    exteriorInsideCargoRoof_2ID,
  } = exterior;
  const { driverSideID, driverSide_1ID, driverSide_2ID, passengerSideID, passengerSide_1ID, passengerSide_2ID } = interior;
  const { licensePlateID, odometerID } = carVerification;
  const { leftFrontTireID, leftRearTireID, rightFrontTireID, rightRearTireID } = tires;
  const GET_EXTERIOR_ITEM = {
    licensePlate: licensePlateID,
    odometer: odometerID,
    exteriorFront: exteriorFrontID,
    exteriorFront_1: exteriorFront_1ID,
    exteriorFront_2: exteriorFront_2ID,
    exteriorRear: exteriorRearID,
    exteriorRear_1: exteriorRear_1ID,
    exteriorRear_2: exteriorRear_2ID,
    exteriorLeft: exteriorLeftID,
    exteriorLeft_1: exteriorLeft_1ID,
    exteriorLeft_2: exteriorLeft_2ID,
    exteriorRight: exteriorRightID,
    exteriorRight_1: exteriorRight_1ID,
    exteriorRight_2: exteriorRight_2ID,
    exteriorFrontLeftCorner: exteriorFrontLeftCornerID,
    exteriorFrontLeftCorner_1: exteriorFrontLeftCorner_1ID,
    exteriorFrontLeftCorner_2: exteriorFrontLeftCorner_2ID,
    exteriorFrontRightCorner: exteriorFrontRightCornerID,
    exteriorFrontRightCorner_1: exteriorFrontRightCorner_1ID,
    exteriorFrontRightCorner_2: exteriorFrontRightCorner_2ID,
    exteriorRearLeftCorner: exteriorRearLeftCornerID,
    exteriorRearLeftCorner_1: exteriorRearLeftCorner_1ID,
    exteriorRearLeftCorner_2: exteriorRearLeftCorner_2ID,
    exteriorRearRightCorner: exteriorRearRightCornerID,
    exteriorRearRightCorner_1: exteriorRearRightCorner_1ID,
    exteriorRearRightCorner_2: exteriorRearRightCorner_2ID,
    exteriorInsideCargoRoof: exteriorInsideCargoRoofID,
    exteriorInsideCargoRoof_1: exteriorInsideCargoRoof_1ID,
    exteriorInsideCargoRoof_2: exteriorInsideCargoRoof_2ID,
    driverSide: driverSideID,
    driverSide_1: driverSide_1ID,
    driverSide_2: driverSide_2ID,
    passengerSide: passengerSideID,
    passengerSide_1: passengerSide_1ID,
    passengerSide_2: passengerSide_2ID,
    leftFrontTire: leftFrontTireID,
    leftRearTire: leftRearTireID,
    rightFrontTire: rightFrontTireID,
    rightRearTire: rightRearTireID,
  };
  return GET_EXTERIOR_ITEM[key] || "Inspection ID doesn't exists";
};

/**
 * Checks if a value is not empty, meaning it is neither null, undefined, empty string, nor zero.
 * @param {*} value - The value to check
 * @returns {boolean} - Returns true if the value is not empty, otherwise false
 */
export const isNotEmpty = value => value !== null && value !== undefined && value !== '' && value !== 0;
export const isObjectEmpty = (object = {}) => {
  const extractValues = Object?.values(object);
  return extractValues?.includes('');
};
export const haveOneValue = (object = {}) => {
  const extractValues = Object?.values(object);
  const even = element => element !== '';

  return extractValues.some(even);
};
export const checkExterior = () => {
  const { exteriorItems: exterior } = store.getState().newInspection;
  const {
    exteriorLeftID,
    exteriorRightID,
    exteriorFrontID,
    exteriorRearID,
    exteriorFrontLeftCornerID,
    exteriorFrontRightCornerID,
    exteriorRearLeftCornerID,
    exteriorRearRightCornerID,
    exteriorInsideCargoRoofID,
  } = exterior;

  const leftCheck = isNotEmpty(exteriorLeftID) || (isNotEmpty(exteriorFrontLeftCornerID) && isNotEmpty(exteriorRearLeftCornerID));

  const rightCheck = isNotEmpty(exteriorRightID) || (isNotEmpty(exteriorFrontRightCornerID) && isNotEmpty(exteriorRearRightCornerID));
  return isNotEmpty(exteriorFrontID) && isNotEmpty(exteriorRearID) && isNotEmpty(exteriorInsideCargoRoofID) && leftCheck && rightCheck;
};
export const FILTER_IMAGES = (arr = [], toFilter = 'before') => {
  const { carVerificiationItems, exteriorItems, interiorItems, tires } = INSPECTION;
  if (!Array.isArray(arr)) {
    return;
  }
  if (toFilter === 'before') {
    return arr.filter(item => item?.pictureTag === toFilter);
  } else {
    return arr.filter(item => {
      const { groupType, pictureTag } = item;
      if (groupType === carVerificiationItems || groupType === tires) {
        return item;
      } else if ((groupType === exteriorItems || groupType === interiorItems) && pictureTag === toFilter) {
        return item;
      }
    });
  }
};
export function extractIDs(obj) {
  const idsArray = [];

  for (const key in obj) {
    if (obj.hasOwnProperty(key) && key.includes('ID')) {
      if (isNotEmpty(obj[key])) {
        idsArray.push(obj[key]);
      }
    }
  }
  return idsArray;
}
export function exteriorVariant(item, variant) {
  if (variant === 0) {
    return item;
  }
  return item + '_' + variant;
}
export const get_Inspection_Details = async (dispatch, inspectionId) => {
  await getInspectionDetails(inspectionId)
    .then(res => onGet_Inspection_DetailsSuccess(res, dispatch))
    .catch(error => onGet_Inspection_DetailsFail(error, dispatch));
};
function onGet_Inspection_DetailsSuccess(res, dispatch) {
  const { files = {} } = res?.data || {};
  dispatch(setFileDetails(files));
}
function onGet_Inspection_DetailsFail(error, dispatch) {
  const { statusCode = null } = error?.response?.data || {};
  if (statusCode === 401) {
    handle_Session_Expired(statusCode, dispatch);
  }
  console.log('error onGet_Inspection_DetailsFail => ', error.response.data);
}
export const getAnnotationStatus = (files = [], id = '') => {
  if (!isNotEmpty(files) || !isNotEmpty(id)) {
    return false;
  }
  for (let i = 0; i < files.length; i++) {
    const checkById = id === files[i].id && isNotEmpty(files[i].coordinateArray);
    if (checkById) {
      return true;
    }
  }
  return false;
};
export const extractCoordinates = (files = [], id = null) => {
  if (!isNotEmpty(files)) {
    return [];
  }
  let coordinates = [];
  for (let file = 0; file < files.length; file++) {
    if (id === files[file].id) {
      return files[file].coordinateArray || [];
    }
  }
  return coordinates;
};
export function assignNumber(arr = [], length = 0) {
  const countMap = {};
  for (let i = 0; i < length; i++) {
    if (countMap[arr[i].category] !== undefined) {
      countMap[arr[i].category] += 1;
    } else {
      countMap[arr[i].category] = 0;
    }
    if (countMap[arr[i].category]) {
      arr[i].category += '_' + countMap[arr[i].category];
    }
  }
}
export const fallBack = () => { };
export const mergeData = (list = [], label = '') => {
  if (list?.length < 1 || !Array.isArray(list)) {
    console.log('Empty Array or invalid array');
    return list;
  }
  const newList = [];
  for (let i = 0; i < list.length; i++) {
    const body = {
      ...list[i],
      label: label,
    };
    newList.push(body);
  }
  return newList;
};
export function checkRelevantType(type) {
  const { interiorItems, exteriorItems } = INSPECTION;
  const relevantGroupTypes = [interiorItems, exteriorItems];
  return relevantGroupTypes.includes(type) || false;
}

/**
 * Extracts non-empty values from the input object that don't have 'ID' in their key.
 *
 * @param {Object} file - The object containing various fields to check
 * @returns {Array} - An array of values that are non-empty and do not have 'ID' in their key
 */
export function extractValidUrls(file = {}) {
  // Check if a file is an object and is not null
  if (typeof file !== 'object' || file === null) {
    console.log('Input is not a valid object');
    return [];
  }

  const list = [];

  for (let key in file) {
    // Skip the property if it is from the prototype chain
    if (!file.hasOwnProperty(key)) {
      continue;
    }

    // Only process if the key does not contain 'ID' and the value is not empty
    if (!key.includes('ID') && isNotEmpty(file[key])) {
      list.push(file[key]);
    }
  }

  return list;
}
export const SKIP_NIGHT_IMAGE_LIST = ['CarVerification', 'Tires'];

export async function fixImageOrientation(uri) {
  try {
    const result = await imageResizer.createResizedImage(
      uri,
      1280,
      1280,
      'JPEG',
      100,
      0, // auto-rotation handled internally
      undefined,
      false, // remove EXIF orientation
      { mode: 'contain', onlyScaleDown: true }
    );

    return result.uri;
  } catch (error) {
    console.warn('⚠️ Error fixing image orientation:', error);
    return uri; // fallback to original if resizing fails
  }
}
