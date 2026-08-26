// Mirrors apps/mobile/metro.config.js — see the comments there for why each
// of these is needed. Kept as a copy rather than a shared helper because Expo
// resolves this file relative to the app, and a require() out of the app
// directory breaks `expo start` in a monorepo.
const { getDefaultConfig } = require('expo/metro-config');
const { FileStore } = require('metro-cache');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch the whole workspace so edits in packages/shared trigger a reload.
config.watchFolders = [workspaceRoot];

// 2. Resolve modules from the app first, then the hoisted root tree.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Do not walk further up the disk looking for node_modules.
config.resolver.disableHierarchicalLookup = true;

// 4. Cache next to the repo, not on the (nearly full) system drive.
config.cacheStores = [
  new FileStore({ root: path.join(workspaceRoot, '.metro-cache-admin') }),
];

// 5. Fewer workers than cores — this machine swaps under six of them.
config.maxWorkers = 3;

module.exports = config;
