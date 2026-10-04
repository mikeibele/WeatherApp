# update eas
npm install -g eas-cli

# login to eas
eas login

# configure build
eas build:configure

# build production apk
eas build -p android --profile productionApk

# build development apk without --clear-cache
eas build -p android --profile developmentApk

# build development apk with --clear-cache
eas build -p android --profile developmentApk --clear-cache

# build development ios
eas build -p ios --profile developmentIos

# build production ios
eas build -p ios --profile productionIos

# add test devices for ios
eas device:create

# check build first locally
npx expo-doctor@latest --verbose

# check dependencies compatability
npx expo install --check

# register device for distribution build
eas device:create

# upgrade to latest version of expo
npx expo install expo@latest

npx expo prebuild

eas build --platform android
eas build --platform ios
eas build --platform android --auto-submit
eas build --platform ios --auto-submit