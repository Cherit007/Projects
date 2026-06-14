const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;
config.resolver.unstable_enablePackageExports = true;

const workspacePackages = {
  '@fixture-maker/domain': path.resolve(monorepoRoot, 'packages/domain/src'),
  '@fixture-maker/config': path.resolve(monorepoRoot, 'packages/config/src'),
  '@fixture-maker/api': path.resolve(monorepoRoot, 'packages/api/src'),
  '@fixture-maker/types': path.resolve(monorepoRoot, 'packages/types/src'),
  '@fixture-maker/storage': path.resolve(monorepoRoot, 'packages/storage/src'),
  '@fixture-maker/analytics': path.resolve(monorepoRoot, 'packages/analytics/src'),
};

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  ...workspacePackages,
};

module.exports = config;
