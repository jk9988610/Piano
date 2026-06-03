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

function syncIndexHtml() {
  let html = fs.readFileSync("index.html", "utf8");
  html = html.replace(
    /<meta name="piano-app-version" content="[^"]+" \/>/,
    `<meta name="piano-app-version" content="${version}" />`
  );
  html = html.replace(/\?v=[0-9.]+/g, `?v=${version}`);
  html = html.replace(/(<span id="versionBadge"[^>]*>)v[0-9.]+/, `$1v${version}`);
  fs.writeFileSync("index.html", html);
}

function syncServiceWorker() {
  let sw = fs.readFileSync("sw.js", "utf8");
  sw = sw.replace(/const CACHE_VERSION = "[^"]+";/, `const CACHE_VERSION = "${version}";`);
  fs.writeFileSync("sw.js", sw);
}

syncIndexHtml();
syncServiceWorker();

console.log("Synced version", version, manifest);
