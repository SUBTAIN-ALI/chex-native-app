/**
 * @format
 */
import React from 'react';
import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import './src/Utils/i18n'; // Initialize i18n for translations
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import App from './App';
import { name as appName } from './app.json';
import { persistor, store } from './src/Store';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';

const InitializeRedux = () => (
  <Provider store={store}>
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <PersistGate persistor={persistor}>
        {/* Do not enable `navigationBarTranslucent`: it makes the RN root draw under the
            Android navigation bar, which hides bottom UI on 3-button navigation. */}
        <KeyboardProvider>
          <App />
        </KeyboardProvider>
      </PersistGate>
    </SafeAreaProvider>
  </Provider>
);

AppRegistry.registerComponent(appName, () => InitializeRedux);
