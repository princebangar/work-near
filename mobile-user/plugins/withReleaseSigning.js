// Signs local release builds (gradlew assembleRelease) with the WorkNear upload keystore named in Gradle properties,
// so the generated android/ folder is never edited by hand. Keystore + passwords live outside the repo:
//   ~/.gradle/gradle.properties
//     WORKNEAR_USER_STORE_FILE=C:/Users/<you>/.worknear/worknear-user-upload.jks
//     WORKNEAR_USER_KEY_ALIAS=worknear-user
//     WORKNEAR_USER_STORE_PASSWORD=...
//     WORKNEAR_USER_KEY_PASSWORD=...
// Without those properties the release build falls back to the debug key (as the Expo template does).
const { withAppBuildGradle } = require('expo/config-plugins');

const SIGNING_BLOCK = `
        release {
            if (project.hasProperty('WORKNEAR_USER_STORE_FILE')) {
                storeFile file(WORKNEAR_USER_STORE_FILE)
                storePassword WORKNEAR_USER_STORE_PASSWORD
                keyAlias WORKNEAR_USER_KEY_ALIAS
                keyPassword WORKNEAR_USER_KEY_PASSWORD
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (!gradle.includes('WORKNEAR_USER_STORE_FILE')) {
      gradle = gradle.replace(/signingConfigs\s*\{([\s\S]*?debug\s*\{[\s\S]*?\})/, (m) => `${m}${SIGNING_BLOCK}`);
      gradle = gradle.replace(
        /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/,
        `$1signingConfig project.hasProperty('WORKNEAR_USER_STORE_FILE') ? signingConfigs.release : signingConfigs.debug`,
      );
    }
    cfg.modResults.contents = gradle;
    return cfg;
  });
};
