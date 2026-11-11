import MyTripsScreen from '../Features/CameraAlignment/MyTripsScreen';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {ROUTES, STACKS} from './ROUTES';
import {stackScreenOptions} from './navigationOptions';
import {
  ForgotPasswordContainer,
  InspectionReviewedContainer,
  RegisterContainer,
  ResetPasswordContainer,
  SignInContainer,
  WelcomeContainer,
} from '../Container';
import Home from '../Screens/NewDesign/Home';
import { CaptureOdometerScreen, CaptureReceiptScreen, ConfirmFuelVehicleScreen, FuelLocationConfirmScreen, FuelVerifiedSubmitScreen, PreFuelGaugeScreen, VerifyFuelingScreen } from '../Screens/NewDesign/FuelVerification';
import {MyProfile, VehicleInformation} from '../Screens';

const Stack = createNativeStackNavigator();

export const AuthStack = () => (
  <Stack.Navigator initialRouteName={ROUTES.WELCOME} screenOptions={stackScreenOptions}>
    <Stack.Screen name={ROUTES.WELCOME} component={WelcomeContainer} />
    <Stack.Screen name={ROUTES.REGISTER} component={RegisterContainer} />
    <Stack.Screen name={ROUTES.SIGN_IN} component={SignInContainer} />
    <Stack.Screen name={ROUTES.FORGET_PASSWORD} component={ForgotPasswordContainer} />
    <Stack.Screen name={ROUTES.RESET_PASSWORD} component={ResetPasswordContainer} />
  </Stack.Navigator>
);

// BOTTOM TAB STACKS
export const HomeTabStack = () => (
  <Stack.Navigator initialRouteName={ROUTES.HOME} screenOptions={stackScreenOptions}>
    <Stack.Screen name={ROUTES.HOME} component={Home} />
    <Stack.Screen name={ROUTES.VERIFY_FUELING} component={VerifyFuelingScreen} />
    <Stack.Screen name={ROUTES.CONFIRM_FUEL_VEHICLE} component={ConfirmFuelVehicleScreen} />
    <Stack.Screen name={ROUTES.FUEL_LOCATION_CONFIRM} component={FuelLocationConfirmScreen} />
    <Stack.Screen name={ROUTES.CAPTURE_ODOMETER} component={CaptureOdometerScreen} />
    <Stack.Screen name={ROUTES.PRE_FUEL_GAUGE} component={PreFuelGaugeScreen} />
    <Stack.Screen name={ROUTES.CAPTURE_RECEIPT} component={CaptureReceiptScreen} />
    <Stack.Screen name={ROUTES.FUEL_VERIFIED_SUBMIT} component={FuelVerifiedSubmitScreen} />
  </Stack.Navigator>
);

export const ReportTabStack = () => (
  <Stack.Navigator initialRouteName={ROUTES.INSPECTION_REVIEWED} screenOptions={stackScreenOptions}>
    <Stack.Screen name={ROUTES.INSPECTION_REVIEWED} component={InspectionReviewedContainer} />
  </Stack.Navigator>
);

export const InspectionTabStack = () => (
  <Stack.Navigator initialRouteName={ROUTES.VEHICLE_INFORMATION} screenOptions={stackScreenOptions}>
    <Stack.Screen name={ROUTES.VEHICLE_INFORMATION} component={VehicleInformation} />
  </Stack.Navigator>
);

export const MyTripsTabStack = () => (
  <Stack.Navigator initialRouteName={ROUTES.MY_TRIPS} screenOptions={stackScreenOptions}>
    <Stack.Screen name={ROUTES.MY_TRIPS} component={MyTripsScreen} />
  </Stack.Navigator>
);

export const ProfileTabStack = () => (
  <Stack.Navigator initialRouteName={ROUTES.MY_PROFILE} screenOptions={stackScreenOptions}>
    <Stack.Screen name={ROUTES.MY_PROFILE} component={MyProfile} />
  </Stack.Navigator>
);
