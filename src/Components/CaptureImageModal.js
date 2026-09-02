import React, { useState, useMemo } from 'react';
import { Modal, StyleSheet, View, Text, TouchableOpacity, StatusBar, Platform } from 'react-native';
import { heightPercentageToDP as hp, widthPercentageToDP as wp } from 'react-native-responsive-screen';
import FastImage from 'react-native-fast-image';
import Video from 'react-native-video';
import { useSelector } from 'react-redux';
import * as Progress from 'react-native-progress';
import { Cross, Expand, Info } from '../Assets/Icons';
import { colors } from '../Assets/Styles';
import { PrimaryGradientButton, RequiredIndicator, Sub_Heading } from './index';
import Collapse from '../Assets/Icons/Collapse';
import { MAX_UPLOAD_RETRIES, Platforms } from '../Constants';
import { headerFlex, headerFlexGrow, headerTextBottom, imageHeight, instructionsContainerTop } from '../Utils/helpers';

import { useTranslation } from 'react-i18next';

const { OS } = Platform;
const { ANDROID } = Platforms;
const Accordion = {
  true: Expand,
  false: Collapse,
};
const { blueGray, orangePeel, cobaltBlueDark, white } = colors;

const CaptureImageModal = ({
  modalVisible,
  handleVisible,
  handleCaptureImage,
  source,
  instructionalText,
  instructionalSubHeadingText,
  instructionalSubHeadingText_1,
  instructionalSubHeadingText_2,
  buttonText,
  title,
  isVideo = false,
  modalKey,
  isLoading = false,
  progress = 0,
  isCarVerification = false,
  isExterior = true,
  labelRequired = null,
  inspectionScreen = false,
  retryAttempt = 0,
  retryLimit = MAX_UPLOAD_RETRIES,
  isWaitingForConnection = false,
}) => {
  const { t } = useTranslation();
  const { fileRequired = null } = useSelector(state => state.newInspection);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const height = hp('5%');
  const width = wp('5%');
  const ACCORDION_COMPONENT = Accordion[isFullScreen];

  const calculatedStyles = useMemo(
    () => ({
      headerFlex: headerFlex[Boolean(instructionalSubHeadingText)],
      headerFlexGrow: headerFlexGrow[isExterior],
      headerTextBottom: headerTextBottom[isFullScreen],
      imageHeight: imageHeight[isCarVerification],
      instructionsContainerTop: instructionsContainerTop[isFullScreen],
    }),
    [instructionalSubHeadingText, isExterior, isFullScreen, isCarVerification]
  );

  const normalizedProgressValue = Math.min(Math.max(progress / 100, 0), 1); // clamp
  const isRetrying = retryAttempt > 0;
  let loadingText = progress === 100 ? t('annotation.finalizingUpload') : t('annotation.uploading');
  if (isRetrying) {
    loadingText = t('annotation.retryingUpload', { attempt: retryAttempt, total: retryLimit });
  }
  if (isWaitingForConnection) {
    loadingText = t('annotation.waitingForConnection');
  }
  return (
    <Modal
      animationType="slide"
      statusBarTranslucent
      transparent={true}
      visible={modalVisible}
      onRequestClose={handleVisible}
      style={styles.container}>
      <View style={styles.centeredView}>
        <TouchableOpacity style={styles.crossIconContainer} onPress={handleVisible} disabled={isLoading}>
          <Cross height={hp('8%')} width={wp('10%')} color={white} />
        </TouchableOpacity>
        <View
          style={[
            styles.header,
            {
              flex: calculatedStyles.headerFlex,
              flexGrow: calculatedStyles.headerFlexGrow,
            },
          ]}>
          <View style={styles.headerLabels}>
            <RequiredIndicator required={labelRequired || fileRequired} />
            <Text style={[styles.titleText, styles.textColor, { bottom: calculatedStyles.headerTextBottom }]}>{title}</Text>
          </View>
          {isVideo ? (
            <>
              {OS === ANDROID ? (
                <View style={styles.image}>
                  <TouchableOpacity style={styles.iconContainer} onPress={() => setIsFullScreen(!isFullScreen)}>
                    <ACCORDION_COMPONENT height={height} width={width} color={white} />
                  </TouchableOpacity>
                  <Video
                    video={source}
                    videoHeight={isFullScreen ? hp('50%') : hp('25%')}
                    videoWidth={wp('90%')}
                    autoplay={true}
                    fullScreenOnLongPress={true}
                  />
                </View>
              ) : (
                <Video source={source} controls={true} playInBackground={false} resizeMode={'contain'} style={styles.image} />
              )}
            </>
          ) : inspectionScreen ? (
            <FastImage
              source={source}
              resizeMode="cover"
              style={{
                width: wp('100%'),
                height: hp('25%'),
              }}
            />
          ) : (

            <FastImage source={source} priority={'normal'} resizeMode={'cover'} style={[styles.image, { height: calculatedStyles.imageHeight }]} />
          )}
          <View style={styles.instructionsAndSubHeadingContainer}>
            <View style={[styles.instructionsContainer, { top: calculatedStyles.instructionsContainerTop }]}>
              <Info height={hp('4%')} width={wp('7%')} color={white} />
              <Text style={[styles.instructionsText, styles.textColor]}>{instructionalText}</Text>
            </View>
            <Sub_Heading text={instructionalSubHeadingText} styles={styles} />
            <Sub_Heading text={instructionalSubHeadingText_1} styles={styles} />
            <Sub_Heading text={instructionalSubHeadingText_2} styles={styles} />
          </View>
        </View>
        {isLoading ? (
          <View
            style={[
              styles.body,
              {
                justifyContent: 'center',
                top: OS === ANDROID && isFullScreen ? hp('8%') : null,
              },
            ]}>
            <Progress.Circle
              borderColor={colors.orangePeel}
              strokeCap="round"
              animated={true}
              color={colors.orangePeel}
              unfilledColor={colors.blueGray}
              size={wp('35%')}
              borderWidth={0}
              thickness={10}
              progress={normalizedProgressValue}
              showsText
              formatText={() => `${progress}%`}
              textStyle={{ fontWeight: 'bold', color: colors.white }}
            />
            <Text style={[styles.textColor, styles.loadingText, (isRetrying || isWaitingForConnection) && styles.retryingText]}>{loadingText}</Text>
          </View>
        ) : (
          <View style={styles.body}>
            <PrimaryGradientButton text={buttonText} onPress={() => handleCaptureImage(isVideo, modalKey)} />
          </View>
        )}
        <View style={styles.footerView} />
      </View>
      <StatusBar backgroundColor={cobaltBlueDark} barStyle="light-content" translucent={true} />
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: cobaltBlueDark,
    paddingTop: hp('7%'),
  },
  header: {
    flex: 1,
    width: wp('100%'),
    // justifyContent: 'space-evenly',
    alignItems: 'center',
    rowGap: hp('3%'),
  },
  titleText: {
    fontSize: hp('3%'),
    fontWeight: '600',
    textAlign: 'center',
  },
  instructionsContainer: {
    width: wp('90%'),
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  instructionsText: {
    fontSize: hp('1.8%'),
    width: wp('80%'),
  },
  subHeadingContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    width: wp('80%'),
    paddingLeft: 20,
  },
  dot: {
    backgroundColor: white,
    marginRight: 10,
    top: 0,
  },
  body: {
    flex: 1,
    width: wp('100%'),
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  image: {
    width: wp('90%'),
    borderRadius: 10,
  },
  video: {
    height: OS === ANDROID ? '100%' : hp('25%'),
    width: OS === ANDROID ? '90%' : wp('90%'),
    borderRadius: 10,
    left: OS === ANDROID ? wp('5%') : null,
  },
  imageStyle: {
    height: hp('50%'),
    width: wp('90%'),
    borderRadius: 10,
    marginVertical: hp('2%'),
    left: OS === ANDROID ? wp('5%') : null,
  },
  crossIconContainer: {
    position: 'absolute',
    top: 30,
    right: 20,
    zIndex: 1,
  },
  textColor: {
    color: white,
  },
  footerView: {
    flex: 0.1,
  },
  instructionsAndSubHeadingContainer: {
    alignItems: 'center',
    rowGap: hp('0.5%'),
  },
  loadingText: {
    fontSize: hp('1.8%'),
    paddingTop: hp('1%'),
    textAlign: 'center',
    paddingHorizontal: wp('8%'),
  },
  retryingText: {
    color: orangePeel,
  },
  iconContainer: {
    position: 'absolute',
    color: '#fff',
    right: 0,
    top: 0,
    margin: 10,
  },
  headerLabels: {
    alignItems: 'center',
    rowGap: hp('0.5%'),
  },
});

export default CaptureImageModal;
