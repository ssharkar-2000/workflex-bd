/**
 * Web stand-in for `expo-secure-store`.
 *
 * The real module wraps the iOS Keychain and the Android Keystore, neither of
 * which exists in a browser — every call throws `UnavailabilityError` there.
 * Metro swaps this file in for `expo-secure-store` when it bundles for web
 * (see the `resolveRequest` hook in metro.config.js), so no app code has to
 * know which platform it is on.
 *
 * This is `localStorage`, which is NOT secure storage: any script on the page
 * can read it, and it survives until something clears it. That is acceptable
 * for running the app on a developer's own laptop and nowhere else. If this
 * app is ever shipped as a real website, tokens must move to httpOnly cookies
 * — do not promote this file into that role.
 */

function store(): Storage | null {
  try {
    // Guarded rather than assumed: server-side rendering has no `window`, and
    // a browser with site data blocked throws on the property access itself.
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export async function getItemAsync(key: string): Promise<string | null> {
  return store()?.getItem(key) ?? null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  store()?.setItem(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  store()?.removeItem(key);
}

/** Mirrors the real module's export, which callers check before writing. */
export async function isAvailableAsync(): Promise<boolean> {
  return store() !== null;
}
