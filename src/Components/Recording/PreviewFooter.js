import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, Platform } from 'react-native';
import { widthPercentageToDP as wp } from 'react-native-responsive-screen';

import { PrimaryGradientButton, SecondaryButton } from '../index';
import { Platforms } from '../../Constants';

const { OS } = Platform;
const { IOS } = Platforms;

const PreviewFooter = ({ onRetryPress, onNextPress, isUploading = false }) => {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <SecondaryButton
        text={t('common.retry')}
        buttonStyle={[styles.button, styles.retryButton]}
        onPress={onRetryPress}
      />
      <PrimaryGradientButton
        text={t('common.next')}
        buttonStyle={styles.button}
        onPress={onNextPress}
        buttonDisabled={isUploading}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: OS === IOS ? 0.2 : 0,
    width: wp('100%'),
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: '5%',
  },
  button: {
    width: wp('35%'),
  },
  retryButton: {
    borderRadius: 20,
  },
});

export default PreviewFooter;
