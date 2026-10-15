const fs = require('fs');
const path = require('path');
const { IOSConfig, withDangerousMod, withXcodeProject } = require('expo/config-plugins');

const INTENT_FILE = 'CaptureBankSmsIntent.swift';

/**
 * Copies the "Capture bank SMS" App Intent into the iOS app target. App
 * Intents must be compiled into the app itself (not a pod) for the Shortcuts
 * app to discover them.
 */
function withBankSmsIntent(config) {
  config = withDangerousMod(config, [
    'ios',
    async cfg => {
      const projectName = IOSConfig.XcodeUtils.getProjectName(cfg.modRequest.projectRoot);
      fs.copyFileSync(
        path.join(__dirname, 'ios-app', INTENT_FILE),
        path.join(cfg.modRequest.platformProjectRoot, projectName, INTENT_FILE),
      );
      return cfg;
    },
  ]);

  return withXcodeProject(config, cfg => {
    const projectName = IOSConfig.XcodeUtils.getProjectName(cfg.modRequest.projectRoot);
    const filepath = `${projectName}/${INTENT_FILE}`;
    if (!cfg.modResults.hasFile(filepath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({ filepath, groupName: projectName, project: cfg.modResults });
    }
    return cfg;
  });
}

module.exports = withBankSmsIntent;
