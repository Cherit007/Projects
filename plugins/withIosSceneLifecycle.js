const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

/**
 * iOS 27 terminates apps built with its SDK at launch unless they use the
 * scene life cycle. Expo ships ExpoAppSceneDelegate for this; the app
 * delegate only has to hand the window over to it.
 */
function withIosSceneLifecycle(config) {
  config = withInfoPlist(config, cfg => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });

  return withAppDelegate(config, cfg => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('withIosSceneLifecycle expects a Swift AppDelegate');
    }
    let contents = cfg.modResults.contents;
    contents = contents.replace(
      /class AppDelegate: ExpoAppDelegate \{/,
      'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
    );
    // The scene delegate creates the window and starts React Native in it.
    contents = contents.replace(
      /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/,
      '\n',
    );
    if (!contents.includes('ExpoReactNativeFactoryProvider') || contents.includes('UIScreen.main.bounds')) {
      throw new Error('withIosSceneLifecycle could not patch AppDelegate.swift; the Expo template has changed');
    }
    cfg.modResults.contents = contents;
    return cfg;
  });
}

module.exports = withIosSceneLifecycle;
