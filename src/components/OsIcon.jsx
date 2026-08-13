import React from 'react';
import { Monitor } from 'lucide-react';
import { FaApple, FaAndroid, FaWindows, FaLinux } from 'react-icons/fa6';

// lucide-react (used everywhere else in this app) has no real OS/brand
// logos — it's a generic outline icon set. For an actually-recognizable
// device list (not a generic monitor glyph for everything), these come from
// react-icons' Font Awesome 6 set instead, which ships accurate brand marks.
// iOS and macOS both render the Apple mark — there's no separate "official"
// iOS-only logo distinct from Apple's own.
const OS_ICON = {
  Windows: FaWindows,
  macOS: FaApple,
  iOS: FaApple,
  Android: FaAndroid,
  Linux: FaLinux,
};

// Same lightweight, dependency-free detection already used server-side in
// trustedDevice.service.js#labelFromUserAgent — kept independent (not
// parsed back out of the device_label string) so icon selection doesn't
// silently break if that label's wording ever changes.
export function detectOs(userAgent) {
  if (!userAgent) return null;
  if (/Windows/.test(userAgent)) return 'Windows';
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'iOS';
  if (/Mac OS X/.test(userAgent)) return 'macOS';
  if (/Android/.test(userAgent)) return 'Android';
  if (/Linux/.test(userAgent)) return 'Linux';
  return null;
}

export default function OsIcon({ userAgent, size = 18, color = 'var(--on-muted)', style }) {
  const os = detectOs(userAgent);
  const Icon = os ? OS_ICON[os] : null;
  if (!Icon) return <Monitor size={size} color={color} style={style} />;
  return <Icon size={size} color={color} style={style} />;
}
