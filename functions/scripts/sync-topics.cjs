const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const SOURCE_FILE = path.join(ROOT_DIR, "public", "itoword.md");
const DEST_DIR = path.resolve(__dirname, "..", "assets");
const DEST_FILE = path.join(DEST_DIR, "itoword.md");

function copyTopics() {
  try {
    if (!fs.existsSync(SOURCE_FILE)) {
      console.warn(
        `[topics-sync] Skipped copying because source file does not exist: ${SOURCE_FILE}`
      );
      return;
    }
    fs.mkdirSync(DEST_DIR, { recursive: true });
    fs.copyFileSync(SOURCE_FILE, DEST_FILE);
    console.log(`[topics-sync] Copied topics to ${DEST_FILE}`);
  } catch (error) {
    console.error("[topics-sync] Failed to copy topics file", error);
    process.exitCode = 1;
  }
}

copyTopics();
