"use client";

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { App } from '@capacitor/app';
import { Clipboard } from '@capacitor/clipboard';
import { Toast } from '@capacitor/toast';

export const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();
export const platform = typeof window !== 'undefined' ? Capacitor.getPlatform() : 'web';

export const haptic = {
  light: () => { if (isNative) Haptics.impact({ style: ImpactStyle.Light }); },
  medium: () => { if (isNative) Haptics.impact({ style: ImpactStyle.Medium }); },
  heavy: () => { if (isNative) Haptics.impact({ style: ImpactStyle.Heavy }); },
};

export const statusBar = {
  setLight: () => { if (isNative) StatusBar.setStyle({ style: Style.Light }); },
  setDark: () => { if (isNative) StatusBar.setStyle({ style: Style.Dark }); },
  hide: () => { if (isNative) StatusBar.hide(); },
  show: () => { if (isNative) StatusBar.show(); },
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (isNative) {
      await Clipboard.write({ string: text });
      return true;
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      
      // Prevent scrolling to bottom of page in MS Edge
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      
      textArea.focus();
      textArea.select();
      
      let successful = false;
      try {
        successful = document.execCommand('copy');
      } catch (err) {
        console.error('Fallback copy failed', err);
      }
      
      document.body.removeChild(textArea);
      return successful;
    }
  } catch (error) {
    console.error('Copy to clipboard failed', error);
    return false;
  }
};

// Cross-platform toast. Native uses the Capacitor Toast plugin; web renders a
// lightweight, non-blocking snackbar (the Capacitor web toast needs
// @ionic/pwa-elements, which isn't registered here, so it would render nothing).
let webToastTimer: ReturnType<typeof setTimeout> | null = null;

export const showToast = async (message: string): Promise<void> => {
  if (isNative) {
    try {
      await Toast.show({ text: message });
      return;
    } catch {
      // Fall through to the web snackbar if the native toast is unavailable.
    }
  }

  if (typeof document === 'undefined') return;

  const id = "app-toast";
  let el = document.getElementById(id) as HTMLDivElement | null;
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.style.cssText = [
      "position:fixed",
      "left:50%",
      "bottom:calc(24px + env(safe-area-inset-bottom))",
      "transform:translateX(-50%) translateY(8px)",
      "z-index:2147483647",
      "max-width:calc(100vw - 32px)",
      "padding:10px 16px",
      "border-radius:9999px",
      "background:#171717",
      "color:#fafafa",
      "font-size:14px",
      "font-weight:500",
      "line-height:1",
      "box-shadow:0 8px 24px rgba(0,0,0,0.24)",
      "opacity:0",
      "pointer-events:none",
      "transition:opacity 150ms ease, transform 150ms cubic-bezier(0.22,1,0.36,1)",
    ].join(";");
    document.body.appendChild(el);
  }

  el.textContent = message;
  requestAnimationFrame(() => {
    if (!el) return;
    el.style.opacity = "1";
    el.style.transform = "translateX(-50%) translateY(0)";
  });

  if (webToastTimer) clearTimeout(webToastTimer);
  webToastTimer = setTimeout(() => {
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateX(-50%) translateY(8px)";
    setTimeout(() => el?.remove(), 200);
  }, 2200);
};

export async function initNativeApp() {
  if (!isNative) return;

  // Handle hardware back button on Android
  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      App.exitApp();
    }
  });

  // Keyboard events for input handling
  Keyboard.addListener('keyboardWillShow', (info) => {
    document.documentElement.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
  });

  Keyboard.addListener('keyboardWillHide', () => {
    document.documentElement.style.setProperty('--keyboard-height', '0px');
  });

  // Handle deep links (e.g. email verification links, shared links)
  App.addListener('appUrlOpen', data => {
    try {
      const url = new URL(data.url);
      const slug = url.pathname + url.search + url.hash;
      window.location.href = slug;
    } catch (e) {
      console.error('Error parsing deep link URL:', e);
    }
  });
}
