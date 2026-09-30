import { Platform, StyleSheet, Text, TextInput, type TextStyle } from 'react-native';
import { cloneElement, type ReactElement } from 'react';
import {
  useFonts,
  Lato_300Light,
  Lato_400Regular,
  Lato_700Bold,
  Lato_900Black,
} from '@expo-google-fonts/lato';

/**
 * Lato, everywhere, without touching four hundred StyleSheets.
 *
 * Three things have to be right and none of them is obvious.
 *
 * **A family per weight.** A custom font is one file per weight, so
 * `fontFamily: 'Lato_400Regular'` with `fontWeight: '800'` gives regular
 * Lato on Android — the weight is dropped, because the regular file has no
 * bold in it. iOS fakes it by smearing the glyphs, which looks worse than
 * either. So the family is chosen from the weight already on the element.
 *
 * **Not `defaultProps`.** That is gone for function components in React 19,
 * which this app is on; it would silently do nothing.
 *
 * **Not the same mechanism on web.** react-native-web has already turned the
 * element into a DOM node by the time `render` returns, and handing that
 * node an array of React Native styles throws — *"Failed to set an indexed
 * property [0] on CSSStyleDeclaration"*, which is what the first version of
 * this file did. On web the font is applied with one CSS rule instead,
 * which is both simpler and what the platform actually wants.
 */
const FAMILIES = {
  light: 'Lato_300Light',
  regular: 'Lato_400Regular',
  bold: 'Lato_700Bold',
  black: 'Lato_900Black',
} as const;

function familyFor(style: TextStyle | undefined): string {
  const weight = style?.fontWeight;
  if (weight === undefined || weight === 'normal') return FAMILIES.regular;
  if (weight === 'bold') return FAMILIES.bold;

  const n = Number(weight);
  if (Number.isNaN(n)) return FAMILIES.regular;
  if (n >= 900) return FAMILIES.black;
  if (n >= 600) return FAMILIES.bold;
  if (n <= 300) return FAMILIES.light;
  return FAMILIES.regular;
}

let applied = false;

/**
 * Applies the font once.
 *
 * Guarded because a fast refresh re-runs module code, and patching a patched
 * render wraps it twice — each reload adding a layer until scrolling
 * stutters.
 */
function applyFont(): void {
  if (applied) return;
  applied = true;

  if (Platform.OS === 'web') {
    // One rule, inherited by everything. Elements that set their own family
    // — a monospaced block — still win, because a
    // rule on an element beats one inherited from an ancestor.
    const style = document.createElement('style');
    style.textContent = `
      body, #root, #root * {
        font-family: 'Lato_400Regular', 'Lato', system-ui, sans-serif;
      }
      [style*="monospace"], code, pre { font-family: monospace; }
    `;
    document.head.appendChild(style);
    return;
  }

  for (const Component of [Text, TextInput] as unknown as {
    render?: (props: unknown, ref: unknown) => ReactElement;
  }[]) {
    const original = Component.render;
    if (!original) continue;

    Component.render = function render(props: unknown, ref: unknown) {
      const element = original.call(this, props, ref);
      const own = (element.props as { style?: unknown }).style;
      const flat = StyleSheet.flatten(own as never) as TextStyle | undefined;

      // Flattened into one object rather than left as an array: an array
      // reaches the native side fine but is what breaks on web, and one
      // shape for both platforms is one thing to reason about.
      return cloneElement(element, {
        style: { fontFamily: familyFor(flat), ...(flat ?? {}) },
      } as never);
    };
  }
}

/**
 * True once Lato is on screen.
 *
 * The caller holds the first frame until this is true: swapping the font
 * under a rendered screen reflows every line at once, which reads as the app
 * breaking rather than as a font arriving.
 */
export function useLato(): boolean {
  const [loaded, error] = useFonts({
    Lato_300Light,
    Lato_400Regular,
    Lato_700Bold,
    Lato_900Black,
  });

  if (loaded) applyFont();
  // A font that fails to arrive — flaky mobile data, a blocked CDN — must
  // not leave the app blank forever waiting for it. The system font is a
  // far better first screen than no screen.
  return loaded || Boolean(error);
}
