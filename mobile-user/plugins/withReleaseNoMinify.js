// Release builds without R8 shrinking: Firebase, maps, notifications and WorkManager create classes by reflection,
// and an R8-stripped WorkManager database crashes the app at start. Keep rules are added for when R8 is switched back on.
const fs = require('fs');
const path = require('path');
const { withDangerousMod, withGradleProperties } = require('expo/config-plugins');

const MARK = '# worknear: Room / WorkManager';
const RULES = `
${MARK} (WorkManager's database is created by reflection)
-keep class * extends androidx.room.RoomDatabase { <init>(); }
-keep class androidx.work.impl.WorkDatabase_Impl { *; }
`;

const setProperty = (props, key, value) => {
  const item = props.find((p) => p.type === 'property' && p.key === key);
  if (item) item.value = value;
  else props.push({ type: 'property', key, value });
};

module.exports = function withReleaseNoMinify(config) {
  config = withGradleProperties(config, (cfg) => {
    setProperty(cfg.modResults, 'android.enableMinifyInReleaseBuilds', 'false');
    setProperty(cfg.modResults, 'android.enableShrinkResourcesInReleaseBuilds', 'false');
    return cfg;
  });
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      if (fs.existsSync(file)) {
        const text = fs.readFileSync(file, 'utf8');
        if (!text.includes(MARK)) fs.writeFileSync(file, `${text.trimEnd()}\n${RULES}`);
      }
      return cfg;
    },
  ]);
};
