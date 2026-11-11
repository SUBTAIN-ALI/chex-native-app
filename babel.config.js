module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module:react-native-dotenv',
      {
        envName: 'APP_ENV',
        moduleName: '@env',
        path: '.env',
      },
    ],
  ],
  // Keep the two worklet runtimes' transforms isolated.
  overrides: [
    {
      test: /(?:Features[\/]CameraAlignment|node_modules[\/](?:react-native-vision-camera|vision-camera-resize-plugin|react-native-worklets-core))[\/]/,
      plugins: ['react-native-worklets-core/plugin'],
    },
    {
      exclude:
        /(?:Features[\/]CameraAlignment|node_modules[\/](?:react-native-vision-camera|vision-camera-resize-plugin|react-native-worklets-core))[\/]/,
      plugins: ['react-native-worklets/plugin'],
    },
  ],
};
