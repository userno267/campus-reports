// Turns a picked image into a smaller JPEG so it is light enough to store as text in PostgreSQL.
// Returns RAW base64 (without the "data:image/jpeg;base64," prefix).

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