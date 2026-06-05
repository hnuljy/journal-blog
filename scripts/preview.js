const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const siteConfigPath = path.join(rootDir, "content", "site.json");
const siteConfig = JSON.parse(fs.readFileSync(siteConfigPath, "utf8"));
const basePath = normalizeBasePath(siteConfig.basePath || "");
const port = Number(process.env.PORT || 3000);

if (!fs.existsSync(distDir)) {
  console.error("Missing dist folder. Run npm run build first.");
  process.exit(1);
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".xml": "application/xml; charset=utf-8"
};

http
  .createServer((request, response) => {
    const requestUrl = new URL(request.url, `http://localhost:${port}`);
    let pathname = decodeURIComponent(requestUrl.pathname);

    if (basePath && pathname === "/") {
      response.writeHead(302, { Location: `${basePath}/` });
      response.end();
      return;
    }

    if (basePath && pathname.startsWith(basePath)) {
      pathname = pathname.slice(basePath.length) || "/";
    }

    const filePath = resolvePath(pathname);
    serveFile(filePath, response);
  })
  .listen(port, () => {
    const url = basePath ? `http://localhost:${port}${basePath}/` : `http://localhost:${port}/`;
    console.log(`Preview server running at ${url}`);
  });

function resolvePath(pathname) {
  const cleanPath = pathname.replace(/\/+/g, "/");
  let filePath = path.join(distDir, cleanPath);

  if (cleanPath.endsWith("/")) {
    filePath = path.join(distDir, cleanPath, "index.html");
  }

  if (!path.extname(filePath)) {
    filePath = path.join(filePath, "index.html");
  }

  return filePath;
}

function serveFile(filePath, response) {
  if (!fs.existsSync(filePath)) {
    const notFoundPath = path.join(distDir, "404.html");
    const fallback = fs.existsSync(notFoundPath) ? fs.readFileSync(notFoundPath) : Buffer.from("Not found");
    response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    response.end(fallback);
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  const contentType = contentTypes[extension] || "application/octet-stream";
  response.writeHead(200, { "Content-Type": contentType });
  response.end(fs.readFileSync(filePath));
}

function normalizeBasePath(value) {
  const pathname = String(value || "").trim();
  if (!pathname || pathname === "/") {
    return "";
  }
  return `/${pathname.replace(/^\/+|\/+$/g, "")}`;
}
