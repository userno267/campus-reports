// Distance and direction between two points. Pure maths: no network, no storage.
// Used by the map so staff can see how far the problem is and in which direction.

const EARTH_RADIUS_M = 6371000;

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}

// Straight-line distance in metres between two points (the haversine formula).
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Compass direction from point 1 to point 2, as one of eight names.
export function compassDirection(lat1: number, lng1: number, lat2: number, lng2: number): string {
  const dLng = toRad(lng2 - lng1);
  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);

  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;

  const names = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  return names[Math.round(bearing / 45) % 8];
}

// Friendly distance: "about 240 m" under 1 km, "about 1.2 km" above. Rounded so it does not look exact.
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `about ${Math.max(10, Math.round(meters / 10) * 10)} m`;
  }
  return `about ${(meters / 1000).toFixed(1)} km`;
}

// Sentence fragment for "the problem is ___".
// Example result: "about 240 m to the north-east". Very close points give "right next to you".
export function describeFromTo(fromLat: number, fromLng: number, toLat: number, toLng: number): string {
  const meters = distanceMeters(fromLat, fromLng, toLat, toLng);
  if (meters < 15) {
    return 'right next to you';
  }
  const direction = compassDirection(fromLat, fromLng, toLat, toLng);
  return `${formatDistance(meters)} to the ${direction}`;
}