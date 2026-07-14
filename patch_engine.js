const fs = require('fs');
let code = fs.readFileSync('components/CanvasOverlay.tsx', 'utf8');
code = code.replace(
    /const mediaEl = mediaRef.current;/g,
    `const parent = mediaRef.current;
            if (!parent) return;
            const mediaEl = parent instanceof HTMLVideoElement || parent instanceof HTMLImageElement ? parent : parent.querySelector('video') || parent.querySelector('img');`
);
fs.writeFileSync('components/CanvasOverlay.tsx', code);
