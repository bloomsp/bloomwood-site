import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const publicDir = path.join(root, "public");
const outDir = path.join(publicDir, "og");

const size = { width: 1200, height: 630 };

async function logoDataUrl(logoPath) {
  const logoFile = path.join(publicDir, logoPath.replace(/^\//, ""));
  const ext = path.extname(logoFile).toLowerCase();
  const buf = await fs.readFile(logoFile);

  // Playwright can be finicky with file:// assets when using page.setContent.
  // Embed the logo as a data: URL so it always renders.
  if (ext === ".svg") {
    const svg = buf.toString("utf8");
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  const mime =
    ext === ".png"
      ? "image/png"
      : ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : "application/octet-stream";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

async function htmlTemplate({
  bg,
  accent,
  brandName = "Bloomwood",
  title,
  subtitle,
  subtitle2,
  logoPath,
  logoPath2,
}) {
  const logoUrl = logoPath ? await logoDataUrl(logoPath) : null;
  const logoUrl2 = logoPath2 ? await logoDataUrl(logoPath2) : null;
  const hasSecondLogo = Boolean(logoUrl2);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        width: ${size.width}px;
        height: ${size.height}px;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
        background: ${bg};
        color: #0b0b0b;
      }
      .frame {
        position: relative;
        width: 100%;
        height: 100%;
        padding: 64px 72px;
        display: grid;
        grid-template-columns: 1fr;
        gap: 28px;
      }
      .accent {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(1200px 630px at 20% 10%, rgba(255,255,255,0.35), rgba(255,255,255,0) 55%),
          radial-gradient(900px 500px at 90% 90%, ${accent}55, rgba(255,255,255,0) 60%);
        pointer-events: none;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 18px;
      }
      .logo {
        width: 96px;
        height: 96px;
        border-radius: 20px;
        background: rgba(255,255,255,0.6);
        display: grid;
        place-items: center;
        border: 1px solid rgba(0,0,0,0.08);
        overflow: hidden;
      }
      .logo.dual {
        width: 220px;
        height: 150px;
        border-radius: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 14px;
        padding: 12px;
      }
      .logo img { width: 76px; height: 76px; object-fit: contain; }
      .logo.dual img { width: 100px; height: 100px; }

      .brand-name {
        font-size: 34px;
        font-weight: 700;
        letter-spacing: -0.02em;
      }
      .title {
        margin-top: 12px;
        font-size: 72px;
        font-weight: 800;
        letter-spacing: -0.03em;
        line-height: 1.05;
        max-width: 980px;
      }
      .subtitle {
        font-size: 30px;
        font-weight: 500;
        color: rgba(0,0,0,0.72);
        max-width: 980px;
        line-height: 1.25;
      }
      .url {
        position: absolute;
        right: 72px;
        bottom: 56px;
        font-size: 22px;
        color: rgba(0,0,0,0.55);
        letter-spacing: 0.01em;
      }
    </style>
  </head>
  <body>
    <div class="accent"></div>
    <div class="frame">
      <div class="brand">
        <div class="logo ${hasSecondLogo ? "dual" : ""}">
          ${logoUrl ? `<img src="${logoUrl}" alt="" />` : ""}
          ${logoUrl2 ? `<img src="${logoUrl2}" alt="" />` : ""}
        </div>
        <div class="brand-name">${brandName}</div>
      </div>

      <div>
        <div class="title">${title}</div>
        <div class="subtitle">${subtitle ?? ""}</div>
        ${subtitle2 ? `<div class="subtitle">${subtitle2}</div>` : ""}
      </div>

      <div class="url">bloomwood.com.au</div>
    </div>
  </body>
</html>`;
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function render({ filename, ...spec }) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: size, deviceScaleFactor: 2 });
  await page.setContent(await htmlTemplate(spec), { waitUntil: "load" });
  const base = path.resolve(outDir);
  const target = path.resolve(base, filename);
  const relative = path.relative(base, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Invalid file path");
  }
  const outPath = target;
  await page.screenshot({ path: outPath, type: "png" });
  await browser.close();
  console.log("wrote", path.relative(root, outPath));
}

await ensureDir(outDir);

await render({
  filename: "og-home.png",
  bg: "#f8fafc",
  accent: "#0ea5e9",
  title: "Welcome to Bloomwood",
  subtitle: "Home of Bloomwood Solutions (IT support) and ",
  subtitle2: "Bloomwood Media (writing & self‑publishing).",
  logoPath: "/logo.svg",
  logoPath2: "/logo-media.svg",
});

await render({
  filename: "og-solutions.png",
  bg: "#fff7ed",
  accent: "#fb923c",
  title: "Bloomwood Solutions",
  subtitle: "Friendly onsite and remote IT support across the Cairns region.",
  logoPath: "/images/solutions/Bloomwood-Solutions-gslogo-512.png",
});

await render({
  filename: "og-media.png",
  bg: "#faf5ff",
  accent: "#7c3aed",
  title: "Bloomwood Media",
  subtitle: "Editing, publishing, technical writing, and content services.",
  logoPath: "/images/media/bloomwood-media-logo-square.png",
});
