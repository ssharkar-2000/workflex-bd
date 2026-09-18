// Metro needs explicit monorepo wiring — without it the bundler cannot resolve
// @workflex/shared, which lives outside apps/mobile.
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

// 4. Keep the transform cache next to the repo rather than in the OS temp dir.
// Metro's default is %LOCALAPPDATA%\Temp, which on this setup sits on a nearly
// full system drive — when it ran out mid-bundle the dev server died and the
// phone reported "Failed to download remote update". Cache belongs on the same
// volume as the checkout, which is where the free space is.
config.cacheStores = [
  new FileStore({ root: path.join(workspaceRoot, '.metro-cache') }),
];

// 5. Metro defaults to one worker per core (6 here), but this machine has 7.8 GB
// of RAM and little of it free. Six transform workers push it into swap, which
// stretched a cold bundle to 62s — just past the 60s timeout Expo Go allows for
// downloading an update, so the phone gave up and showed "Something went wrong".
// Fewer workers means less contention and a bundle that lands inside the window.
config.maxWorkers = 3;

// 6. expo-secure-store has no web implementation — it wraps the iOS Keychain
// and the Android Keystore, and every call throws in a browser. Four modules
// import it directly, so rather than teaching each one about platforms, swap
// the whole module for a localStorage-backed stand-in when bundling for web.
// Native builds never see this branch.
const secureStoreWebShim = path.resolve(
  projectRoot,
  'src/lib/secure-store.web.ts',
);

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'expo-secure-store') {
    return { type: 'sourceFile', filePath: secureStoreWebShim };
  }
  return (defaultResolveRequest ?? context.resolveRequest)(
    context,
    moduleName,
    platform,
  );
};

module.exports = config;
