// app.json holds the static config; this fills in values that come from .env (Expo loads .env before this runs).
// google-services.json (Firebase / FCM push for com.worknear.user) is picked up automatically once it is placed next to this file.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const plugins = (config.plugins || []).map((plugin) =>
    Array.isArray(plugin) && plugin[0] === 'react-native-maps' ? ['react-native-maps', { ...plugin[1], androidGoogleMapsApiKey: mapsKey }] : plugin,
  );
  const hasFirebase = fs.existsSync(path.join(__dirname, 'google-services.json'));
  return {
    ...config,
    plugins,
    android: { ...config.android, ...(hasFirebase && { googleServicesFile: './google-services.json' }) },
  };
};
