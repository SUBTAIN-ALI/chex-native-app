import { Platform } from 'react-native';
import { IMAGES } from '../Assets/Images';
import i18n from 'i18next';

// Vehicle Types Constants
export const VEHICLE_TYPES = {
  VAN: 'van',
  SEDAN: 'sedan',
  TRUCK: 'truck',
  OTHER: 'other',
  DVIR_TRUCK:'dvir-truck',
};

// Vehicle Types Display Names
export const VEHICLE_TYPE_DISPLAY_NAMES = {
  [VEHICLE_TYPES.VAN]: 'Van',
  [VEHICLE_TYPES.SEDAN]: 'Sedan',
  [VEHICLE_TYPES.TRUCK]: 'Truck',
  [VEHICLE_TYPES.OTHER]: 'Other',
};

// Vehicle Types that support frames
export const VEHICLE_TYPES_WITH_FRAMES = [VEHICLE_TYPES.VAN, VEHICLE_TYPES.SEDAN, VEHICLE_TYPES.TRUCK];

// Api Endpoints start here
const ENV_TYPE_URL = {
  staging: process.env.STAGING_URL,
  production: process.env.PRODUCTION_URL,
  development: process.env.DEVELOPMENT_URL,
  ngrok: process.env.NGROK_URL,
};

const version = '1';
export const API_VERSION_PATH = '/api/v' + version + '/';
export const API_BASE_URL = ENV_TYPE_URL.staging;
export const generateApiUrl = path => API_BASE_URL + API_VERSION_PATH + path;
console.log('API_BASE_URL', API_BASE_URL);
export const S3_BUCKET_BASEURL = process.env.S3_BUCKET_BASEURL;
export const EXTRACT_NUMBER_PLATE_WITH_AI = process.env.EXTRACT_NUMBER_PLATE_URL;
export const nightImageCheckAI = process.env.NIGHT_IMAGE_CHECK;
export const MILEAGE_EXTRACTION = process.env.MILEAGE_EXTRACT;
export const AI_API_TOKEN = process.env.AI_API_TOKEN;
export const SMARTLOOK_PROJECT_ID = '77967539d73859f97a4f9cc54d00dac3b6f00deb';
export const ONE_SIGNAL_ID = '3f8c33e1-1334-4cf6-a0c4-347d101bcbef';

// API endpoints
export const API_ENDPOINTS = {
  FETCH_NUMBER_PLATE_URL: generateApiUrl('searchnumberplate'),
  EXTRACT_NUMBER_PLATE_URL: generateApiUrl('extract/inspection/create'),
  EXTRACT_NUMBER_PLATE_WITH_AI_URL: process.env.EXTRACT_NUMBER_PLATE_URL,
  LOGIN_URL: generateApiUrl('auth/login'),
  /*New file upload api*/
  /*UPLOAD_URL: generateApiUrl('automation/file/upload'),*/
  /*Old file upload api*/
  UPLOAD_URL: generateApiUrl('file/upload'),
  CREATE_INSPECTION_URL: generateApiUrl('create/inspection'),
  FETCH_IN_PROGRESS_URL: generateApiUrl('status/vehicle'),
  VEHICLE_INFO_AGAINSET_LICENSE_PLATE: generateApiUrl('inspections/vehicle-info'),
  VEHICLE_INFO_AGAINSET_VIN: generateApiUrl('inspections/vehicle-info'),
  REGISTERED_VEHICLES: generateApiUrl('inspections/user-vehicles'),
  RECENT_INSPECTION: generateApiUrl('inspections/recent'),
  FORGET_PASSWORD_URL: generateApiUrl('auth/reset/email'),
  RESET_PASSWORD_URL: generateApiUrl('auth/reset/password'),
  INSPECTION_TIRE_STATUS_URL: generateApiUrl('display/tire'),
  UPDATE_MY_PROFILE: generateApiUrl('user'),
  REMOVE_ALL_TIRES_URL: generateApiUrl('delete/file'),
  ANNOTATION_URL: generateApiUrl('file/coordinate'),
  LOCATION_URL: generateApiUrl('inspection/location'),
  SUBMIT_INSPECTION: generateApiUrl('dsp/app/producer'),
  GET_USER_INSPECTION_STATS: generateApiUrl('user/stats'),
  FUEL_EVENT: generateApiUrl('fuelguard/events'),
};
// Api Endpoints ends here
export const Platforms = {
  ANDROID: 'android',
  IOS: 'ios',
  WINDOW: 'window',
};
export const HARDWARE_BACK_PRESS = 'hardwareBackPress';
export const ANDROID = 'android';

export const INSPECTION = {
  carVerificiationItems: 'carVerificiationItems',
  interiorItems: 'interiorItems',
  exteriorItems: 'exteriorItems',
  tires: 'tires',
};
// An in-progress inspection is considered stale this many minutes after its createdAt.
// TODO: set back to 120 before release — temporarily lowered for testing.
export const INSPECTION_EXPIRY_MINUTES = 120;
export const INSPECTION_SUBCATEGORY = {
  license_plate_number: 'licensePlate',
  odometer: 'odometer',
  exterior_front: 'exteriorFront',
  exterior_front_1: 'exteriorFront_1',
  exterior_front_2: 'exteriorFront_2',
  exterior_rear: 'exteriorRear',
  exterior_rear_1: 'exteriorRear_1',
  exterior_rear_2: 'exteriorRear_2',
  exterior_left: 'exteriorLeft',
  exterior_left_1: 'exteriorLeft_1',
  exterior_left_2: 'exteriorLeft_2',
  exterior_right: 'exteriorRight',
  exterior_right_1: 'exteriorRight_1',
  exterior_right_2: 'exteriorRight_2',
  front_left_corner: 'exteriorFrontLeftCorner',
  front_left_corner_1: 'exteriorFrontLeftCorner_1',
  front_left_corner_2: 'exteriorFrontLeftCorner_2',
  front_right_corner: 'exteriorFrontRightCorner',
  front_right_corner_1: 'exteriorFrontRightCorner_1',
  front_right_corner_2: 'exteriorFrontRightCorner_2',
  rear_left_corner: 'exteriorRearLeftCorner',
  rear_left_corner_1: 'exteriorRearLeftCorner_1',
  rear_left_corner_2: 'exteriorRearLeftCorner_2',
  rear_right_corner: 'exteriorRearRightCorner',
  rear_right_corner_1: 'exteriorRearRightCorner_1',
  rear_right_corner_2: 'exteriorRearRightCorner_2',
  interior_driver_side: 'driverSide',
  interior_driver_side_1: 'driverSide_1',
  interior_driver_side_2: 'driverSide_2',
  interior_passenger_side: 'passengerSide',
  interior_passenger_side_1: 'passengerSide_1',
  interior_passenger_side_2: 'passengerSide_2',
  inside_cargo_roof: 'exteriorInsideCargoRoof',
  inside_cargo_roof_1: 'exteriorInsideCargoRoof_1',
  inside_cargo_roof_2: 'exteriorInsideCargoRoof_2',
  left_front_tire: 'leftFrontTire',
  left_rear_tire: 'leftRearTire',
  right_front_tire: 'rightFrontTire',
  right_rear_tire: 'rightRearTire',
};
// Use getters to ensure translations are evaluated when accessed, not at module load
export const INSPECTION_TITLE = {
  get license_plate_number() {
    return i18n.t('inspectionTitles.license_plate_number');
  },
  get odometer() {
    return i18n.t('inspectionTitles.odometer');
  },
  get exterior_front() {
    return i18n.t('inspectionTitles.exterior_front');
  },
  get exterior_front_1() {
    return i18n.t('inspectionTitles.exterior_front_1');
  },
  get exterior_front_2() {
    return i18n.t('inspectionTitles.exterior_front_2');
  },
  get exterior_rear() {
    return i18n.t('inspectionTitles.exterior_rear');
  },
  get exterior_rear_1() {
    return i18n.t('inspectionTitles.exterior_rear_1');
  },
  get exterior_rear_2() {
    return i18n.t('inspectionTitles.exterior_rear_2');
  },
  get exterior_left() {
    return i18n.t('inspectionTitles.exterior_left');
  },
  get exterior_left_1() {
    return i18n.t('inspectionTitles.exterior_left_1');
  },
  get exterior_left_2() {
    return i18n.t('inspectionTitles.exterior_left_2');
  },
  get exterior_right() {
    return i18n.t('inspectionTitles.exterior_right');
  },
  get exterior_right_1() {
    return i18n.t('inspectionTitles.exterior_right_1');
  },
  get exterior_right_2() {
    return i18n.t('inspectionTitles.exterior_right_2');
  },
  get front_left_corner() {
    return i18n.t('inspectionTitles.front_left_corner');
  },
  get front_left_corner_1() {
    return i18n.t('inspectionTitles.front_left_corner_1');
  },
  get front_left_corner_2() {
    return i18n.t('inspectionTitles.front_left_corner_2');
  },
  get front_right_corner() {
    return i18n.t('inspectionTitles.front_right_corner');
  },
  get front_right_corner_1() {
    return i18n.t('inspectionTitles.front_right_corner_1');
  },
  get front_right_corner_2() {
    return i18n.t('inspectionTitles.front_right_corner_2');
  },
  get rear_left_corner() {
    return i18n.t('inspectionTitles.rear_left_corner');
  },
  get rear_left_corner_1() {
    return i18n.t('inspectionTitles.rear_left_corner_1');
  },
  get rear_left_corner_2() {
    return i18n.t('inspectionTitles.rear_left_corner_2');
  },
  get rear_right_corner() {
    return i18n.t('inspectionTitles.rear_right_corner');
  },
  get rear_right_corner_1() {
    return i18n.t('inspectionTitles.rear_right_corner_1');
  },
  get rear_right_corner_2() {
    return i18n.t('inspectionTitles.rear_right_corner_2');
  },
  get inside_cargo_roof() {
    return i18n.t('inspectionTitles.inside_cargo_roof');
  },
  get inside_cargo_roof_1() {
    return i18n.t('inspectionTitles.inside_cargo_roof_1');
  },
  get inside_cargo_roof_2() {
    return i18n.t('inspectionTitles.inside_cargo_roof_2');
  },
  get left_front_tire() {
    return i18n.t('inspectionTitles.left_front_tire');
  },
  get left_rear_tire() {
    return i18n.t('inspectionTitles.left_rear_tire');
  },
  get right_front_tire() {
    return i18n.t('inspectionTitles.right_front_tire');
  },
  get right_rear_tire() {
    return i18n.t('inspectionTitles.right_rear_tire');
  },
  get interior_passenger_side() {
    return i18n.t('inspectionTitles.interior_passenger_side');
  },
  get interior_driver_side() {
    return i18n.t('inspectionTitles.interior_driver_side');
  },
};
export const UPDATE_APP = {
  get TITLE() {
    return i18n.t('appUpdate.title');
  },
  get MESSAGE() {
    return i18n.t('appUpdate.message');
  },
  get BUTTON() {
    return i18n.t('appUpdate.button');
  },
};
export const SESSION_EXPIRED = {
  get TITLE() {
    return i18n.t('session.expired.title');
  },
  get MESSAGE() {
    return i18n.t('session.expired.message');
  },
  get BUTTON() {
    return i18n.t('session.expired.button');
  },
};

export const ANNOTATE_IMAGE_DETAILS = {
  get title() {
    return i18n.t('annotateImageDetails.title');
  },
  source: IMAGES.front_Left_Corner,
  get description() {
    return i18n.t('annotateImageDetails.description');
  },
  get instruction() {
    return i18n.t('annotateImageDetails.instruction');
  },
  get annotateText() {
    return i18n.t('annotateImageDetails.annotateText');
  },
  get skipText() {
    return i18n.t('annotateImageDetails.skipText');
  },
};
export const ANNOTATE_IMAGE = {
  get title() {
    return i18n.t('annotateImage.title');
  },
  source: IMAGES.front_Left_Corner,
  get description() {
    return i18n.t('annotateImage.description');
  },
  get instruction() {
    return i18n.t('annotateImage.instruction');
  },
  get annotateText() {
    return i18n.t('annotateImage.annotateText');
  },
  get cancelText() {
    return i18n.t('annotateImage.cancelText');
  },
};

export const DAMAGE_TYPE = ['Minor', 'Major', 'Severe'];
export const Image_Type = [];

export const PROJECT_NAME = {
  CHEX_AI: 'CHEX.AI',
  CHEX: 'CHEX',
  AI: '.AI',
};

export const DRAWER = {
  HOME: 'HOME',
  THINGS_YOU_WILL_REQUIRE: 'Things you will require',
  LOGOUT: 'Logout',
  DVIRC: 'DVIRC',
};

export const INSPECTION_STATUSES = ['IN_REVIEW', 'REVIEWED', 'READY_FOR_REVIEW'];
export const STATUSES = {
  REVIEWED: 'Reviewed',
  READY_FOR_REVIEW: 'Ready For Review',
  IN_REVIEW: 'In Review',
  IN_PROGRESS: 'In Progress',
};
export const PHYSICAL_DEVICES = ['wide-angle-camera', 'ultra-wide-angle-camera', 'telephoto-camera'];
export const IS_BACK_CAMERA = {
  front: true,
  back: false,
};
export const SWITCH_CAMERA = {
  true: 'front',
  false: 'back',
};

export const Delete_Messages = {
  get success() {
    return i18n.t('delete.success');
  },
  get failed() {
    return i18n.t('delete.failed');
  },
};
export const customSortOrder = {
  groupType: ['carVerificiationItems', 'interiorItems', 'exteriorItems', 'tires'],
  carVerificiationItems: ['license_plate_number', 'odometer'],
  interiorItems: [
    'interior_passenger_side',
    'interior_passenger_side0',
    'interior_passenger_side1',
    'interior_passenger_side2',
    'interior_driver_side',
    'interior_driver_side0',
    'interior_driver_side1',
    'interior_driver_side2',
  ],
  exteriorItems: [
    'exterior_left',
    'exterior_left0',
    'exterior_left1',
    'exterior_left2',
    'exterior_right',
    'exterior_right0',
    'exterior_right1',
    'exterior_right2',
    'exterior_front',
    'exterior_front0',
    'exterior_front1',
    'exterior_front2',
    'exterior_rear',
    'exterior_rear0',
    'exterior_rear1',
    'exterior_rear2',
    'front_left_corner',
    'front_left_corner0',
    'front_left_corner1',
    'front_left_corner2',
    'front_right_corner',
    'front_right_corner0',
    'front_right_corner1',
    'front_right_corner2',
    'rear_left_corner',
    'rear_left_corner0',
    'rear_left_corner1',
    'rear_left_corner2',
    'rear_right_corner',
    'rear_right_corner0',
    'rear_right_corner1',
    'rear_right_corner2',
    'inside_cargo_roof',
    'inside_cargo_roof0',
    'inside_cargo_roof1',
    'inside_cargo_roof2',
  ],
  tires: ['left_front_tire', 'left_rear_tire', 'right_front_tire', 'right_rear_tire'],
};
export const MAX_UPLOAD_RETRIES = 3;
export const RETRY_BASE_DELAY_MS = 1000;
export const RETRY_MAX_DELAY_MS = 8000;

export const UPLOAD_REQUEST_TIMEOUT = 30000;
export const S3_UPLOAD_TIMEOUT = 60000;

export const CONNECTION_PROBE_INTERVAL_MS = 2000;
export const CONNECTION_PROBE_TIMEOUT_MS = 5000;
export const OFFLINE_WAIT_TIMEOUT_MS = 120000;

export const darkImageError = {
  get title() {
    return i18n.t('errors.darkImageError.title');
  },
  get message() {
    return i18n.t('errors.darkImageError.message');
  },
};
export const uploadFailed = {
  get title() {
    return i18n.t('errors.uploadFailed.title');
  },
  get message() {
    return i18n.t('errors.uploadFailed.message');
  },
};
export const exitAppInfo = {
  get title() {
    return i18n.t('exitApp.title');
  },
  get message() {
    return i18n.t('exitApp.message');
  },
  get button() {
    return {
      get yes() {
        return i18n.t('exitApp.button.yes');
      },
      get cancel() {
        return i18n.t('exitApp.button.cancel');
      },
    };
  },
};

export const VEHICLE_IMAGES = {
  [VEHICLE_TYPES.VAN]: IMAGES.Van,
  [VEHICLE_TYPES.TRUCK]: IMAGES.Truck,
  [VEHICLE_TYPES.SEDAN]: IMAGES.Sedan,
  [VEHICLE_TYPES.OTHER]: IMAGES.other_vehicle,
};

export const FINAL_INSPECTION_STATUS = {
  pending: 'Pending',
  pass: 'Passed',
  fail: 'Failed',
};

export const INSPECTION_STATUS_FOR_RECENT_INSPECTION = {
  IN_PROGRESS: 'IN_PROGRESS',
  IN_PROCESS: 'IN_PROCESS',
  READY_FOR_REVIEW: 'READY_FOR_REVIEW',
  IN_REVIEW: 'IN_REVIEW',
  REVIEWED: 'REVIEWED',
};

export const isIOS = Platform.OS == Platforms.IOS;

export const DVIR_CHECKLIST_MAPPING = {
  58: 'dvir.checklist.headLights',
  59: 'dvir.checklist.engineBay',
  60: 'dvir.checklist.oilDipstick',
  61: 'dvir.checklist.underBodyLeak',
  62: 'dvir.checklist.radioNavigation',
  63: 'dvir.checklist.jackTools',
  64: 'dvir.checklist.tailLights',
};
