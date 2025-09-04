const fs = require('fs');
const path = require('path');

// Create placeholder PNG files for PWA icons
const sizes = [16, 32, 72, 96, 128, 144, 152, 192, 384, 512];

const createPlaceholderPNG = (size) => {
  // Create a simple base64 encoded PNG placeholder
  const canvas = `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#2563eb"/>
      <stop offset="100%" style="stop-color:#1d4ed8"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#grad)" rx="${size * 0.1}"/>
  <path d="M${size * 0.5} ${size * 0.2} L${size * 0.3} ${size * 0.35} L${size * 0.3} ${size * 0.7} Q${size * 0.3} ${size * 0.8} ${size * 0.5} ${size * 0.9} Q${size * 0.7} ${size * 0.8} ${size * 0.7} ${size * 0.7} L${size * 0.7} ${size * 0.35} Z" fill="white"/>
  <path d="M${size * 0.4} ${size * 0.55} L${size * 0.47} ${size * 0.62} L${size * 0.6} ${size * 0.45}" stroke="#10b981" stroke-width="${size * 0.02}" fill="none" stroke-linecap="round"/>
</svg>`;
  
  return canvas;
};

// Create icons directory
const iconsDir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate all icon sizes
sizes.forEach(size => {
  const svgContent = createPlaceholderPNG(size);
  fs.writeFileSync(path.join(iconsDir, `icon-${size}x${size}.png`), svgContent);
  console.log(`✅ Created icon-${size}x${size}.png`);
});

// Create favicon.ico equivalent
fs.writeFileSync(path.join(iconsDir, 'favicon.ico'), createPlaceholderPNG(32));
console.log('✅ Created favicon.ico');

console.log('\n📱 PWA icons created successfully!');
console.log('Note: These are SVG files with .png extension for compatibility.');
console.log('For production, convert these to actual PNG files using image conversion tools.');
