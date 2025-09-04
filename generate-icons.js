// Simple script to generate PWA icons using Canvas API
const fs = require('fs');
const path = require('path');

// Create a simple SVG icon that can be converted to different sizes
const createSVGIcon = () => {
  return `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#2563eb;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background circle -->
  <circle cx="256" cy="256" r="240" fill="url(#grad1)" stroke="#1e40af" stroke-width="8"/>
  
  <!-- Shield icon -->
  <path d="M256 80 L200 120 L200 280 Q200 320 256 400 Q312 320 312 280 L312 120 Z" 
        fill="white" stroke="#e5e7eb" stroke-width="4"/>
  
  <!-- Inner shield design -->
  <path d="M256 120 L220 140 L220 260 Q220 290 256 350 Q292 290 292 260 L292 140 Z" 
        fill="#f3f4f6"/>
  
  <!-- Check mark -->
  <path d="M230 220 L250 240 L290 180" 
        stroke="#10b981" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  
  <!-- Text -->
  <text x="256" y="450" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="white">
    SAFE
  </text>
</svg>`;
};

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Save the SVG icon
const svgContent = createSVGIcon();
fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgContent);

console.log('✅ SVG icon created at public/icons/icon.svg');
console.log('📝 To generate PNG icons, you can:');
console.log('   1. Use online SVG to PNG converters');
console.log('   2. Use tools like ImageMagick: convert icon.svg -resize 192x192 icon-192x192.png');
console.log('   3. Use Node.js libraries like sharp or canvas');

// Create a simple favicon.ico placeholder
const faviconSVG = `
<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <circle cx="16" cy="16" r="14" fill="#2563eb"/>
  <path d="M16 6 L12 9 L12 20 Q12 22 16 26 Q20 22 20 20 L20 9 Z" fill="white"/>
  <path d="M12 14 L14 16 L20 10" stroke="#10b981" stroke-width="2" fill="none"/>
</svg>`;

fs.writeFileSync(path.join(iconsDir, 'favicon.svg'), faviconSVG);
console.log('✅ Favicon SVG created at public/icons/favicon.svg');
