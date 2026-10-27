// Windows only: native C++ builds (react-native-screens, svg, maps codegen …) produce object paths longer than 260 chars.
// The SDK's default CMake 3.22.1 ships a ninja that cannot open them, so point `cmake.dir` at a newer SDK CMake
// (default 3.31.6; override with WN_CMAKE_VERSION). macOS / Linux builds are untouched.
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

module.exports = function withWindowsCmake(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      if (process.platform !== 'win32') return cfg;
      const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(process.env.USERPROFILE || '', 'Android', 'Sdk');
      const cmakeDir = path.join(sdk, 'cmake', process.env.WN_CMAKE_VERSION || '3.31.6');
      if (!fs.existsSync(path.join(cmakeDir, 'bin', 'ninja.exe'))) {
        console.warn(`[withWindowsCmake] ${cmakeDir} not found: install it with sdkmanager "cmake;3.31.6"`);
        return cfg;
      }
      const file = path.join(cfg.modRequest.platformProjectRoot, 'local.properties');
      const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l && !l.startsWith('cmake.dir=')) : [];
      lines.push(`cmake.dir=${cmakeDir.replace(/\\/g, '/')}`);
      fs.writeFileSync(file, `${lines.join('\n')}\n`);
      return cfg;
    },
  ]);
};
