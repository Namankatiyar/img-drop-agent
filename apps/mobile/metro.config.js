const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Monorepo root is two levels up from apps/mobile
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the monorepo root to enable live reloading for shared packages
config.watchFolders = [monorepoRoot];

// 2. Let Metro resolve packages from apps/mobile first, then hoisted root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Explicitly alias workspace packages so @imgdrop/shared resolves to packages/shared
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  '@imgdrop/shared': path.resolve(monorepoRoot, 'packages/shared'),
};

// 4. Ensure TypeScript and asset extensions are included
config.resolver.sourceExts = Array.from(
  new Set([
    ...(config.resolver.sourceExts || []),
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'cjs',
    'mjs',
  ])
);

module.exports = config;
