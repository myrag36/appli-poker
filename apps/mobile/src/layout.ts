// Screen size helpers: the app is designed for phones, and gets a wider layout on computers.
import { Platform, useWindowDimensions } from 'react-native';

/** Width from which the screen is treated as a computer (or a large tablet held sideways). */
export const DESKTOP_MIN_WIDTH = 960;

/** Widest a phone-style column of buttons or forms should grow, even on a computer. */
export const COLUMN_MAX_WIDTH = 560;

/** Widest the content of a desktop page should grow on very large monitors. */
export const PAGE_MAX_WIDTH = 1280;

/** True on a computer-sized window: wide and tall enough for a side-by-side layout. */
export function isDesktopSize(width: number, height: number): boolean {
  return Platform.OS === 'web' && width >= DESKTOP_MIN_WIDTH && height >= 560;
}

/** Re-renders when the window is resized, so the layout follows the window on a computer. */
export function useDesktop(): boolean {
  const { width, height } = useWindowDimensions();
  return isDesktopSize(width, height);
}
