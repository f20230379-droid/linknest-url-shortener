const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "links.json");
const MAX_BODY_SIZE = 32 * 1024;
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SERVER_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const USE_REMOTE_STORE = Boolean(SUPABASE_URL && SUPABASE_SERVER_KEY);

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function ensureDataFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]\n", "utf8");
}

function getLocalLinks() {
  ensureDataFile();
  try {
    const links = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return Array.isArray(links) ? links : [];
  } catch {
    return [];
  }
}

function saveLocalLinks(links) {
  ensureDataFile();
  const temporaryFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(temporaryFile, `${JSON.stringify(links, null, 2)}\n`, "utf8");
  fs.renameSync(temporaryFile, DATA_FILE);
}

function remoteLink(row) {
  return {
    id: row.id,
    code: row.code,
    destination: row.destination,
    clicks: Number(row.clicks),
    createdAt: row.created_at,
    lastVisitedAt: row.last_visited_at
  };
}

async function supabaseRequest(resource, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${resource}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVER_KEY,
      Authorization: `Bearer ${SUPABASE_SERVER_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const responseText = await response.text();
  const data = responseText ? JSON.parse(responseText) : null;
  if (!response.ok) {
    const error = new Error(data?.message || "The hosted database could not complete that request.");
    error.status = response.status;
    throw error;
  }
  return data;
}

async function getLinks() {
  if (!USE_REMOTE_STORE) {
    return getLocalLinks().sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));
  }
  const rows = await supabaseRequest("links?select=id,code,destination,clicks,created_at,last_visited_at&order=created_at.desc");
  return rows.map(remoteLink);
}

async function saveNewLink(link) {
  if (!USE_REMOTE_STORE) {
    const links = getLocalLinks();
    links.push(link);
    saveLocalLinks(links);
    return link;
  }
  const rows = await supabaseRequest("links", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ code: link.code, destination: link.destination })
  });
  return remoteLink(rows[0]);
}

async function removeLink(code) {
  if (!USE_REMOTE_STORE) {
    const links = getLocalLinks();
    const remainingLinks = links.filter((link) => link.code !== code);
    if (remainingLinks.length === links.length) return false;
    saveLocalLinks(remainingLinks);
    return true;
  }
  const rows = await supabaseRequest(`links?code=eq.${encodeURIComponent(code)}`, {
    method: "DELETE",
    headers: { Prefer: "return=representation" }
  });
  return rows.length > 0;
}

async function recordLinkVisit(code) {
  if (!USE_REMOTE_STORE) {
    const links = getLocalLinks();
    const link = links.find((item) => item.code === code);
    if (!link) return null;
    link.clicks += 1;
    link.lastVisitedAt = new Date().toISOString();
    saveLocalLinks(links);
    return link;
  }
  const rows = await supabaseRequest("rpc/record_link_visit", {
    method: "POST",
    body: JSON.stringify({ short_code: code })
  });
  return rows.length ? remoteLink(rows[0]) : null;
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_SIZE) {
        reject(new Error("Request is too large."));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function normalizeUrl(value) {
  try {
    const url = new URL(String(value).trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeCode(value) {
  const code = String(value || "").trim().toLowerCase();
  return /^[a-z0-9_-]{3,32}$/.test(code) ? code : null;
}

function createCode(links) {
  let code;
  do {
    code = crypto.randomBytes(5).toString("base64url").slice(0, 7).toLowerCase();
  } while (links.some((link) => link.code === code));
  return code;
}

function originFor(request) {
  const forwardedProtocol = request.headers["x-forwarded-proto"];
  const protocol = forwardedProtocol === "https" ? "https" : "http";
  return `${protocol}://${request.headers.host || `localhost:${PORT}`}`;
}

function publicLink(link, request) {
  return { ...link, shortUrl: `${originFor(request)}/${link.code}` };
}

function sendFile(response, fileName) {
  const safeFileName = path.basename(fileName);
  const filePath = path.join(PUBLIC_DIR, safeFileName);
  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff"
    });
    response.end(content);
  });
}

async function handleApi(request, response, pathname) {
  if (request.method === "GET" && pathname === "/api/links") {
    const links = await getLinks();
    return sendJson(response, 200, { links: links.map((link) => publicLink(link, request)) });
  }

  if (request.method === "GET" && pathname === "/api/summary") {
    const links = await getLinks();
    const clicks = links.reduce((total, link) => total + link.clicks, 0);
    const latestVisit = links.map((link) => link.lastVisitedAt).filter(Boolean).sort().at(-1) || null;
    return sendJson(response, 200, { linkCount: links.length, clicks, latestVisit });
  }

  if (request.method === "POST" && pathname === "/api/links") {
    try {
      const body = JSON.parse(await readRequestBody(request));
      const destination = normalizeUrl(body.destination);
      if (!destination) return sendJson(response, 400, { error: "Enter a valid URL beginning with http:// or https://." });

      const links = await getLinks();
      const requestedCode = body.alias ? normalizeCode(body.alias) : null;
      if (body.alias && !requestedCode) {
        return sendJson(response, 400, { error: "Aliases need 3–32 lowercase letters, numbers, hyphens, or underscores." });
      }
      const code = requestedCode || createCode(links);
      if (links.some((link) => link.code === code)) return sendJson(response, 409, { error: "That alias is already in use." });

      const link = await saveNewLink({
        id: crypto.randomUUID(),
        code,
        destination,
        clicks: 0,
        createdAt: new Date().toISOString(),
        lastVisitedAt: null
      });
      return sendJson(response, 201, { link: publicLink(link, request) });
    } catch (error) {
      if (error.status === 409) return sendJson(response, 409, { error: "That alias is already in use." });
      return sendJson(response, 400, { error: error.message === "Request is too large." ? error.message : "Could not read that link. Please try again." });
    }
  }

  const deleteMatch = pathname.match(/^\/api\/links\/([a-z0-9_-]+)$/);
  if (request.method === "DELETE" && deleteMatch) {
    const deleted = await removeLink(deleteMatch[1]);
    return deleted ? sendJson(response, 200, { ok: true }) : sendJson(response, 404, { error: "Link not found." });
  }

  return sendJson(response, 404, { error: "Route not found." });
}

const server = http.createServer(async (request, response) => {
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Frame-Options", "DENY");
  try {
    const url = new URL(request.url, originFor(request));
    const pathname = decodeURIComponent(url.pathname);

    if (pathname.startsWith("/api/")) return await handleApi(request, response, pathname);
    if (pathname === "/" || pathname === "/index.html") return sendFile(response, "index.html");
    if (pathname === "/styles.css") return sendFile(response, "styles.css");
    if (pathname === "/app.js") return sendFile(response, "app.js");
    if (pathname === "/auth.js") return sendFile(response, "auth.js");
    if (pathname === "/health") return sendJson(response, 200, { status: "ok", storage: USE_REMOTE_STORE ? "supabase" : "local" });

    const code = pathname.slice(1).toLowerCase();
    if (/^[a-z0-9_-]{3,32}$/.test(code)) {
      const link = await recordLinkVisit(code);
      if (link) {
        response.writeHead(302, { Location: link.destination, "Cache-Control": "no-store" });
        return response.end();
      }
    }

    response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    response.end("<h1>404 — Link not found</h1><p>This short link does not exist or has been removed.</p>");
  } catch (error) {
    console.error(error);
    if (!response.headersSent) sendJson(response, 500, { error: "The service could not complete that request." });
    else response.end();
  }
});

if (process.env.NODE_ENV === "production" && !USE_REMOTE_STORE) {
  throw new Error("Production requires SUPABASE_URL and SUPABASE_SECRET_KEY. See DEPLOYMENT.md.");
}

if (!USE_REMOTE_STORE) ensureDataFile();

server.listen(PORT, "0.0.0.0", () => {
  const storage = USE_REMOTE_STORE ? "Supabase" : "local JSON storage";
  console.log(`LinkNest is running at http://localhost:${PORT} using ${storage}.`);
});
