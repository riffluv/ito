#!/usr/bin/env node
// Convert all PNG/JPG in a given folder to WebP using sharp
// Usage: node scripts/convert-folder-to-webp.js public/images --quality=80

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const argv = require("minimist")(process.argv.slice(2));

const dirArg = argv._[0] || argv.dir || "public/images";
const quality = parseInt(argv.quality || argv.q || "80", 10);
const dir = path.resolve(process.cwd(), dirArg);

if (!fs.existsSync(dir)) {
  console.error("Directory not found:", dir);
  process.exit(1);
}

const exts = [".png", ".jpg", ".jpeg"];
(async () => {
  const files = await fs.promises.readdir(dir);
  let converted = 0;
  let skipped = 0;
  for (const f of files) {
    try {
      const full = path.join(dir, f);
      const stat = await fs.promises.stat(full);
      if (!stat.isFile()) continue;
      const lower = f.toLowerCase();
      if (!exts.some((e) => lower.endsWith(e))) continue;
      const out = full.replace(/\.(png|jpg|jpeg)$/i, ".webp");
      if (fs.existsSync(out)) {
        const statOut = fs.statSync(out);
        if (statOut.mtimeMs >= stat.mtimeMs) {
          console.log("[skip]", f);
          skipped++;
          continue;
        }
      }
      await sharp(full).webp({ quality }).toFile(out);
      console.log("[ok]  ", f, "->", path.basename(out));
      converted++;
    } catch (e) {
      console.error("[err] ", f, e && e.message ? e.message : e);
    }
  }
  console.log("Done. converted=", converted, "skipped=", skipped);
})();
