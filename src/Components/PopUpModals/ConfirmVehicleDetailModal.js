import React, { useEffect, useState } from 'react';
import { View, Text, Modal, StyleSheet, TextInput, Keyboard, TouchableOpacity, Platform } from 'react-native';
import { heightPercentageToDP as hp, widthPercentageToDP as wp } from 'react-native-responsive-screen';

import { PrimaryGradientButton } from '../index';
import { circleBorderRadius, colors, modalStyle } from '../../Assets/Styles';
import { removeAlphabets } from '../../Utils/helpers';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

const { red, gray, orange, black, white } = colors;
const { modalOuterContainer, container, modalContainer, header, body, footer, button, yesText } = modalStyle;

import { useTranslation } from 'react-i18next';

const ConfirmVehicleDetailModal = ({
  visible = true,
  title,
  description,
  onConfirmPress,
  onCrossPress,
  buttonText,
  placeHolder,
  numberPlateText = '',
  isLoading = false,
  textLimit = 20,
  keyboardType = 'default',
  inputMode,
  errorMessage = '',
  crossButtonColor = orange,
  crossButtonStyle,
}) => {
  const { t } = useTranslation();
  const defaultTitle = title || t('confirmVehicleDetail.title');
  const defaultDescription = description || t('confirmVehicleDetail.description');
  const defaultButtonText = buttonText || t('confirmVehicleDetail.buttonText');
  const defaultPlaceHolder = placeHolder || t('confirmVehicleDetail.placeHolder');

  const [numberPlate, setNumberPlate] = useState(numberPlateText);
  const text_Limit = numberPlate.length + '/' + textLimit;

  // Re-seed the input from the source of truth every time the modal opens. The component
  // stays mounted while hidden, so a value the user typed — or cleared — and then dismissed
  // with the cross would otherwise still be sitting there on the next open.
  useEffect(() => {
    if (!visible) {
      return;
    }
    handleInputChange(numberPlateText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numberPlateText, visible]);

  const onTouchDismissKeyboard = () => Keyboard.dismiss();
  function clearState() {
    setNumberPlate('');
  }
  function handleInputChange(text) {
    if (inputMode === 'decimal') {
      let input = removeAlphabets(text);

      let list = ['0', ''];

      if (list.includes(input)) {
        input = '';
      }
      setNumberPlate(input);
    } else {
      setNumberPlate(text);
    }
  }

  return (
    <Modal animationType="slide" statusBarTranslucent transparent={true} visible={visible} style={modalOuterContainer}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableOpacity style={container} activeOpacity={1} onPress={onTouchDismissKeyboard}>
          <View style={modalContainer}>
            {!!onCrossPress && (
              <TouchableOpacity style={[styles.crossIcon, { backgroundColor: crossButtonColor }, crossButtonStyle]} onPress={onCrossPress} activeOpacity={0.7}>
                <Text style={styles.crossText}>✕</Text>
              </TouchableOpacity>
            )}
            <Text style={header}>{title}</Text>
            {numberPlateText?.length === 0 && <Text style={[body, { color: red }]}>{description}</Text>}
            {errorMessage && <Text style={[body, { color: red }]}>{errorMessage}</Text>}
            <TextInput
              value={numberPlate}
              placeholder={defaultPlaceHolder}
              placeholderTextColor={gray}
              style={styles.numberPlateInput}
              enterKeyHint={'done'}
              editable={!isLoading}
              onChangeText={handleInputChange}
              maxLength={textLimit}
              keyboardType={keyboardType}
              inputMode={inputMode}
              onSubmitEditing={() => onConfirmPress(numberPlate)}
            />
            <Text style={styles.textLimit}>{text_Limit}</Text>
            <View style={footer}>
              <PrimaryGradientButton
                text={defaultButtonText}
                disabled={isLoading}
                buttonStyle={button}
                textStyle={yesText}
                onPress={() => onConfirmPress(numberPlate, clearState)}
              />
            </View>
          </View>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  crossIcon: {
    backgroundColor: orange,
    borderRadius: circleBorderRadius,
    position: 'absolute',
    zIndex: 1,
    top: hp('0.8%'),
    right: wp('2%'),
    width: wp('7%'),
    height: wp('7%'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  crossText: {
    color: white,
    fontSize: hp('1.8%'),
    fontWeight: 'bold',
    lineHeight: hp('2%'),
  },
  numberPlateInput: {
    borderWidth: 1,
    borderColor: gray,
    fontSize: hp('1.8%'),
    padding: wp('2.5%'),
    width: wp('80%'),
    color: black,
  },
  textLimit: {
    width: '95%',
    color: black,
    textAlign: 'right',
    fontSize: hp('1.6%'),
  },
});

export default ConfirmVehicleDetailModal;
