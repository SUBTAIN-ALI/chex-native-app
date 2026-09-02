import axios from 'axios';
import { AI_API_TOKEN, API_ENDPOINTS, EXTRACT_NUMBER_PLATE_WITH_AI, generateApiUrl, MILEAGE_EXTRACTION, nightImageCheckAI, UPLOAD_REQUEST_TIMEOUT } from '../Constants';
import { generateRandomString } from '../Utils';
import api from './api';

const {
  EXTRACT_NUMBER_PLATE_URL,
  INSPECTION_TIRE_STATUS_URL,
  REMOVE_ALL_TIRES_URL,
  ANNOTATION_URL,
  LOCATION_URL,
  CREATE_INSPECTION_URL,
  FETCH_IN_PROGRESS_URL,
  UPLOAD_URL,
  SUBMIT_INSPECTION,
  EXTRACT_VIN_WITH_AI,
  VEHICLE_INFO_AGAINSET_LICENSE_PLATE,
  VEHICLE_INFO_AGAINSET_VIN,
  RECENT_INSPECTION,
  REGISTERED_VEHICLES,
  GET_USER_INSPECTION_STATS,
} = API_ENDPOINTS;

export const createInspection = async (companyId, data) => {
  const body = { companyId, ...data, source: 'app' };
  try {
    return await api.post(CREATE_INSPECTION_URL, body);
  } catch (error) {
    throw error;
  }
};

export const getVehicleInformationAgainstLicenseId = async licensePlateNumber => {
  try {
    return await api.post(VEHICLE_INFO_AGAINSET_LICENSE_PLATE, { licensePlateNumber });
  } catch (error) {
    console.error('getVehicleInformationAgainstLicenseId error:', error.response.data);
    throw error;
  }
};
export const getVehicleInformationAgainstVin = async vin => {
  try {

    return await api.get(VEHICLE_INFO_AGAINSET_VIN, { vin });
  } catch (error) {
    console.error('getVehicleInformationAgainstVin error:', error.response.data);
    throw error;
  }
};

export const getRecentInspections = async () => {
  try {
    return await api.get(RECENT_INSPECTION);
  } catch (error) {
    console.error('getRecentInspections error:', error.response.data);
    throw error;
  }
};

export const getRegisteredVehicles = async () => {
  try {
    return await api.get(REGISTERED_VEHICLES);
  } catch (error) {
    console.error('getRegisteredVehicles error:', error.response.data);
    throw error;
  }
};

export const removeInspection = async inspectionId => {
  const endPoint = generateApiUrl(`delete/inspection/${inspectionId}?type=app`);
  try {
    return await api.delete(endPoint);
  } catch (error) {
    console.error('Inspection remove error:', error);
    throw error;
  }
};

export const getInspectionDetails = async inspectionId => {
  const endPoint = generateApiUrl(`files/details/${inspectionId}`);

  try {
    return await api.get(endPoint);
  } catch (error) {
    console.error('Fetching inspection details error:', error);
    throw error;
  }
};

export const getUserInspectionStats = async () => {
  try {
    return await api.get(GET_USER_INSPECTION_STATS);
  } catch (error) {
    console.error('Fetching user inspection stats error:', error.response.data);
    throw error;
  }
};

export const extractNumberPlate = async (licensePlateNumber, companyId, inspectionId) => {
  const body = {
    licensePlateNumber,
    companyId,
    inspectionId,
  };

  try {
    return await api.post(EXTRACT_NUMBER_PLATE_URL, body);
  } catch (error) {
    console.error('License plate extraction error:', error.response.data);
    throw error;
  }
};

export const vehicleTireStatus = async inspectionId => {
  const body = {
    inspectionId,
  };
  try {
    return await api.post(INSPECTION_TIRE_STATUS_URL, body);
  } catch (error) {
    console.error('Vehicle tire status check error:', error);
    throw error;
  }
};

export const clearTires = async (fileIds = []) => {
  const body = { fileId: fileIds };

  try {
    return await api.post(REMOVE_ALL_TIRES_URL, body);
  } catch (error) {
    console.error('Tires removing error:', error);
    throw error;
  }
};

export const imageAnnotation = async (coordinateArray, inspectionId, fileId) => {
  const body = { coordinateArray, inspectionId, fileId };

  try {
    return await api.post(ANNOTATION_URL, body);
  } catch (error) {
    console.error('Image annotation submission error:', error);
    throw error;
  }
};

export const inspectionDetails = async inspectionId => {
  const endPoint = generateApiUrl(`files/app/${inspectionId}`);

  try {
    return await api.get(endPoint);
  } catch (error) {
    console.error('Inspection details error:', error);
    throw error;
  }
};

export const fetchAllInspections = async status => {
  const body = {
    status,
  };

  try {
    return await api.post(FETCH_IN_PROGRESS_URL, body);
  } catch (error) {
    console.error('Inspection details error:', error);
    throw error;
  }
};

export const extractLicensePlateAI = async image_url => {
  const body = { image_url };
  const headers = {
    api_token: AI_API_TOKEN,
  };
  try {
    return await api.post(EXTRACT_NUMBER_PLATE_WITH_AI, body, {
      headers: headers,
    });
  } catch (error) {
    console.error('License Plate AI Extraction error:', error);
    throw error;
  }
};

export const extractVinAI = async (image_url = null, vin = null) => {
  const headers = {
    api_token: AI_API_TOKEN,
  };

  try {
    const endPoint = generateApiUrl(`vin?image_url=${image_url}&vin=${vin}`);

    return await api.get(endPoint, {
      headers: headers,
    });
  } catch (error) {
    console.error('VIN AI Extraction error:', error.response.data);
    throw error;
  }
};

export const s3SignedUrl = async (type = '', source = '', inspectionId = '', categoryName = '', variant = '', companyId = '') => {
  const data = { type, source, inspectionId, categoryName, variant, companyId };
  // const data = {type};

  try {
    return await api.post(UPLOAD_URL, data, { timeout: UPLOAD_REQUEST_TIMEOUT });
  } catch (error) {
    console.error('Getting s3 signed url error:', error?.response?.data || error?.message);
    throw error;
  }
};

export const uploadFileToDatabase = async (inspectionId, body) => {
  const endPoint = generateApiUrl(`vehicle/${inspectionId}/file`);

  try {
    return await api.post(endPoint, body, { timeout: UPLOAD_REQUEST_TIMEOUT });
  } catch (error) {
    console.error('uploadFileToDatabase error:', error?.response?.data || error?.message);
    throw error;
  }
};

export const deleteImageFromDatabase = async fileId => {
  const endPoint = generateApiUrl(`files/${fileId}`);

  try {
    return await api.delete(endPoint);
  } catch (error) {
    console.error('Deleting image from database error:', error?.response?.data);
    throw error;
  }
};

export const location = async inspectionId => {
  const body = {
    isLocation: true,
    inspectionId,
  };

  try {
    return await api.put(LOCATION_URL, body);
  } catch (error) {
    console.error('location error:', error);
    throw error;
  }
};

/**
 * Submits an inspection using its ID.
 * This function makes a PATCH request to submit inspection data by its ID.
 *
 * @param {string} [inspectionId=''] The unique identifier of the inspection. Default to an empty string if not provided.
 * @param {string} [companyId=''] The unique identifier of the company submitting the inspection. Default to an empty string if not provided.
 * @param {string|null} [driverComment=null] Optional driver comments for the inspection. Default to `null` if not provided.
 * @returns {Promise<axios.AxiosResponse<any>>} A promise that resolves to the Axios response object, containing the result of the PATCH request.
 * @throws {Error} If the request fails, it will throw an error.
 */
export const inspectionSubmission = async (inspectionId = '', companyId = '', driverComment = null) => {
  const endPoint = generateApiUrl(`inspection/${inspectionId}`);

  const body = { driverComment };
  try {
    return await api.patch(endPoint, body);
  } catch (error) {
    console.error('Inspection submission error:', error);
    throw error;
  }
};

/**
 * Submits an inspection using auto-inspection with a company ID.
 * This function makes a POST request to submit the inspection data, along with the company ID.
 *
 * @param {string} [inspectionId=''] The unique identifier of the inspection. Default to an empty string if not provided.
 * @param {string} [companyId=''] The unique identifier of the company submitting the inspection. Default to an empty string if not provided.
 * @returns {Promise<axios.AxiosResponse<any>>} A promise that resolves to the Axios response object, containing the result of the POST request.
 * @throws {Error} If the request fails, it will throw an error.
 */
/*export const inspectionSubmission = async (
  inspectionId = '',
  companyId = '',
) => {
  const endPoint = generateApiUrl(`auto/reviewed/${inspectionId}`);
  const body = {companyId};

  try {
    return await api.post(endPoint, body);
  } catch (error) {
    console.error('Inspection submission error:', error);
    throw error;
  }
}*/

/**
 * Submits an inspection using a queue-based auto-inspection with additional driver comments.
 * This function makes a POST request to submit the inspection, company ID, and any driver comments.
 *
 * @param {string} [inspectionId=''] The unique identifier of the inspection. Default to an empty string if not provided.
 * @param {string} [companyId=''] The unique identifier of the company submitting the inspection. Default to an empty string if not provided.
 * @param {string|null} [driverComment=null] Optional driver comments for the inspection. Default to `null` if not provided.
 * @returns {Promise<axios.AxiosResponse<any>>} A promise that resolves to the Axios response object, containing the result of the POST request.
 * @throws {Error} If the request fails, it will throw an error.
 */
/*export const inspectionSubmission = async (
  inspectionId = '',
  companyId = '',
  driverComment = null,
) => {
  const body = {inspectionId, companyId, driverComment};

  try {
    return await api.post(SUBMIT_INSPECTION, body);
  } catch (error) {
    console.error('Inspection submission error:', error);
    throw error;
  }
};*/

export const isImageDarkWithAI = async image_url => {
  const body = { image_url };
  const config = { headers: { api_token: AI_API_TOKEN }, timeout: UPLOAD_REQUEST_TIMEOUT };
  try {
    return await api.post(nightImageCheckAI, body, config);
  } catch (error) {
    console.error('Night image check error:', error.message);
    throw error;
  }
};

export const ai_Mileage_Extraction = async image_url => {
  const body = {
    image_url,
  };
  const config = { headers: { api_token: AI_API_TOKEN } };

  try {
    return await api.post(MILEAGE_EXTRACTION, body, config);
  } catch (error) {
    console.error('Mileage extraction error:', error.message);
    throw error;
  }
};

export const updateMileageInDB = async (milage, inspectionId) => {
  const endPoint = generateApiUrl(`update/vehicle/milage/${inspectionId}`);

  const body = { milage };

  try {
    return await api.put(endPoint, body);
  } catch (error) {
    console.error('Mileage update error:', error.response.data);
    throw error;
  }
};

export const getChecklists = async inspectionId => {
  const endPoint = generateApiUrl(`checklist/${inspectionId}`);

  try {
    return await api.get(endPoint);
  } catch (error) {
    console.error('Checklists error:', error.response.data);
    throw error;
  }
};

export const updateChecklist = async (inspectionId, checkId, data) => {
  const endPoint = generateApiUrl('update/checklist');
  const body = { inspectionId, checkId, ...data };

  try {
    const response = await api.put(endPoint, body);
    return response;
  } catch (error) {
    console.error('Checklist update error:', error.response.data);
    throw error;
  }
};

export const removeChecklistImageVideo = async (inspectionId, checkId, data) => {
  const endPoint = generateApiUrl('checklist/image');
  const body = { inspectionId, checkId, ...data };

  try {
    return await api.patch(endPoint, body);
  } catch (error) {
    console.error('Checklist image video remove error:', error.response.data);
    throw error;
  }
};
