// Turns a picked image into a smaller JPEG so it is light enough to store as text in PostgreSQL.
// Returns RAW base64 (without the "data:image/jpeg;base64," prefix).
export async function resizeImageToBase64(
  file: File,
  maxWidth = 1280,   // pixels; the project spec says about 1280px wide
  quality = 0.8      // JPEG quality, 0 to 1
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }

  // Step 1: read the file into a data URL that an <img> element can load.
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });

  // Step 2: load the image so we know its real width and height.
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('This image could not be opened. Try a JPG or PNG.'));
    image.src = dataUrl;
  });

  // Step 3: draw it on a canvas at the smaller size. Never enlarge small images.
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

  // Step 4: export as JPEG and cut off the "data:...;base64," prefix.
  const jpeg = canvas.toDataURL('image/jpeg', quality);
  return jpeg.split(',')[1];
}