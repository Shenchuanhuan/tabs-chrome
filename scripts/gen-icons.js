// Generate extension icons (assets/icons/cat-*.png) from the pixel-art cat
// defined in src/inject.js, so the toolbar icon always matches the floating button.
// Usage: yarn icons
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "assets/icons");
const BUTTON_COLOR = "#6366f1"; // same as floating button background

// size -> cat pixel scale, and whether to draw the round background
const SPECS = {
  16: { scale: 1, circle: false },
  32: { scale: 1, circle: true },
  48: { scale: 2, circle: true },
  128: { scale: 5, circle: true },
};

function loadCat() {
  const src = fs.readFileSync(path.join(ROOT, "src/inject.js"), "utf8");
  const palette = src.match(/const CAT_PALETTE = (\{[\s\S]*?\});/);
  const pixels = src.match(/const CAT_PIXELS_LEFT = (\[[\s\S]*?\]);/);
  if (!palette || !pixels) {
    throw new Error("CAT_PALETTE / CAT_PIXELS_LEFT not found in src/inject.js");
  }
  const left = new Function(`return ${pixels[1]}`)();
  return {
    palette: new Function(`return ${palette[1]}`)(),
    rows: left.map((half) => half + [...half].reverse().join("")),
  };
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function render(size, { scale, circle }, cat) {
  const buf = Buffer.alloc(size * size * 4);

  if (circle) {
    // Anti-aliased circle via 8x8 supersampling
    const [r, g, b] = hexToRgb(BUTTON_COLOR);
    const ss = 8;
    const radius = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let hits = 0;
        for (let sy = 0; sy < ss; sy++) {
          for (let sx = 0; sx < ss; sx++) {
            const dx = x + (sx + 0.5) / ss - radius;
            const dy = y + (sy + 0.5) / ss - radius;
            if (dx * dx + dy * dy <= radius * radius) hits++;
          }
        }
        const i = (y * size + x) * 4;
        buf[i] = r;
        buf[i + 1] = g;
        buf[i + 2] = b;
        buf[i + 3] = Math.round((hits / (ss * ss)) * 255);
      }
    }
  }

  // Cat pixels are fully opaque, so they simply overwrite the background
  const offset = Math.floor((size - 16 * scale) / 2);
  cat.rows.forEach((row, cy) => {
    [...row].forEach((ch, cx) => {
      const color = cat.palette[ch];
      if (!color) return;
      const [r, g, b] = hexToRgb(color);
      for (let py = 0; py < scale; py++) {
        for (let px = 0; px < scale; px++) {
          const i =
            ((offset + cy * scale + py) * size + offset + cx * scale + px) * 4;
          buf[i] = r;
          buf[i + 1] = g;
          buf[i + 2] = b;
          buf[i + 3] = 255;
        }
      }
    });
  });

  return buf;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  // Each scanline is prefixed with filter type 0 (none)
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const cat = loadCat();
for (const [size, spec] of Object.entries(SPECS)) {
  const file = path.join(OUT_DIR, `cat-${size}.png`);
  fs.writeFileSync(file, encodePng(Number(size), render(Number(size), spec, cat)));
  console.log(`✓ ${path.relative(ROOT, file)}`);
}
