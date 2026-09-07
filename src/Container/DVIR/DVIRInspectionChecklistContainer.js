import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { IMAGES } from '../../Assets/Images';
import { DVIR_CHECKLIST_MAPPING, INSPECTION, S3_BUCKET_BASEURL, VEHICLE_TYPES } from '../../Constants';
import { ROUTES } from '../../Navigation/ROUTES';
import { DVIRInspectionChecklistScreen } from '../../Screens';
import {
  deleteImageFromDatabase,
  getChecklists,
  getInspectionDetails,
  inspectionSubmission,
  ai_Mileage_Extraction,
  removeChecklistImageVideo as removeChecklistImageVideoAPI,
  updateChecklist,
} from '../../services/inspection';
import { categoryVariant, setInspectionDetail, setMileage, setMileageMessage, setMileageVisible, setRequired, updateVehicleImage } from '../../Store/Actions';
import {
  ExteriorFrontDetails,
  ExteriorLeftDetails,
  ExteriorRearDetails,
  ExteriorRearLeftCornerDetails,
  ExteriorRearRightCornerDetails,
  ExteriorRightDetails,
  isNotEmpty,
  LicensePlateDetails,
  OdometerDetails,
} from '../../Utils';
import i18n from '../../Utils/i18n';
import { checkAndCompleteUrl, removeAlphabets } from '../../Utils/helpers';
import { useInspectionExpiry } from '../../hooks/useInspectionExpiry';
import { useTranslation } from 'react-i18next';

const frameConfigMap = {
  exterior_front: {
    details: ExteriorFrontDetails(VEHICLE_TYPES.TRUCK),
    source: IMAGES.truck_exterior_front,
    index: 0,
  },
  exterior_right: {
    details: ExteriorRightDetails,
    source: IMAGES.truck_exterior_right,
    index: 1,
  },
  exterior_left: {
    details: ExteriorLeftDetails,
    source: IMAGES.truck_exterior_left,
    index: 0,
  },
  rear_right_corner: {
    details: ExteriorRearRightCornerDetails(VEHICLE_TYPES.TRUCK),
    source: IMAGES.truck_exterior_rear_right,
    index: 1,
  },
  rear_left_corner: {
    details: ExteriorRearLeftCornerDetails(VEHICLE_TYPES.TRUCK),
    source: IMAGES.truck_exterior_rear_left,
    index: 0,
  },
  exterior_rear: {
    details: ExteriorRearDetails(VEHICLE_TYPES.TRUCK),
    source: IMAGES.truck_exterior_rear_back,
    index: 0,
  },
  front_interior: {
    source: {
      uri: 'https://i.pinimg.com/736x/6c/3a/90/6c3a90dd5ae3bcc98fc32b28e2408ab8.jpg',
    },
    index: 0,

    details: {
      key: 'frontInterior',
      title: i18n.t('dvir.frontInterior'),
      instructionalText: i18n.t('dvir.dashBoardView'),
      instructionalSubHeadingText: i18n.t('dvir.frontInterior'),
      buttonText: i18n.t('exteriorItems.captureNow'),
      category: 'Interior',
      subCategory: 'front_interior',
      groupType: INSPECTION.interiorItems,
      isVideo: false,
    },
  },
  rear_interior: {
    source: IMAGES.truck_interior_back,
    index: 0,

    details: {
      key: 'rearInterior',
      title: i18n.t('dvir.rearInterior'),
      instructionalText: i18n.t('dvir.rearInteriorView'),
      instructionalSubHeadingText: i18n.t('dvir.rearInterior'),
      buttonText: i18n.t('exteriorItems.captureNow'),
      category: 'Interior',
      subCategory: 'rear_interior',
      groupType: INSPECTION.interiorItems,
      isVideo: false,
    },
  },
  odometer: {
    details: OdometerDetails,
    source: IMAGES.odometer,
    index: 0,
  },
  tire: {
    source: IMAGES.tire,
    index: 0,

    details: {
      key: 'tire',
      title: i18n.t('dvir.tire'),
      instructionalText: i18n.t('dvir.tireView'),
      instructionalSubHeadingText: '',
      buttonText: i18n.t('exteriorItems.captureNow'),
      category: 'Tire',
      subCategory: '', // Dynamically
      groupType: INSPECTION.tires,
      isVideo: false,
    },
  },
};

// Helpers to centralize initial state
const getInitialCaptureFrames = () => [
  {
    id: 'exterior_front',
    title: i18n.t('dvir.exteriorFront'),
    frames: [
      { id: 'exterior_right', icon: IMAGES.truckRight, image: null },
      { id: 'exterior_left', icon: IMAGES.truckLeft, image: null },
      { id: 'exterior_front', icon: IMAGES.truckFront, image: null },
    ],
  },
  {
    id: 'exterior_rear',
    title: i18n.t('dvir.exteriorRear'),
    frames: [
      { id: 'rear_right_corner', icon: IMAGES.truckRearRight, image: null },
      { id: 'rear_left_corner', icon: IMAGES.truckRearLeft, image: null },
      { id: 'exterior_rear', icon: IMAGES.truckBack, image: null },
    ],
  },
  {
    id: 'interior_front',
    title: i18n.t('dvir.interiorFrontTitle'),
    frames: [{ id: 'front_interior', icon: IMAGES.truckInterior, image: null }],
  },
  {
    id: 'odometer',
    title: OdometerDetails.title,
    frames: [{ id: 'odometer', icon: IMAGES.odometer, image: null }],
  },
  {
    id: 'interior_rear',
    title: i18n.t('dvir.interiorRearTitle'),
    frames: [{ id: 'rear_interior', icon: IMAGES.truckInterior, image: null }],
  },
];

const getInitialTireInspectionData = () => [
  { id: 'tdrf', title: i18n.t('dvir.tdrf'), image: null, icon: 'vehicleTire' },
  { id: 'tdrr', title: i18n.t('dvir.tdrr'), image: null, icon: 'vehicleTire' },
  { id: 'tdlf', title: i18n.t('dvir.tdlf'), image: null, icon: 'vehicleTire' },
  { id: 'tdlr', title: i18n.t('dvir.tdlr'), image: null, icon: 'vehicleTire' },
  { id: 'tdspare', title: i18n.t('dvir.tdspare'), image: null, icon: 'vehicleTDS' },
  {
    id: 'brake_components',
    title: i18n.t('dvir.brakeComponents'),
    image: null,
    icon: 'vehicleBrakeComponent',
  },
];

/**
 * Returns capture frames filtered by inspectionFrequency.
 * When inspectionFrequency is empty, returns full default frames.
 * Only sections/frames whose frame.id exists in exteriorItems or interiorItems categoryName are included.
 */
const getFilteredCaptureFramesByInspectionFrequency = (inspectionFrequency, defaultFrames) => {
  if (!inspectionFrequency?.length) {return defaultFrames;}
  const exteriorIds = inspectionFrequency.filter(i => i?.groupType === 'exteriorItems').map(i => i.categoryName);
  const interiorIds = inspectionFrequency.filter(i => i?.groupType === 'interiorItems').map(i => i.categoryName);
  const allowedFrameIds = new Set([...exteriorIds, ...interiorIds]);
  return defaultFrames
    .map(section => ({
      ...section,
      frames: section.frames.filter(f => allowedFrameIds.has(f.id)),
    }))
    .filter(section => section.frames.length > 0);
};

/**
 * Returns tire inspection data filtered by inspectionFrequency.
 * When inspectionFrequency is empty, returns full default tires.
 * Only tires whose id exists in tires group categoryName are included.
 */
const getFilteredTireDataByInspectionFrequency = (inspectionFrequency, defaultTires) => {
  if (!inspectionFrequency?.length) {return defaultTires;}
  const allowedTireIds = new Set(
    inspectionFrequency.filter(i => i?.groupType === 'tires').map(i => i.categoryName)
  );
  return defaultTires.filter(t => allowedTireIds.has(t.id));
};

const sanitizeMileage = text => (text || '').replace(/[^0-9]/g, '');

const DVIRInspectionChecklistContainer = ({ navigation, route }) => {
  const { selectedInspectionID } = useSelector(state => state.newInspection);
  const { inspectionFrequency, mileage } = useSelector(state => state.newInspection) || {};
  const { t } = useTranslation();
  // Same expiry rule as the standard inspection screen (see useInspectionExpiry).
  // getInspectionData below already dispatches the detail, so the hook must not fetch it again.
  const { isInspectionExpired, handleExpiredInspectionPress } = useInspectionExpiry({ autoLoadDetail: false });

  // State for checklist items
  const [commentModalVisible, setAddCommentModalVisible] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState(null);
  const [additionalComments, setAdditionalComments] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [checklistData, setChecklistData] = useState([]);
  const [mediaModalVisible, setMediaModalVisible] = useState(false);
  const [mediaModalDetails, setMediaModalDetails] = useState({});
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [captureFrames, setCaptureFrames] = useState(getInitialCaptureFrames());

  const [tireInspectionData, setTireInspectionData] = useState(getInitialTireInspectionData());

  // Stable key for inspectionFrequency so effect only runs when configured categories actually change
  const inspectionFrequencyKey = useMemo(
    () =>
      inspectionFrequency?.length
        ? inspectionFrequency
            .map(i => `${i.groupType}:${i.categoryName}`)
            .sort()
            .join(',')
        : '',
    [inspectionFrequency]
  );
  const requiresOdometer = inspectionFrequency?.some(item => String(item?.categoryName || '').trim().toLowerCase() === 'odometer');
  const sanitizedMileage = removeAlphabets(String(mileage || ''));
  const hasValidMileage = Number(sanitizedMileage) > 0;

  // Sync captureFrames and tireInspectionData with inspectionFrequency: only show frames/tires that exist in config.
  // When inspectionFrequency is empty, show full default. Preserve existing images when applying filter.
  useEffect(() => {
    const defaultFrames = getInitialCaptureFrames();
    const defaultTires = getInitialTireInspectionData();
    const filteredFrames = getFilteredCaptureFramesByInspectionFrequency(inspectionFrequency, defaultFrames);
    const filteredTires = getFilteredTireDataByInspectionFrequency(inspectionFrequency, defaultTires);

    setCaptureFrames(prev => {
      const prevSignature = prev.map(s => `${s.id}:${s.frames.map(f => f.id).join(',')}`).join('|');
      const newSignature = filteredFrames.map(s => `${s.id}:${s.frames.map(f => f.id).join(',')}`).join('|');
      if (prevSignature === newSignature) {return prev;}
      return filteredFrames.map(section => ({
        ...section,
        frames: section.frames.map(frame => {
          const prevSection = prev.find(s => s.id === section.id);
          const prevFrame = prevSection?.frames?.find(f => f.id === frame.id);
          return prevFrame ? { ...frame, image: prevFrame.image, fileId: prevFrame.fileId } : frame;
        }),
      }));
    });

    setTireInspectionData(prev => {
      const filteredIds = filteredTires.map(t => t.id).join(',');
      const prevIds = prev.map(t => t.id).join(',');
      if (filteredIds === prevIds) {return prev;}
      return filteredTires.map(tire => {
        const prevTire = prev.find(p => p.id === tire.id);
        return prevTire ? { ...tire, image: prevTire.image, fileId: prevTire.fileId } : tire;
      });
    });
  }, [inspectionFrequencyKey]);

  // Section toggle state
  const [showChecklistSection, setShowChecklistSection] = useState(false);
  const [showTiresSection, setShowTiresSection] = useState(false);

  // CAPTURE MODAL DETAILS
  const modalDetailsInitialState = {
    ...LicensePlateDetails,
    isVideo: false,
  };
  const [modalDetails, setModalDetails] = useState(modalDetailsInitialState);
  const [displayAnnotationPopUp, setDisplayAnnotationPopUp] = useState(false);
  const [captureImageModalVisible, setCaptureImageModalVisible] = useState(false);
  const [requiredFields, setRequiredFields] = useState({});
  const dispatch = useDispatch();
  // const [annotationModalDetails, setAnnotationModalDetails] = useState({
  //   title: '',
  //   type: '',
  //   uri: '',
  //   fileId: '',
  //   source: '',
  // });

  const toggleChecklistSection = useCallback(() => {
    setShowChecklistSection(prev => !prev);
  }, []);

  const toggleTiresSection = useCallback(() => {
    setShowTiresSection(prev => !prev);
  }, []);

  // Memoize button styles to avoid recalculation
  const buttonStyles = useMemo(
    () => ({
      Good: {
        backgroundColor: '#20C18D',
        textColor: '#FFFFFF',
      },
      Repair: {
        backgroundColor: '#FFC700',
        textColor: '#FFFFFF',
      },
      Replace: {
        backgroundColor: '#F74F4F',
        textColor: '#FFFFFF',
      },
      default: {
        backgroundColor: '#F4F6F6',
        textColor: '#666666',
      },
    }),
    []
  );

  const updateChecklistAPIWithCardIndex = useCallback(
    (cardIndex, data) => {
      updateChecklist(selectedInspectionID, checklistData?.[cardIndex]?.checkId, data);
    },
    [updateChecklist, selectedInspectionID, checklistData]
  );

  const handleChecklistStatusChange = useCallback(
    (option, cardIndex, optionIndex) => {
      setChecklistData(prevData => {
        const newData = [...prevData];
        newData[cardIndex].checkStatus = option;
        return newData;
      });

      updateChecklistAPIWithCardIndex(cardIndex, {
        checkStatus: option,
      });
    },
    [updateChecklistAPIWithCardIndex]
  );

  const handleAddComment = useCallback(index => {
    setCurrentItemIndex(index);
    setAddCommentModalVisible(true);
  }, []);

  const handleSaveComment = useCallback(
    comments => {
      if (currentItemIndex !== null) {
        setChecklistData(prevData => {
          const newData = [...prevData];
          newData[currentItemIndex].comment = comments;
          return newData;
        });
      }
      if (comments) {
        // UPDATE CHECKLIST API
        updateChecklistAPIWithCardIndex(currentItemIndex, {
          comment: comments,
        });
      }

      setAddCommentModalVisible(false);
      setCurrentItemIndex(null);
    },
    [currentItemIndex]
  );

  const handleChecklistOpenCamera = useCallback(
    (index, isVideo) => {
      if (checklistData?.[index]?.url?.length == 5)
        {return alert(i18n.t('dvir.maxMediaError'));}

      const details = {
        title: isVideo ? i18n.t('dvir.uploadVideo') : i18n.t('dvir.uploadImage'),
        type: '1',
        uri: '',
        source: '',
        fileId: '',
        instructionalText: i18n.t('dvir.uploadingMedia', {
          media: isVideo ? i18n.t('common.video') : i18n.t('common.image'),
        }),
      };

      dispatch(setRequired(false));
      navigation.navigate(isVideo ? ROUTES.VIDEO : ROUTES.CAMERA, {
        type: 1,
        modalDetails: details,
        inspectionId: selectedInspectionID,
        returnTo: ROUTES.DVIR_INSPECTION_CHECKLIST,
        returnToParams: { checklistCardIndex: index },
        prevScreen: ROUTES.DVIR_INSPECTION_CHECKLIST,
      });
    },
    [navigation, checklistData]
  );

  const handleCloseAddCommentModal = useCallback(() => {
    setAddCommentModalVisible(false);
  }, []);

  const handleCheckItemRemoveImage = useCallback(
    (itemIndex, imageIndex) => {
      setChecklistData(prevData => {
        const newData = [...prevData];

        const item = newData[itemIndex];
        const imageToRemove = item?.url?.[imageIndex];

        // Remove image from images array
        if (item && imageToRemove) {
          newData[itemIndex] = {
            ...item,
            url: item.url.filter((_, i) => i !== imageIndex),
          };

          // Trigger API removal using checkId and image URL
          removeChecklistImageVideoAPI(selectedInspectionID, item.checkId, {
            url: imageToRemove,
          });
        }

        return newData;
      });
    },
    [removeChecklistImageVideoAPI, selectedInspectionID]
  );

  // Handler to update tire image
  const handlePressTireImage = (tireId, title) => {
    const details = {
      ...frameConfigMap.tire,
      ...frameConfigMap.tire.details,
      title,
      subCategory: tireId,
      afterFileUploadNavigationParams: { tireId },
    };
    const frequencyMatch = inspectionFrequency?.find(item => item?.categoryName === tireId);
    if (frequencyMatch) {
      details.categoryId = frequencyMatch.categoryId;
      details.companyConfigId = frequencyMatch.companyConfigId;
    }
    handleFramePickerPress(details, 0);
  };

  const handleFramePickerPress = (details, variant = 0) => {
    const haveType = checkCategory(details.category || null);
    displayAnnotationPopUp && setDisplayAnnotationPopUp(false);
    dispatch(categoryVariant(variant));
    if (haveType) {
      const { key } = details;
      const isRequired = isNotEmpty(requiredFields[key]);
      toggleFieldRequired(!isRequired);
    } else {
      toggleFieldRequired(true);
    }

    setModalDetails(details);
    setCaptureImageModalVisible(true);
  };

  const handleCaptureNowPress = (isVideo, key) => {
    const paths = {
      true: ROUTES.VIDEO,
      false: ROUTES.CAMERA,
    };
    const path = paths[isVideo];
    const cameraType = modalDetails?.key === OdometerDetails.key ? OdometerDetails.key : key;
    // const details = {
    //   title: modalDetails.title,
    //   type: cameraType,
    //   uri: '',
    //   source: modalDetails.source,
    //   fileId: '',
    // };

    // setAnnotationModalDetails(details);
    setCaptureImageModalVisible(false);
    setModalDetails(modalDetailsInitialState);
    navigation.navigate(path, {
      type: cameraType,
      modalDetails: modalDetails,
      inspectionId: selectedInspectionID,
      prevScreen: ROUTES.DVIR_INSPECTION_CHECKLIST,
      ...(cameraType === OdometerDetails.key ? { returnToParams: { isMileageCapture: true } } : {}),
      // returnTo: ROUTES.DVIR_INSPECTION_CHECKLIST,
    });
  };

  function checkCategory(category) {
    const types = ['Interior', 'Exterior'];
    return types.includes(category);
  }

  function toggleFieldRequired(required = null) {
    dispatch(setRequired(required));
  }

  const handleOpenEditMileage = useCallback(() => {
    dispatch(setMileageMessage(''));
    dispatch(setMileage(mileage || ''));
    dispatch(setMileageVisible(true));
  }, [dispatch, mileage]);

  const openMileageModal = useCallback(
    (prefill = '') => {
      dispatch(setMileageMessage(''));
      dispatch(setMileage(prefill));
      dispatch(setMileageVisible(true));
    },
    [dispatch]
  );

  const processCapturedOdometerMileage = useCallback(
    async imageUrl => {
      try {
        const response = await ai_Mileage_Extraction(imageUrl);
        const { mileage: extractedMileage, status = false } = response?.data || {};
        openMileageModal(status === true && extractedMileage ? sanitizeMileage(String(extractedMileage)) : '');
      } catch (err) {
        openMileageModal('');
      }
    },
    [openMileageModal]
  );

  const handleCaptureFrame = (captureFrameId, frameId) => {

    const config = frameConfigMap[frameId];
    const details = { ...config.details, source: config.source, afterFileUploadNavigationParams: { captureFrameId, frameId } };
    const frequencyMatch = inspectionFrequency?.find(item => item?.categoryName === frameId);
    if (frequencyMatch) {
      details.categoryId = frequencyMatch.categoryId;
      details.companyConfigId = frequencyMatch.companyConfigId;
    }
    if (frameId === OdometerDetails.subCategory) {
      displayAnnotationPopUp && setDisplayAnnotationPopUp(false);
      dispatch(categoryVariant(config.index));
      navigation.navigate(ROUTES.CAMERA, {
        type: OdometerDetails.key,
        modalDetails: details,
        inspectionId: selectedInspectionID,
        prevScreen: ROUTES.DVIR_INSPECTION_CHECKLIST,
        returnToParams: { isMileageCapture: true },
      });
      return;
    }
    handleFramePickerPress(details, config.index);


  };

  const handleSubmit = async () => {
    setIsLoading(true);
    await inspectionSubmission(selectedInspectionID);
    setIsLoading(false);

    navigation.navigate(ROUTES.COMPLETED_INSPECTION);
  };

  const handleMediaModalDetailsCrossPress = () => {
    setMediaModalVisible(false);
    setMediaModalDetails({});
  };

  const handleRemoveFrameImage = (itemId, frameId, fileId, type) => {
    // WE HAVE TO MAKE IMAGE KEY NULL FOR THE FRAME AND UPDATE THE API

    if (type === 'capture_frames') {
      setCaptureFrames(prevFrames =>
        prevFrames.map(frame =>
          frame.id === itemId ? { ...frame, frames: frame.frames.map(f => (f.id === frameId ? { ...f, image: null, fileId: null } : f)) } : frame
        )
      );
    } else if (type === 'tires') {
      // DELETION FOR TIRES
      setTireInspectionData(prevTires => prevTires.map(tire => (tire.id === itemId ? { ...tire, image: null, fileId: null } : tire)));
    }

    // API TO DELETE FROM DATABASE
    deleteImageFromDatabase(fileId)
      .then(() => console.log('file deleted:', fileId))
      .catch(e => console.log('file not deleted', e));
  };

  const handleMediaModalDetailsPress = (item, type, checkMediaIdx) => {
    if (type == 'checklist') {
      const translationKey = DVIR_CHECKLIST_MAPPING[item?.checkId];
      const displayName = translationKey ? t(translationKey) : item?.name;
      setMediaModalDetails({
        title: displayName,
        source: item?.url?.[checkMediaIdx],
        isVideo: item?.fileType == 'video',
        coordinates: [],
      });
    } else if (type == 'capture_frame') {
      // const coordinates = extractCoordinates(fileDetails, image_ID);
      setMediaModalDetails({
        title: frameConfigMap?.[item?.id]?.details?.title,
        source: item?.image,
        isVideo: false,
        coordinates: [],
      });
    } else if (type == 'tire') {
      setMediaModalDetails({
        title: item?.title,
        source: item?.image,
        isVideo: false,
        coordinates: [],
      });
    }

    if (type) {setMediaModalVisible(true);}
  };

  const resetState = useCallback(() => {
    const defaultFrames = getInitialCaptureFrames();
    const defaultTires = getInitialTireInspectionData();
    setAddCommentModalVisible(false);
    setCurrentItemIndex(null);
    setAdditionalComments('');
    setIsLoading(false);
    setChecklistData([]);
    setMediaModalVisible(false);
    setMediaModalDetails({});
    setChecklistLoading(false);
    setCaptureFrames(getFilteredCaptureFramesByInspectionFrequency(inspectionFrequency, defaultFrames));
    setTireInspectionData(getFilteredTireDataByInspectionFrequency(inspectionFrequency, defaultTires));
    setModalDetails(modalDetailsInitialState);
    setDisplayAnnotationPopUp(false);
    setCaptureImageModalVisible(false);
    setRequiredFields({});
    setShowChecklistSection(false);
  }, [inspectionFrequency]);

  //API CALLS
  const getChecklistsData = useCallback(async () => {
    setChecklistLoading(true);
    const response = await getChecklists(selectedInspectionID);
    setChecklistLoading(false);
    if (response.status == 200 && response?.data?.length > 0) {
      setChecklistData(response.data);
      setShowChecklistSection(true);
    }
  }, [selectedInspectionID]);

  const getInspectionData = useCallback(async () => {
    const response = await getInspectionDetails(selectedInspectionID);
    const files = response?.data?.files || [];

    // Keep the store copy of the inspection in sync when this screen is entered
    // directly (i.e. without file_Details having run for this inspection).
    const inspection = response?.data?.inspection || null;
    dispatch(setInspectionDetail(inspection));

    // Same rehydration file_Details does: without it a mileage saved earlier is lost on a
    // fresh start, so hasValidMileage stays false and the submit button never shows.
    const savedMileage = inspection?.mileage;
    if (savedMileage) {
      dispatch(setMileage(savedMileage));
    }

    if (files.length > 0) {
      // ----- ODOMETER (car verification) ----- surface it to MileageSection via Redux.
      // Use checkAndCompleteUrl (not a raw prefix): the odometer url may already be a full https URL.
      const odometerFile = files.find(file => file.category === 'odometer');
      if (odometerFile) {
        const odometerUrl = checkAndCompleteUrl(odometerFile.url)?.completedUrl || odometerFile.url;
        dispatch(updateVehicleImage('carVerificiationItems', 'odometer', odometerUrl, odometerFile.id));
      }

      // ----- TIRES -----
      const tiresFiles = files.filter(file => file.groupType === 'tires');
      if (tiresFiles.length > 0) {
        const updatedTires = tireInspectionData.map(tire => {
          const matchedFile = tiresFiles.find(file => file.category === tire.id);
          if (matchedFile) {
            return {
              ...tire,
              image: S3_BUCKET_BASEURL + matchedFile.url,
              fileId: matchedFile.id,
            };
          }
          return tire;
        });

        // setTireInspectionData(updatedTires);
        setTireInspectionData(getFilteredTireDataByInspectionFrequency(inspectionFrequency, updatedTires));
      }

      // ----- EXTERIOR & INTERIOR ITEMS -----
      const exteriorItemsFiles = files.filter(file => file.groupType === 'exteriorItems');
      const interiorItemsFiles = files.filter(file => file.groupType === 'interiorItems');

      const allItemFiles = [...exteriorItemsFiles, ...interiorItemsFiles, ...(odometerFile ? [odometerFile] : [])];

      if (allItemFiles.length > 0) {
        const updatedCaptureFrames = captureFrames.map(section => {
          const updatedFrames = section.frames.map(frame => {
            const matchedFile = allItemFiles.find(file => file.category === frame.id);
            if (matchedFile) {
              const imageUrl = checkAndCompleteUrl(matchedFile.url)?.completedUrl || S3_BUCKET_BASEURL + matchedFile.url;
              return {
                ...frame,
                image: imageUrl,
                fileId: matchedFile.id,
              };
            }
            return frame;
          });

          return {
            ...section,
            frames: updatedFrames,
          };
        });

        // setCaptureFrames(updatedCaptureFrames);
        setCaptureFrames(getFilteredCaptureFramesByInspectionFrequency(inspectionFrequency, updatedCaptureFrames));

      }
    }
  }, [selectedInspectionID, tireInspectionData, captureFrames, dispatch]);

  // useFocusEffect(
  //   useCallback(() => {
  //     return () => {
  //       navigation.setParams({hasNewFetch: undefined});
  //     };
  //   }, [])
  // );

  // CHECKLIST Camera result handler
  useEffect(() => {
    // Mileage captures are handled by the MileageSection component, skip them here.
    if (route?.params?.capturedImageUri && !route?.params?.isMileageCapture) {
      if (route?.params?.checklistCardIndex !== undefined) {
        const { checklistCardIndex, capturedImageUri, capturedImageMime, localPath } = route.params;

        setChecklistData(prevData =>
          prevData.map((item, idx) =>
            idx === checklistCardIndex
              ? {
                ...item,
                url: [...(item.url || []), capturedImageUri],
              }
              : item
          )
        );

        updateChecklistAPIWithCardIndex(checklistCardIndex, {
          url: capturedImageUri,
          extension: capturedImageMime,
        });
      }

      navigation.setParams({
        checklistCardIndex: undefined,
        capturedImageUri: undefined,
        capturedImageMime: undefined,
      });
    }
  }, [route?.params?.capturedImageUri]);

  useEffect(() => {
    if (route?.params?.afterFileUploadImageUrl) {
      const { captureFrameId, frameId, afterFileUploadImageUrl, tireId, fileId } = route.params;

      // CAPTURE FRAMES
      if (captureFrameId && frameId) {
        if (frameId === OdometerDetails.subCategory) {
          processCapturedOdometerMileage(afterFileUploadImageUrl);
        }

        const updatedFrames = captureFrames.map(item => {
          if (item.id === captureFrameId) {
            return {
              ...item,
              frames: item.frames.map(frame => (frame.id === frameId ? { ...frame, image: afterFileUploadImageUrl, fileId } : frame)),
            };
          }
          return item;
        });

        setCaptureFrames(updatedFrames);

        // TIRES
      } else if (tireId) {
        setTireInspectionData(prevData => prevData.map(tire => (tire.id === tireId ? { ...tire, image: afterFileUploadImageUrl, fileId } : tire)));
      }

      navigation.setParams({
        afterFileUploadImageUrl: undefined,
        tireId: undefined,
        captureFrameId: undefined,
        frameId: undefined,
      });
    }
  }, [route?.params?.afterFileUploadImageUrl]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        await Promise.all([getChecklistsData(), getInspectionData()]);
      } catch (error) {
        console.error('Failed to fetch checklist or inspection data:', error.response?.data || error);
      }
    };

    if (selectedInspectionID) {fetchData();}
  }, [selectedInspectionID]);

  const validateFramesTiresCheclist = () => {
    // 1. Validate captureFrames: all frames must have a non-null image (only when frames are shown)
    const allFramesHaveImages = captureFrames.every(section => section.frames.every(frame => frame.image !== null));
    const hasOdometerImage = captureFrames.some(section => section.frames.some(frame => frame.id === 'odometer' && frame.image !== null));
    const hasRequiredOdometerData = !requiresOdometer || (hasOdometerImage && hasValidMileage);

    // 2. Validate tires: all tires must have a non-null image (only when tires are shown)
    const allTiresHaveImages = tireInspectionData.every(tire => tire.image !== null);

    // 3. Validate checklist: all items must have a non-empty checkStatus (only when checklist is shown)
    const allChecklistItemsHaveStatus = checklistData?.every?.(item => item?.checkStatus !== null);

    // Only require completion for sections that are shown (have items); empty section = nothing to complete
    const framesSectionShown = captureFrames.length > 0;
    const tiresSectionShown = tireInspectionData.length > 0;
    const checklistSectionShown = (checklistData?.length ?? 0) > 0;
    const allResults =
      (!framesSectionShown || allFramesHaveImages) &&
      hasRequiredOdometerData &&
      (!tiresSectionShown || allTiresHaveImages) &&
      (!checklistSectionShown || allChecklistItemsHaveStatus);

    return {
      allResults,
      allFramesHaveImages,
      allTiresHaveImages,
      allChecklistItemsHaveStatus,
      hasRequiredOdometerData,
    };
  };

  // Custom back handler
  // const customGoBack = useCallback(() => {
  //   const navState = navigation.getState();
  //   const routes = navState.history;

  //   // Get previousOne and previousTwo
  //   const previousOne = routes[routes.length - 2];

  //   if (previousOne && previousOne.key.includes(ROUTES.NEW_INSPECTION)) {
  //     navigation.navigate(ROUTES.INSPECTION_SELECTION);
  //   } else if (navigation.canGoBack()) {
  //     navigation.goBack();
  //   } else {
  //     // Optionally exit app or do nothing
  //   }
  //   return true; // Prevent default
  // }, [navigation]);

  // // Handle hardware back
  // useFocusEffect(
  //   useCallback(() => {
  //     const onBackPress = () => customGoBack();
  //     const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
  //     return () => subscription.remove();
  //   }, [customGoBack])
  // );

  // Pass customGoBack to header or use it in UI as needed

  return (
    <DVIRInspectionChecklistScreen
      navigation={navigation}
      route={route}
      addCommentModalVisible={commentModalVisible}
      currentItemIndex={currentItemIndex}
      setCurrentItemIndex={setCurrentItemIndex}
      additionalComments={additionalComments}
      setAdditionalComments={setAdditionalComments}
      checklistData={checklistData}
      checklistLoading={checklistLoading}
      setChecklistData={setChecklistData}
      captureFrames={captureFrames}
      setCaptureFrames={setCaptureFrames}
      tireInspectionData={tireInspectionData}
      setTireInspectionData={setTireInspectionData}
      buttonStyles={buttonStyles}
      onChecklistStatusChange={handleChecklistStatusChange}
      onCommentIconPress={handleAddComment}
      onSaveComment={handleSaveComment}
      onCheckItemCameraIconPress={handleChecklistOpenCamera}
      handleCloseModal={handleCloseAddCommentModal}
      onCheckItemRemoveImage={handleCheckItemRemoveImage}
      onPressTireImage={handlePressTireImage}
      showChecklistSection={showChecklistSection}
      showTiresSection={showTiresSection}
      toggleChecklistSection={toggleChecklistSection}
      toggleTiresSection={toggleTiresSection}
      onPressCaptureFrame={handleCaptureFrame}
      commentModalImage={checklistData?.[currentItemIndex]?.fileType == 'photo' ? checklistData?.[currentItemIndex]?.url?.[0] : null}
      hasSubmitButtonShow={validateFramesTiresCheclist().allResults}
      onPressSubmit={handleSubmit}
      isLoading={isLoading}
      // CAPTURE MODAL DETAILS PROPS
      captureImageModalVisible={captureImageModalVisible}
      setCaptureImageModalVisible={() => setCaptureImageModalVisible(false)}
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
      handleFramesCaptureImage={handleCaptureNowPress}
      // CAPTURE MODAL DETAILS PROPS

      // DISPLAYING MEDIA
      mediaModalDetails={mediaModalDetails}
      mediaModalVisible={mediaModalVisible}
      handleMediaModalDetailsCrossPress={handleMediaModalDetailsCrossPress}
      handleMediaModalDetailsPress={handleMediaModalDetailsPress}
      onRemoveFrameImage={handleRemoveFrameImage}
      onOpenEditMileage={handleOpenEditMileage}
      initialCommentText={checklistData?.[currentItemIndex]?.comment}
      isInspectionExpired={isInspectionExpired}
      handleExpiredInspectionPress={handleExpiredInspectionPress}
    />
  );
};

export default DVIRInspectionChecklistContainer;
