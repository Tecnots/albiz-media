"use client";

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { App } from '@capacitor/app';

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
}
