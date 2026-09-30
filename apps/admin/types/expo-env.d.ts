/// <reference types="expo/types" />

// Checked in deliberately. Expo generates an expo-env.d.ts at the app root
// with this same reference, but that file is gitignored and is removed
// whenever the .expo cache is cleared — which then breaks `tsc` with
// "Cannot find name 'process'" on a clean checkout. This copy is part of the
// source, so the types are always there.
