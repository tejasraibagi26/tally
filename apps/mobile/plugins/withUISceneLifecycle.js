// Vendored from expo/config-plugins@main packages/expo-uiscene-lifecycle/src/index.ts
// (PR https://github.com/expo/config-plugins/pull/326, merged 2026-09 by the Expo
// team) -- ported to plain JS since the package is merged but not yet published to
// npm (confirmed via `npm view @config-plugins/expo-uiscene-lifecycle`: 404 as of
// 2026-09-20). Delete this file and the plugin entry in app.json, and install the
// real package instead, once it ships.
//
// Why this exists at all: Xcode 27's iOS SDK requires UIKit scene lifecycle
// adoption at launch (Apple deprecated the non-scene lifecycle with iOS 26 and
// iOS 27 enforces it) -- an app built with SDK 57's standard non-scene Swift
// AppDelegate template instantly crashes on launch on a real iOS 27 device (it
// never crashed in the simulator here because that was running iOS 26.5). This
// plugin switches the generated AppDelegate to defer window creation and RN
// startup to Expo's own `ExpoAppSceneDelegate` runtime (shipped in expo 57.0.23+,
// see node_modules/expo/ios/AppDelegates/ExpoAppSceneDelegate.swift) instead of
// hand-patching Swift/Info.plist ourselves. SDK 58+ ships this natively and
// rejects this plugin -- delete it entirely once this project moves to SDK 58.
const { withAppDelegate, withInfoPlist } = require("expo/config-plugins");
const semver = require("semver");

const PLUGIN_NAME = "withUISceneLifecycle";
const MINIMUM_EXPO_VERSION = "57.0.23";
const ORIGINAL_APP_DELEGATE = "class AppDelegate: ExpoAppDelegate {";
const SCENE_APP_DELEGATE = "class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {";
const FACTORY_ASSIGNMENT = "    reactNativeFactory = factory";
const LEGACY_STARTUP = `    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
`;
// The generated AppDelegate wraps LEGACY_STARTUP in an os(iOS)/os(tvOS)
// compile-time guard. The upstream plugin's replacement only strips
// LEGACY_STARTUP itself, which leaves an empty, now-broken
// "#if os(iOS) || os(tvOS)#endif" mashed onto one line (the newlines on
// both sides of LEGACY_STARTUP get consumed by that replace, so nothing
// separates the two directives) -- verified against this project's actual
// generated ios/Tally/AppDelegate.swift. Matching/removing the whole guard
// block instead keeps the result valid Swift.
const STARTUP_GUARD = `\n#if os(iOS) || os(tvOS)\n${LEGACY_STARTUP}#endif\n`;

const SCENE_MANIFEST = {
  UIApplicationSupportsMultipleScenes: false,
  UISceneConfigurations: {
    UIWindowSceneSessionRoleApplication: [
      {
        UISceneConfigurationName: "Default Configuration",
        UISceneDelegateClassName: "EXExpoAppSceneDelegate",
      },
    ],
  },
};

// The upstream plugin checks `config.sdkVersion` against MINIMUM_EXPO_VERSION,
// but Expo's config system reports that as the coarse SDK version ("57.0.0"
// for every SDK 57 project, regardless of the installed expo package's patch
// version) -- so that check can never pass and isn't actually what we care
// about anyway. What matters is whether the installed `expo` package itself
// has the ExpoAppSceneDelegate/ExpoReactNativeFactoryProvider runtime this
// plugin wires up to, so check its real package.json version directly.
function assertSdk57() {
  const installedVersion = require("expo/package.json").version;
  if (semver.gt(MINIMUM_EXPO_VERSION, installedVersion) || semver.gte(installedVersion, "58.0.0")) {
    throw new Error(`${PLUGIN_NAME} requires the installed expo package to be ${MINIMUM_EXPO_VERSION} through SDK 57 (found ${JSON.stringify(installedVersion)}).`);
  }
}

function isOwnedManifest(manifest) {
  return JSON.stringify(manifest) === JSON.stringify(SCENE_MANIFEST);
}

function updateAppDelegate(contents, enabled) {
  const isEnabled = contents.includes(SCENE_APP_DELEGATE);
  if (enabled && isEnabled) return contents;
  if (!enabled && !isEnabled) return contents;

  if (enabled) {
    if (!contents.includes(ORIGINAL_APP_DELEGATE) || !contents.includes(STARTUP_GUARD)) {
      throw new Error(`${PLUGIN_NAME} requires the standard Expo SDK 57 Swift AppDelegate.`);
    }
    // Leave a single blank line where the guard block was, matching the
    // blank line already separating every other statement in this method.
    return contents.replace(ORIGINAL_APP_DELEGATE, SCENE_APP_DELEGATE).replace(STARTUP_GUARD, "\n");
  }

  return contents
    .replace(SCENE_APP_DELEGATE, ORIGINAL_APP_DELEGATE)
    .replace(`${FACTORY_ASSIGNMENT}\n\n`, `${FACTORY_ASSIGNMENT}${STARTUP_GUARD}`);
}

const withUISceneLifecycle = (config, options) => {
  assertSdk57();
  const enabled = options?.enabled !== false;

  config = withAppDelegate(config, (config) => {
    if (config.modResults.language !== "swift") {
      throw new Error(`${PLUGIN_NAME} requires the standard Expo SDK 57 Swift AppDelegate.`);
    }
    config.modResults.contents = updateAppDelegate(config.modResults.contents, enabled);
    return config;
  });

  return withInfoPlist(config, (config) => {
    const manifest = config.modResults.UIApplicationSceneManifest;
    if (enabled) {
      if (manifest !== undefined && !isOwnedManifest(manifest)) {
        throw new Error(`${PLUGIN_NAME} cannot enable because UIApplicationSceneManifest is already declared by the app.`);
      }
      config.modResults.UIApplicationSceneManifest = SCENE_MANIFEST;
    } else if (isOwnedManifest(manifest)) {
      delete config.modResults.UIApplicationSceneManifest;
    }
    return config;
  });
};

module.exports = withUISceneLifecycle;
