// Browser-only helper for "My location" buttons.

export type DeviceFix = { lat: number; lng: number; accuracy: number };

/** Thrown with a message that's ready to show the user. */
export class DeviceLocationError extends Error {}

/**
 * The device's location, trying GPS first and falling back to network location
 * (GPS is often slow or unavailable indoors). Browsers only allow this on
 * secure pages (https:// or localhost), so a phone opening http://192.168.x.x
 * during development always fails: we say so instead of a vague error.
 */
export function getDeviceLocation(searchHint: string): Promise<DeviceFix> {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) {
      reject(new DeviceLocationError(`Your browser only shares location on secure (https://) pages. ${searchHint}`));
      return;
    }
    if (!("geolocation" in navigator)) {
      reject(new DeviceLocationError(`This browser can't share your location. ${searchHint}`));
      return;
    }
    const ok = ({ coords }: GeolocationPosition) => resolve({ lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy });
    const fail = (err: GeolocationPositionError) =>
      reject(
        new DeviceLocationError(
          err.code === err.PERMISSION_DENIED
            ? `Location access is blocked for this site. Allow it in your browser's site settings (and turn on location for the browser in your phone's settings), or ${lowerFirst(searchHint)}`
            : `Couldn't get your location. Make sure location (GPS) is turned on, or ${lowerFirst(searchHint)}`,
        ),
      );
    navigator.geolocation.getCurrentPosition(
      ok,
      (err) => {
        if (err.code === err.TIMEOUT || err.code === err.POSITION_UNAVAILABLE) {
          navigator.geolocation.getCurrentPosition(ok, fail, { enableHighAccuracy: false, timeout: 15_000, maximumAge: 300_000 });
        } else fail(err);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
