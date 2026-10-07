// Builds the icons of the installable web app (public/icons) from assets/icon.png.
// Run again after changing the app icon: node scripts/pwa-icons.js
// Uses jimp-compact, which Expo already installs, so no extra dependency is needed.
const path = require('path');
const Jimp = require('jimp-compact');

const root = path.join(__dirname, '..');
const out = path.join(root, 'public', 'icons');

async function main() {
  const source = await Jimp.read(path.join(root, 'assets', 'icon.png'));
  const save = (image, size, name) =>
    image.clone().resize(size, size, Jimp.RESIZE_BICUBIC).writeAsync(path.join(out, name));

  await save(source, 192, 'icon-192.png');
  await save(source, 512, 'icon-512.png');
  // iOS draws its own rounded corners and wants an opaque square.
  await save(source, 180, 'apple-touch-icon.png');

  // Android crops "maskable" icons to a circle or a squircle: keep the drawing inside the
  // safe zone (the middle 80%) and fill the border with the icon's own background color.
  const size = 512;
  const inner = Math.round(size * 0.84);
  const background = source.getPixelColor(2, 2);
  const maskable = new Jimp(size, size, background);
  maskable.composite(
    source.clone().resize(inner, inner, Jimp.RESIZE_BICUBIC),
    (size - inner) / 2,
    (size - inner) / 2,
  );
  await maskable.writeAsync(path.join(out, 'icon-maskable-512.png'));
  console.log('Icônes écrites dans', path.relative(process.cwd(), out));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
