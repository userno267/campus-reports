// Turns a picked image into a smaller JPEG so it is light enough to store as text in PostgreSQL.
// Returns RAW base64 (without the "data:image/jpeg;base64," prefix).
//
// Feature 5: stampPhoto() adds a one-line strip under the photo with the coordinates and the time.
// The stamp is drawn into the pixels. It is a visible record, not tamper-proof evidence:
// anyone can edit the image or the stamp.

// The server refuses photos longer than 4,000,000 base64 characters. Stay a little under it.
const MAX_BASE64_CHARS = 3900000;

// Quality used for the first resize. It is high on purpose, because stampPhoto() compresses again.
// The final quality (0.8) is set when the stamped photo is exported.
export const WORKING_QUALITY = 0.92;

// Reads a picked File into a data URL.
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

// Loads an image from a data URL so we know its real width and height.
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('This image could not be opened. Try a JPG or PNG.'));
    image.src = src;
  });
}

// Draws the image at the smaller size and exports it as JPEG base64.
function drawToJpegBase64(img: HTMLImageElement, maxWidth: number, quality: number): string {
  // Never enlarge small images.
  const scale = Math.min(1, maxWidth / img.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Your browser cannot process images.');
  }
  // Paint a white background first. JPEG has no transparency, so PNG transparency would turn black.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Export as JPEG and cut off the "data:...;base64," prefix.
  const jpeg = canvas.toDataURL('image/jpeg', quality);
  return jpeg.split(',')[1];
}

// For a file picked in the browser.
export async function resizeImageToBase64(
  file: File,
  maxWidth = 1280,   // pixels; the project spec says about 1280px wide
  quality = 0.8      // JPEG quality, 0 to 1
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }
  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);
  return drawToJpegBase64(img, maxWidth, quality);
}

// For a photo that already comes as a data URL (the native camera returns one).
export async function resizeDataUrlToBase64(
  dataUrl: string,
  maxWidth = 1280,
  quality = 0.8
): Promise<string> {
  const img = await loadImage(dataUrl);
  return drawToJpegBase64(img, maxWidth, quality);
}

// ===== Feature 5: photo stamp =====

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

// "2026-11-01 10:30" in the time zone of the device. A bad or missing time falls back to now.
function formatStampTime(takenAtIso: string | null): string {
  let date = takenAtIso ? new Date(takenAtIso) : new Date();
  if (Number.isNaN(date.getTime())) {
    date = new Date();
  }
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ` +
         `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

// The one line printed on the photo.
// With a GPS fix: "Lat 10.52340, Lng 118.91230 · 2026-11-01 10:30"
// Without one:    "GPS unavailable · 2026-11-01 10:30"
export function buildStampText(
  latitude: number | null,
  longitude: number | null,
  takenAtIso: string | null
): string {
  const time = formatStampTime(takenAtIso);
  if (latitude === null || longitude === null) {
    return `GPS unavailable · ${time}`;
  }
  return `Lat ${latitude.toFixed(5)}, Lng ${longitude.toFixed(5)} · ${time}`;
}

// Takes a resized photo (raw base64) and returns a new raw base64 JPEG with a dark strip added UNDER it.
// The strip is added below the photo, not on top, so nothing in the photo is hidden.
// Always start from the unstamped photo. Stamping an already stamped photo would add a second strip.
export async function stampPhoto(
  base64: string,
  takenAtIso: string | null,
  latitude: number | null,
  longitude: number | null
): Promise<string> {
  const img = await loadImage('data:image/jpeg;base64,' + base64);
  const text = buildStampText(latitude, longitude, takenAtIso);

  const width = img.width;
  const height = img.height;

  // The text size follows the photo width, so it stays readable on small and large photos.
  let fontSize = Math.max(14, Math.round(width * 0.028));
  const stripHeight = Math.round(fontSize * 1.9);
  const padding = Math.round(fontSize * 0.6);

  // Setting the canvas size resets the drawing state, so the size is set first.
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height + stripHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Your browser cannot process images.');
  }

  const fontFor = (size: number) => `600 ${size}px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;

  // Make the text smaller if the line is wider than the photo.
  ctx.font = fontFor(fontSize);
  while (fontSize > 9 && ctx.measureText(text).width > width - padding * 2) {
    fontSize -= 1;
    ctx.font = fontFor(fontSize);
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  ctx.fillStyle = '#29483d';
  ctx.fillRect(0, height, width, stripHeight);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, padding, height + stripHeight / 2);

  // Export at 0.8. If the result is too big for the server, try lower qualities.
  for (const quality of [0.8, 0.65, 0.5]) {
    const base64Out = canvas.toDataURL('image/jpeg', quality).split(',')[1];
    if (base64Out.length <= MAX_BASE64_CHARS) {
      return base64Out;
    }
  }
  throw new Error('This photo is too large. Try a smaller photo.');
}