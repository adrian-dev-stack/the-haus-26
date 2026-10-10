import fs from "node:fs";
import path from "node:path";
import { property } from "../lib/property.js";

console.log("==> Running HauS 26 Pre-Deployment Quality Checks...");

let errors = 0;

// 1. Validate property schema
if (!property || typeof property !== "object") {
  console.error("FAIL: property export is missing or not an object");
  errors++;
} else {
  if (!property.name || typeof property.name !== "string") {
    console.error("FAIL: property.name is required and must be a string");
    errors++;
  }
  if (!property.coords || typeof property.coords.lat !== "number" || typeof property.coords.lng !== "number") {
    console.error("FAIL: property.coords must have valid numeric lat and lng");
    errors++;
  }
  if (!property.contact || !property.contact.phone) {
    console.error("FAIL: property.contact.phone is required");
    errors++;
  }
  if (!Array.isArray(property.photos) || property.photos.length === 0) {
    console.error("FAIL: property.photos must contain at least 1 photo");
    errors++;
  } else {
    // Verify each photo file exists in public/
    const publicDir = path.resolve(process.cwd(), "public");
    for (const photo of property.photos) {
      if (!photo.src || !photo.alt) {
        console.error(`FAIL: photo entry is missing src or alt: ${JSON.stringify(photo)}`);
        errors++;
      } else {
        const filePath = path.join(publicDir, photo.src.replace(/^\//, ""));
        if (!fs.existsSync(filePath)) {
          console.error(`FAIL: Photo asset not found in public/: ${photo.src}`);
          errors++;
        }
      }
    }
  }
}

// 2. Anti-Slop Check: Verify no forbidden em dashes (—) exist in source files
const scanDirs = ["app", "components", "lib"];
const EM_DASH = "\u2014";

function scanDirForEmDash(dir) {
  const fullDir = path.resolve(process.cwd(), dir);
  if (!fs.existsSync(fullDir)) return;

  const entries = fs.readdirSync(fullDir, { withFileTypes: true });
  for (const entry of entries) {
    const res = path.join(fullDir, entry.name);
    if (entry.isDirectory()) {
      scanDirForEmDash(res);
    } else if (/\.(jsx?|tsx?|css|md|json)$/.test(entry.name)) {
      const content = fs.readFileSync(res, "utf-8");
      if (content.includes(EM_DASH)) {
        console.error(`FAIL: Forbidden em dash (—) character found in: ${path.relative(process.cwd(), res)}`);
        errors++;
      }
    }
  }
}

for (const dir of scanDirs) {
  scanDirForEmDash(dir);
}

if (errors > 0) {
  console.error(`\nFAILED: Found ${errors} quality gate issue(s). Deployment blocked.`);
  process.exit(1);
} else {
  console.log("PASS: All property schema, photo assets, and anti-slop checks passed successfully!");
}
