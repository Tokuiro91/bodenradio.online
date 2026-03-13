const fs = require('fs');
const path = require('path');

const files = [
    "data/sticker-packs.json",
    "hooks/use-audio-engine.ts",
    "public/sw.js",
    "components/ios-install-prompt.tsx",
    "components/reaction-picker.tsx",
    "components/splash-screen.tsx",
    "public/manifest.json",
    "app/offline/page.tsx",
    "app/layout.tsx",
    "app/about/page.tsx",
    "app/login/page.tsx",
    "app/register/page.tsx",
    "app/api/auth/send-otp/route.ts",
    "app/admin/login/page.tsx",
    "app/admin/page.tsx",
    "app/api/stream/route.ts"
];

const basePath = "/Users/ioioioi/Desktop/Bodenradio.online/web";

files.forEach(f => {
    const fullPath = path.join(basePath, f);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf-8');
        content = content.replace(/KØDE/g, 'BØDEN');
        content = content.replace(/KODE/g, 'BODEN-STADT');
        content = content.replace(/kode-/g, 'boden-');
        fs.writeFileSync(fullPath, content);
        console.log("Updated", f);
    } else {
        console.log("Not found", f);
    }
});
