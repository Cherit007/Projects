const { withEntitlementsPlist } = require('expo/config-plugins');

/**
 * expo-notifications always adds the remote push entitlement, but the app only
 * schedules local notifications. Personal (free) Apple teams cannot sign apps
 * that request push, so the entitlement is removed.
 */
function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, cfg => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
}

module.exports = withoutPushEntitlement;
