import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useSelector } from 'react-redux';
import { ExpandedCardStyles, expandedCardStyles } from '../../Assets/Styles';
import {
  ExteriorFrontDetails,
  ExteriorFrontLeftCornerDetails,
  ExteriorFrontRightCornerDetails,
  ExteriorInsideCargoRoofDetails,
  ExteriorLeftDetails,
  ExteriorRearDetails,
  ExteriorRearLeftCornerDetails,
  ExteriorRearRightCornerDetails,
  ExteriorRightDetails,
} from '../../Utils';
import { ImagesPickerContainer } from '../index';

const { expandedCardContainer } = expandedCardStyles;
const { container } = ExpandedCardStyles;

const EXTERIOR_CATEGORY_NAMES = {
  FRONT: 'exterior_front',
  REAR: 'exterior_rear',
  EXTERIOR_LEFT_SIDE: 'exterior_left_side',
  EXTERIOR_RIGHT_SIDE: 'exterior_right_side',
  FRONT_LEFT_CORNER: 'front_left_corner',
  FRONT_RIGHT_CORNER: 'front_right_corner',
  REAR_LEFT_CORNER: 'rear_left_corner',
  REAR_RIGHT_CORNER: 'rear_right_corner',
  INSIDE_CARGO_ROOF: 'inside_cargo_roof',
};

const hasCategory = (array, categoryName) =>
  array.some(item => item?.categoryName === categoryName);

/**
 * Enriches ExteriorDetails with categoryId and companyConfigId from config
 * when a matching categoryName (config) === subCategory (details) exists.
 * Safe when config is empty or no match — returns details unchanged.
 */
const enrichWithCategoryId = (details, config, categoryName) => {
  const matchKey = categoryName || details?.subCategory;
  if (!config?.length || !matchKey) {
    return details;
  }
  const match = config.find(item => item?.categoryName === matchKey);
  if (!match) {
    return details;
  }
  return {
    ...details,
    categoryId: match.categoryId,
    companyConfigId: match.companyConfigId,
  };
};

const ExteriorItemsExpandedCard = ({
  handleItemPickerPress,
  exteriorItems,
  handleCrossPress,
  isLoading,
  handleMediaModalDetailsPress,
  pickerText,
  skipLeft = false,
  skipLeftCorners = false,
  skipRight = false,
  skipRightCorners = false,
  exteriorItemsConfig = [],
}) => {
  const { t } = useTranslation();
  const defaultPickerText = pickerText || t('exteriorItems.captureImage');

  const { selectedVehicleKind } = useSelector(state => state?.newInspection);

  const hasExteriorConfig = exteriorItemsConfig.length > 0;

  const showFront = !hasExteriorConfig || hasCategory(exteriorItemsConfig, EXTERIOR_CATEGORY_NAMES.FRONT);
  const showRear = !hasExteriorConfig || hasCategory(exteriorItemsConfig, EXTERIOR_CATEGORY_NAMES.REAR);
  const showExteriorLeftSide = (!hasExteriorConfig || hasCategory(exteriorItemsConfig, EXTERIOR_CATEGORY_NAMES.EXTERIOR_LEFT_SIDE)) && !skipLeft;
  const showExteriorRightSide = (!hasExteriorConfig || hasCategory(exteriorItemsConfig, EXTERIOR_CATEGORY_NAMES.EXTERIOR_RIGHT_SIDE)) && !skipRight;
  const showFrontLeftCorner = (!hasExteriorConfig || hasCategory(exteriorItemsConfig, EXTERIOR_CATEGORY_NAMES.FRONT_LEFT_CORNER)) && !skipLeftCorners;
  const showFrontRightCorner = (!hasExteriorConfig || hasCategory(exteriorItemsConfig, EXTERIOR_CATEGORY_NAMES.FRONT_RIGHT_CORNER)) && !skipRightCorners;
  const showRearLeftCorner = (!hasExteriorConfig || hasCategory(exteriorItemsConfig, EXTERIOR_CATEGORY_NAMES.REAR_LEFT_CORNER)) && !skipLeftCorners;
  const showRearRightCorner = (!hasExteriorConfig || hasCategory(exteriorItemsConfig, EXTERIOR_CATEGORY_NAMES.REAR_RIGHT_CORNER)) && !skipRightCorners;
  const showInsideCargoRoof = !hasExteriorConfig || hasCategory(exteriorItemsConfig, EXTERIOR_CATEGORY_NAMES.INSIDE_CARGO_ROOF);

  const visibleSections = [showFront, showRear, showExteriorLeftSide, showExteriorRightSide, showFrontLeftCorner, showFrontRightCorner, showRearLeftCorner, showRearRightCorner, showInsideCargoRoof];
  const lastVisibleIndex = visibleSections.reduce((last, visible, index) => (visible ? index : last), -1);

  const isLastSection = index => index === lastVisibleIndex;

  return (
    <View
      style={{
        ...expandedCardContainer,
        ...container,
        paddingVertical: 0,
      }}>
      {showFront && (
        <ImagesPickerContainer
          ExteriorDetails={enrichWithCategoryId(ExteriorFrontDetails(selectedVehicleKind), exteriorItemsConfig)}
          pickerText={defaultPickerText}
          imageURL={exteriorItems?.exteriorFront}
          imageURLOne={exteriorItems?.exteriorFront_1}
          imageURLTwo={exteriorItems?.exteriorFront_2}
          imageURL_ID={exteriorItems?.exteriorFrontID}
          imageURLOne_ID={exteriorItems?.exteriorFront_1ID}
          imageURLTwo_ID={exteriorItems?.exteriorFront_2ID}
          isLoading={isLoading}
          handleItemPickerPress={handleItemPickerPress}
          handleCrossPress={handleCrossPress}
          handleMediaModalDetailsPress={handleMediaModalDetailsPress}
          exteriorItems={exteriorItems}
          borderBottomWidth={isLastSection(0) ? 0 : 1}
        />
      )}
      {showRear && (
        <ImagesPickerContainer
          ExteriorDetails={enrichWithCategoryId(ExteriorRearDetails(selectedVehicleKind), exteriorItemsConfig)}
          pickerText={defaultPickerText}
          imageURL={exteriorItems?.exteriorRear}
          imageURLOne={exteriorItems?.exteriorRear_1}
          imageURLTwo={exteriorItems?.exteriorRear_2}
          imageURL_ID={exteriorItems?.exteriorRearID}
          imageURLOne_ID={exteriorItems?.exteriorRear_1ID}
          imageURLTwo_ID={exteriorItems?.exteriorRear_2ID}
          isLoading={isLoading}
          handleItemPickerPress={handleItemPickerPress}
          handleCrossPress={handleCrossPress}
          handleMediaModalDetailsPress={handleMediaModalDetailsPress}
          exteriorItems={exteriorItems}
          borderBottomWidth={isLastSection(1) ? 0 : 1}
        />
      )}
      {showExteriorLeftSide && (
        <ImagesPickerContainer
          ExteriorDetails={enrichWithCategoryId(ExteriorLeftDetails, exteriorItemsConfig, EXTERIOR_CATEGORY_NAMES.EXTERIOR_LEFT_SIDE)}
          pickerText={defaultPickerText}
          imageURL={exteriorItems?.exteriorLeft}
          imageURLOne={exteriorItems?.exteriorLeft_1}
          imageURLTwo={exteriorItems?.exteriorLeft_2}
          imageURL_ID={exteriorItems?.exteriorLeftID}
          imageURLOne_ID={exteriorItems?.exteriorLeft_1ID}
          imageURLTwo_ID={exteriorItems?.exteriorLeft_2ID}
          isLoading={isLoading}
          handleItemPickerPress={handleItemPickerPress}
          handleCrossPress={handleCrossPress}
          handleMediaModalDetailsPress={handleMediaModalDetailsPress}
          exteriorItems={exteriorItems}
          borderBottomWidth={isLastSection(2) ? 0 : 1}
        />
      )}
      {showExteriorRightSide && (
        <ImagesPickerContainer
          ExteriorDetails={enrichWithCategoryId(ExteriorRightDetails, exteriorItemsConfig, EXTERIOR_CATEGORY_NAMES.EXTERIOR_RIGHT_SIDE)}
          pickerText={defaultPickerText}
          imageURL={exteriorItems?.exteriorRight}
          imageURLOne={exteriorItems?.exteriorRight_1}
          imageURLTwo={exteriorItems?.exteriorRight_2}
          imageURL_ID={exteriorItems?.exteriorRightID}
          imageURLOne_ID={exteriorItems?.exteriorRight_1ID}
          imageURLTwo_ID={exteriorItems?.exteriorRight_2ID}
          isLoading={isLoading}
          handleItemPickerPress={handleItemPickerPress}
          handleCrossPress={handleCrossPress}
          handleMediaModalDetailsPress={handleMediaModalDetailsPress}
          exteriorItems={exteriorItems}
          borderBottomWidth={isLastSection(3) ? 0 : 1}
        />
      )}
      {showFrontLeftCorner && (
        <ImagesPickerContainer
          ExteriorDetails={enrichWithCategoryId(ExteriorFrontLeftCornerDetails(selectedVehicleKind), exteriorItemsConfig)}
          pickerText={defaultPickerText}
          imageURL={exteriorItems?.exteriorFrontLeftCorner}
          imageURLOne={exteriorItems?.exteriorFrontLeftCorner_1}
          imageURLTwo={exteriorItems?.exteriorFrontLeftCorner_2}
          imageURL_ID={exteriorItems?.exteriorFrontLeftCornerID}
          imageURLOne_ID={exteriorItems?.exteriorFrontLeftCorner_1ID}
          imageURLTwo_ID={exteriorItems?.exteriorFrontLeftCorner_2ID}
          isLoading={isLoading}
          handleItemPickerPress={handleItemPickerPress}
          handleCrossPress={handleCrossPress}
          handleMediaModalDetailsPress={handleMediaModalDetailsPress}
          exteriorItems={exteriorItems}
          borderBottomWidth={isLastSection(4) ? 0 : 1}
        />
      )}
      {showFrontRightCorner && (
        <ImagesPickerContainer
          ExteriorDetails={enrichWithCategoryId(ExteriorFrontRightCornerDetails(selectedVehicleKind), exteriorItemsConfig)}
          pickerText={defaultPickerText}
          imageURL={exteriorItems?.exteriorFrontRightCorner}
          imageURLOne={exteriorItems?.exteriorFrontRightCorner_1}
          imageURLTwo={exteriorItems?.exteriorFrontRightCorner_2}
          imageURL_ID={exteriorItems?.exteriorFrontRightCornerID}
          imageURLOne_ID={exteriorItems?.exteriorFrontRightCorner_1ID}
          imageURLTwo_ID={exteriorItems?.exteriorFrontRightCorner_2ID}
          isLoading={isLoading}
          handleItemPickerPress={handleItemPickerPress}
          handleCrossPress={handleCrossPress}
          handleMediaModalDetailsPress={handleMediaModalDetailsPress}
          exteriorItems={exteriorItems}
          borderBottomWidth={isLastSection(5) ? 0 : 1}
        />
      )}
      {showRearLeftCorner && (
        <ImagesPickerContainer
          ExteriorDetails={enrichWithCategoryId(ExteriorRearLeftCornerDetails(selectedVehicleKind), exteriorItemsConfig)}
          pickerText={defaultPickerText}
          imageURL={exteriorItems?.exteriorRearLeftCorner}
          imageURLOne={exteriorItems?.exteriorRearLeftCorner_1}
          imageURLTwo={exteriorItems?.exteriorRearLeftCorner_2}
          imageURL_ID={exteriorItems?.exteriorRearLeftCornerID}
          imageURLOne_ID={exteriorItems?.exteriorRearLeftCorner_1ID}
          imageURLTwo_ID={exteriorItems?.exteriorRearLeftCorner_2ID}
          isLoading={isLoading}
          handleItemPickerPress={handleItemPickerPress}
          handleCrossPress={handleCrossPress}
          handleMediaModalDetailsPress={handleMediaModalDetailsPress}
          exteriorItems={exteriorItems}
          borderBottomWidth={isLastSection(6) ? 0 : 1}
        />
      )}
      {showRearRightCorner && (
        <ImagesPickerContainer
          ExteriorDetails={enrichWithCategoryId(ExteriorRearRightCornerDetails(selectedVehicleKind), exteriorItemsConfig)}
          pickerText={defaultPickerText}
          imageURL={exteriorItems?.exteriorRearRightCorner}
          imageURLOne={exteriorItems?.exteriorRearRightCorner_1}
          imageURLTwo={exteriorItems?.exteriorRearRightCorner_2}
          imageURL_ID={exteriorItems?.exteriorRearRightCornerID}
          imageURLOne_ID={exteriorItems?.exteriorRearRightCorner_1ID}
          imageURLTwo_ID={exteriorItems?.exteriorRearRightCorner_2ID}
          isLoading={isLoading}
          handleItemPickerPress={handleItemPickerPress}
          handleCrossPress={handleCrossPress}
          handleMediaModalDetailsPress={handleMediaModalDetailsPress}
          exteriorItems={exteriorItems}
          borderBottomWidth={isLastSection(7) ? 0 : 1}
        />
      )}
      {showInsideCargoRoof && (
        <ImagesPickerContainer
          ExteriorDetails={enrichWithCategoryId(ExteriorInsideCargoRoofDetails(selectedVehicleKind), exteriorItemsConfig)}
          pickerText={defaultPickerText}
          imageURL={exteriorItems?.exteriorInsideCargoRoof}
          imageURLOne={exteriorItems?.exteriorInsideCargoRoof_1}
          imageURLTwo={exteriorItems?.exteriorInsideCargoRoof_2}
          imageURL_ID={exteriorItems?.exteriorInsideCargoRoofID}
          imageURLOne_ID={exteriorItems?.exteriorInsideCargoRoof_1ID}
          imageURLTwo_ID={exteriorItems?.exteriorInsideCargoRoof_2ID}
          isLoading={isLoading}
          handleItemPickerPress={handleItemPickerPress}
          handleCrossPress={handleCrossPress}
          handleMediaModalDetailsPress={handleMediaModalDetailsPress}
          exteriorItems={exteriorItems}
          borderBottomWidth={0}
        />
      )}
    </View>
  );
};
export default ExteriorItemsExpandedCard;
