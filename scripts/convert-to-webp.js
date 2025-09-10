#!/usr/bin/env node
// Simple bulk image converter to WebP using sharp.
// Usage: node scripts/convert-to-webp.js [--dry] [--quality=80]

const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

const sharp = require("sharp");

const argv = require("minimist")(process.argv.slice(2));
const dryRun = argv.dry || argv._.includes("--dry");
const quality = parseInt(argv.quality || argv.q || "80", 10);

const root = path.resolve(__dirname, "..");
const exts = [".png", ".jpg", ".jpeg"];

async function walk(dir) {
  const files = await readdir(dir);
  let results = [];
  for (const file of files) {
    const full = path.join(dir, file);
    try {
      const s = await stat(full);
      if (s.isDirectory()) {
        if (file === "node_modules" || file === ".git") continue;
        results = results.concat(await walk(full));
      } else if (s.isFile()) {
        results.push(full);
      }
    } catch (e) {
      // ignore
    }
  }
  return results;
}

function shouldConvert(file) {
  const lower = file.toLowerCase();
  return exts.some((e) => lower.endsWith(e));
}

async function convert(file) {
  const out = file.replace(/\.(png|jpg|jpeg)$/i, ".webp");
  if (fs.existsSync(out)) {
    const statIn = fs.statSync(file);
    const statOut = fs.statSync(out);
    if (statOut.mtimeMs >= statIn.mtimeMs) {
      return { skipped: true, out };
    }
  }

  if (dryRun) return { dry: true, out };

  await sharp(file).webp({ quality }).toFile(out);
  return { converted: true, out };
}

(async function main() {
  console.log("Scanning for images in", root);
  const files = await walk(root);
  const imgs = files.filter(shouldConvert);
  console.log("Found", imgs.length, "candidate images");
  let converted = 0;
  let skipped = 0;
  for (const f of imgs) {
    try {
      const r = await convert(f);
      if (r.converted) converted++;
      if (r.skipped) skipped++;
      if (r.dry) console.log("[dry]", f, "->", r.out);
      else if (r.converted) console.log("[ok]", f, "->", r.out);
      else if (r.skipped) console.log("[skip]", f, "->", r.out);
    } catch (e) {
      console.error("Error converting", f, e.message);
    }
  }
  console.log("Done. converted=", converted, "skipped=", skipped);
})();
