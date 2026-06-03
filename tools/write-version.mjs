import fs from "node:fs";

const version = fs.readFileSync("VERSION", "utf8").trim();
const build = process.env.GITHUB_RUN_NUMBER || "dev";
const sha = (process.env.GITHUB_SHA || "local").slice(0, 7);

const manifest = {
  app: "piano-studio",
  version,
  build,
  sha,
  builtAt: new Date().toISOString(),
};

fs.writeFileSync("version.json", JSON.stringify(manifest, null, 2) + "\n");
console.log("Wrote version.json", manifest);
