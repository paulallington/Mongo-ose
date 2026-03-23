import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC = path.join(ROOT, 'client', 'public');
const source = path.join(PUBLIC, 'logo.png');

console.log('Processing logo...');

const img = sharp(source);
const metadata = await img.metadata();
console.log(`Source: ${metadata.width}x${metadata.height}`);

// Remove white background → transparent
const transparentBuf = await sharp(source)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { data, info } = transparentBuf;
const processed = Buffer.alloc(data.length);
const processedLight = Buffer.alloc(data.length);

for (let i = 0; i < data.length; i += 4) {
  const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];

  if (r > 240 && g > 240 && b > 240) {
    // Near-white → transparent (both versions)
    processed[i] = r;     processed[i + 1] = g;     processed[i + 2] = b;     processed[i + 3] = 0;
    processedLight[i] = r; processedLight[i + 1] = g; processedLight[i + 2] = b; processedLight[i + 3] = 0;
  } else {
    // Normal version (dark mongoose) - keep as-is
    processed[i] = r;     processed[i + 1] = g;     processed[i + 2] = b;     processed[i + 3] = a;

    // Light version for dark mode: make dark areas white, keep green braces
    const isGreen = g > 80 && g > r * 1.2 && g > b * 1.2;
    if (isGreen) {
      // Keep green braces, just brighten slightly
      processedLight[i] = Math.min(255, r + 30);
      processedLight[i + 1] = Math.min(255, g + 30);
      processedLight[i + 2] = Math.min(255, b + 30);
    } else {
      // Map dark→white, preserving contrast as subtle shading
      // luminance of original pixel
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      // Flip: dark becomes light, light stays light
      const newLum = 255 - (255 - lum) * 0.15; // subtle shading
      processedLight[i] = Math.round(newLum);
      processedLight[i + 1] = Math.round(newLum);
      processedLight[i + 2] = Math.round(newLum);
    }
    processedLight[i + 3] = a;
  }
}

const rawOpts = { raw: { width: info.width, height: info.height, channels: 4 } };

// Dark mongoose (for light backgrounds)
await sharp(processed, rawOpts).png().toFile(path.join(PUBLIC, 'logo-transparent.png'));
console.log('Created logo-transparent.png (dark, for light mode)');

// White mongoose (for dark backgrounds)
await sharp(processedLight, rawOpts).png().toFile(path.join(PUBLIC, 'logo-light.png'));
console.log('Created logo-light.png (white, for dark mode)');

// Favicon (32x32) - use dark version (works on both light/dark browser chrome)
await sharp(processed, rawOpts)
  .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png().toFile(path.join(PUBLIC, 'favicon.png'));
console.log('Created favicon.png (32x32)');

// High-DPI favicon (192x192)
await sharp(processed, rawOpts)
  .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png().toFile(path.join(PUBLIC, 'favicon-192.png'));
console.log('Created favicon-192.png (192x192)');

// .ico for Windows exe
const ico256 = await sharp(processed, rawOpts)
  .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png().toBuffer();
const icoBuffer = await pngToIco(ico256);
fs.writeFileSync(path.join(PUBLIC, 'favicon.ico'), icoBuffer);
console.log('Created favicon.ico');

// Sidebar icon (64x64) - both variants
await sharp(processed, rawOpts)
  .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png().toFile(path.join(PUBLIC, 'logo-small.png'));
console.log('Created logo-small.png (64x64, dark)');

await sharp(processedLight, rawOpts)
  .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png().toFile(path.join(PUBLIC, 'logo-small-light.png'));
console.log('Created logo-small-light.png (64x64, light)');

console.log('\nAll logo assets generated!');
