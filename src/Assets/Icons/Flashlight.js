import React from 'react';
import Svg, { Path } from 'react-native-svg';

const Flashlight = ({ enabled, color, width = 28, height = 28 }) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Path
      d="M13 2 4 14h7l-1 8 10-12h-7l1-8Z"
      stroke={color}
      strokeWidth={1.8}
      strokeLinejoin="round"
      fill={enabled ? color : 'none'}
    />
    {!enabled && <Path d="m3 3 18 18" stroke={color} strokeWidth={1.8} strokeLinecap="round" />}
  </Svg>
);

export default Flashlight;
