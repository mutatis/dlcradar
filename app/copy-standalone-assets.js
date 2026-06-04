const fs = require("fs");
const path = require("path");

function copyDir(source, destination) {
  if (!fs.existsSync(source)) return;

  fs.mkdirSync(destination, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      copyDir(sourcePath, destinationPath);
    } else {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

copyDir(".next/static", ".next/standalone/.next/static");
copyDir("public", ".next/standalone/public");

console.log("Standalone assets copiados.");
