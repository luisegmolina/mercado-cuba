// Prerender de etiquetas Open Graph por tienda (para la vista previa
// de WhatsApp/Facebook/Telegram al compartir un enlace de tienda).
//
// Qué hace: después de `npm run build`, por cada tienda pública genera
// build/<slug>/index.html — una copia del index.html del build con
// og:title, og:description, og:image y og:url de ESA tienda (su primera
// foto de producto, o su logo, o la imagen genérica). La copia carga el
// mismo JavaScript de la app, así que para una persona la página funciona
// igual; el rastreador de WhatsApp (que no ejecuta JavaScript) ve las
// etiquetas y muestra la tarjeta con foto y nombre de la tienda.
//
// A PRUEBA DE FALLOS: si el backend está dormido o algo falla, avisa y
// termina sin error — el build NO se rompe y las etiquetas genéricas de
// index.html siguen valiendo. Las tiendas creadas DESPUÉS del último
// despliegue muestran la tarjeta genérica hasta el próximo despliegue.
const fs = require("fs");
const path = require("path");

const API_URL = "https://mercado-backend-o8vl.onrender.com/api";
const SITE_URL = "https://mercado-cuba.pages.dev";
const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`;
const BUILD_DIR = path.join(__dirname, "..", "build");

// Rutas de la app que nunca son slugs de tienda.
const RESERVED = new Set([
  "login",
  "register",
  "explorar",
  "dashboard",
  "vendedor",
  "admin",
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, label) {
  // Render Free se duerme: el primer intento lo despierta (~50 s).
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 70000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn(`[prerender] ${label}: intento ${attempt}/3 falló (${e.message})`);
      if (attempt < 3) await sleep(10000);
    }
  }
  return null;
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Recorte 1200x630 para la tarjeta de WhatsApp (Cloudinary).
function ogImage(url) {
  if (!url) return DEFAULT_IMAGE;
  if (url.includes("res.cloudinary.com") && url.includes("/upload/")) {
    return url.replace("/upload/", "/upload/w_1200,h_630,c_fill,q_auto/");
  }
  return url;
}

function setMeta(html, attr, value) {
  // Reemplaza el content de <meta property|name="attr" content="...">.
  const re = new RegExp(
    `(<meta\\s+(?:property|name)="${attr}"\\s+content=")[^"]*(")`,
  );
  if (re.test(html)) return html.replace(re, `$1${esc(value)}$2`);
  return html;
}

async function main() {
  const indexPath = path.join(BUILD_DIR, "index.html");
  if (!fs.existsSync(indexPath)) {
    console.warn("[prerender] no hay build/index.html, salto el paso");
    return;
  }
  const template = fs.readFileSync(indexPath, "utf8");

  const stores = await fetchJson(
    `${API_URL}/public/stores?slim=1`,
    "lista de tiendas",
  );
  if (!Array.isArray(stores) || stores.length === 0) {
    console.warn("[prerender] sin tiendas (o backend sin responder), nada que generar");
    return;
  }

  let done = 0;
  for (const s of stores) {
    const slug = String(s.slug || "").trim();
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug) || RESERVED.has(slug)) continue;
    const detail = await fetchJson(`${API_URL}/store/${slug}`, `tienda ${slug}`);
    const products = Array.isArray(detail?.products) ? detail.products : [];
    const firstImage =
      products.find((p) => Array.isArray(p.images) && p.images[0])?.images[0] ||
      detail?.store?.logo_url ||
      s.logo_url ||
      null;
    const place = [s.municipality_name, s.province_name].filter(Boolean).join(", ");
    const description =
      s.description ||
      detail?.store?.description ||
      (products.length > 0
        ? `${products.length} producto${products.length === 1 ? "" : "s"}${place ? ` · ${place}` : ""} · Pide por WhatsApp`
        : `Tienda en Mercado Cuba${place ? ` · ${place}` : ""}`);
    const page0 = setMeta(
      setMeta(
        setMeta(
          setMeta(
            setMeta(
              setMeta(
                setMeta(
                  template,
                  "og:title",
                  `${s.name} | Mercado Cuba`,
                ),
                "og:description",
                description,
              ),
              "og:image",
              ogImage(firstImage),
            ),
            "og:url",
            `${SITE_URL}/${slug}`,
          ),
          "twitter:title",
          `${s.name} | Mercado Cuba`,
        ),
        "twitter:description",
        description,
      ),
      "twitter:image",
      ogImage(firstImage),
    );
    const page = setMeta(
      page0,
      "og:image:alt",
      `${s.name} — Mercado Cuba`,
    ).replace(
      /<title>[^<]*<\/title>/,
      `<title>${esc(s.name)} | Mercado Cuba</title>`,
    );
    const dir = path.join(BUILD_DIR, slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), page);
    done++;
  }
  console.log(`[prerender] ${done} página(s) de tienda generadas en build/`);
}

main().catch((e) => {
  console.warn(`[prerender] aviso: ${e.message} (sigo sin romper el build)`);
});
