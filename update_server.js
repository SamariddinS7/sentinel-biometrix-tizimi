const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

// Replace fallback usage in biometric-frame
content = content.replace(/res\.json\(fallbackBiometric\);/g, 'res.status(500).json({ error: "AI Biometric tahlili amalga oshmadi" });');
content = content.replace(/res\.json\(fallbackObjects\);/g, 'res.status(500).json({ error: "AI Obyekt tahlili amalga oshmadi" });');
content = content.replace(/res\.json\(fallbackRules\);/g, 'res.status(500).json({ error: "AI Rule tahlili amalga oshmadi" });');
content = content.replace(/res\.json\(fallbackSearch\);/g, 'res.status(500).json({ error: "AI Qidiruv amalga oshmadi" });');

fs.writeFileSync('server.ts', content);
