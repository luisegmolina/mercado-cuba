// Mercado Cuba — backend adaptado al ESQUEMA NUEVO (2026-11-12).
// Cambios frente al esquema viejo:
//  - Auth de vendedor contra `users` (la cuenta ya no ES la tienda);
//    el JWT lleva user_id (v:2) y las rutas verifican owner_id.
//  - Fotos en `product_images` (solo URLs https; data: rechazado con 400).
//    La subida va directa del celular a Cloudinary y el backend solo
//    guarda el enlace que devuelve.
//  - Licencias con vigencia: `licenses` + `store_licenses` + `license_events`.
//  - Admin en la tabla `admins` (password_changed_at alimenta el recordatorio).
//  - Acciones del admin quedan en `audit_log`.
//  - /api/public/stores devuelve slug y provincia y exige licencia vigente.
//  - Sin lecturas de admin_config ni fallback '5350000000'.
require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const crypto = require("crypto");

const app = express();
// Render está detrás de un proxy: sin esto, express-rate-limit ve la IP
// del proxy y todos los clientes comparten un único cubo.
app.set("trust proxy", 1);
app.use(compression());
// Sin crossOriginResourcePolicy: la API la consume el frontend desde
// otro origen (pages.dev) y ese encabezado bloquearía los fetch.
app.use(helmet({ crossOriginResourcePolicy: false }));
// Orígenes permitidos: la web en producción, la APK (Capacitor) y el
// desarrollo local. Sin Origin (curl, apps) se permite.
const ALLOWED_ORIGINS = [
  "https://mercado-cuba.pages.dev",
  "capacitor://localhost",
  "http://localhost",
  "https://localhost",
];
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
// Las fotos ya son URLs, no base64: 1 MB sobra para cualquier payload JSON.
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ limit: "1mb", extended: true }));

// --- CONFIGURACIÓN ---
// Sin secretos por defecto: si faltan las variables, el servidor no arranca.
// (En Render JWT_SECRET y SUPER_ADMIN_PASS SÍ están configuradas.)
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const DEFAULT_ADMIN_PASS = process.env.SUPER_ADMIN_PASS;
if (!JWT_SECRET || !DEFAULT_ADMIN_PASS) {
  console.error(
    "[ERROR] Faltan variables de entorno obligatorias: JWT_SECRET y SUPER_ADMIN_PASS deben estar definidas. El servidor no arranca sin ellas.",
  );
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});
pool.on("error", (err) => {
  console.error("[POOL] Error de conexión inactivo:", err.message);
});

const createSlug = (name) => {
  return name
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-");
};

// --- TELÉFONOS (WhatsApp) ---
// Normaliza a dígitos con código de país: Cuba (8 dígitos) -> "53"+n,
// EEUU (10 dígitos) -> "1"+n; si ya trae el código, se deja tal cual.
const normalizePhone = (raw) => {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("53") && d.length === 10) return d;
  if (d.length === 8) return "53" + d;
  if (d.startsWith("1") && d.length === 11) return d;
  if (d.length === 10) return "1" + d;
  return d;
};

// Quita el código de país: "5359150911" -> "59150911", "18063168743" -> "8063168743".
const stripCountryCode = (normalized) => {
  if (normalized.startsWith("53") && normalized.length === 10)
    return normalized.slice(2);
  if (normalized.startsWith("1") && normalized.length === 11)
    return normalized.slice(1);
  return normalized;
};

// Válido: Cuba 53+8 dígitos o EEUU 1+10 dígitos.
const isValidPhone = (normalized) =>
  (normalized.startsWith("53") && normalized.length === 10) ||
  (normalized.startsWith("1") && normalized.length === 11);

// URL https válida (nunca data: — el esquema nuevo lo prohíbe con CHECK).
// Las fotos subidas desde el celular llegan como res.cloudinary.com;
// se acepta cualquier https por ahora, solo se valida el formato.
const isHttpsUrl = (u) =>
  typeof u === "string" &&
  /^https:\/\//i.test(u.trim()) &&
  !/^data:/i.test(u.trim());

// Columnas seguras de un usuario (nunca devolver password_hash)
const SAFE_USER_COLUMNS =
  "id, whatsapp, owner_name, is_active, is_suspended, must_reset_password, last_login_at, created_at";

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// Paginación: ?limit (defecto 50, máximo 100) y ?offset (defecto 0)
const parsePagination = (req) => {
  let limit = parseInt(req.query.limit, 10);
  let offset = parseInt(req.query.offset, 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 50;
  if (limit > 100) limit = 100;
  if (!Number.isFinite(offset) || offset < 0) offset = 0;
  return { limit, offset };
};

const numOr = (v, dflt) =>
  v === undefined || v === null || v === "" ? dflt : Number(v);

// --- AUDITORÍA ---
// Escribe en audit_log. Si el registro falla, no rompe la operación:
// se anota en consola y se sigue.
const logAudit = async ({
  actor_type,
  actor_id,
  action,
  target_type,
  target_id,
  details,
}) => {
  try {
    await pool.query(
      "INSERT INTO audit_log (actor_type, actor_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5, $6)",
      [
        actor_type,
        actor_id || null,
        action,
        target_type || null,
        target_id || null,
        details ? JSON.stringify(details) : null,
      ],
    );
  } catch (e) {
    console.error("[AUDIT] No se pudo registrar:", e.message);
  }
};

// Bootstrap único del admin: solo si la tabla `admins` está VACÍA
// (base nueva). La clave se cambia dentro del panel (UPDATE admins);
// el arranque nunca vuelve a sembrar mientras haya una fila.
const initAdminBootstrap = async () => {
  let client;
  try {
    client = await pool.connect();
    const res = await client.query("SELECT COUNT(*)::int AS n FROM admins");
    if (res.rows[0].n === 0) {
      const hash = await bcrypt.hash(DEFAULT_ADMIN_PASS, 12);
      const envWa = process.env.ADMIN_SUPPORT_WHATSAPP
        ? normalizePhone(process.env.ADMIN_SUPPORT_WHATSAPP)
        : "";
      if (envWa && isValidPhone(envWa)) {
        await client.query(
          "INSERT INTO admins (password_hash, support_whatsapp) VALUES ($1, $2)",
          [hash, envWa],
        );
      } else {
        // support_whatsapp toma el DEFAULT del esquema.
        await client.query(
          "INSERT INTO admins (password_hash) VALUES ($1)",
          [hash],
        );
      }
      console.log(
        "[INFO] Admin inicial creado (bootstrap único, tabla admins vacía).",
      );
    }
  } catch (err) {
    console.error("Error init admin:", err.message);
  } finally {
    if (client) client.release();
  }
};
initAdminBootstrap();

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token requerido" });
  jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }, (err, user) => {
    if (err) return res.status(403).json({ error: "Token inválido" });
    // Los tokens de vendedor del esquema viejo llevaban id = id de la
    // tienda. El esquema nuevo usa id = id del usuario: esos tokens
    // ya no valen y hay que volver a entrar.
    if (user.role === "vendor" && user.v !== 2)
      return res
        .status(401)
        .json({ error: "Sesión anterior: vuelve a entrar" });
    req.user = user;
    next();
  });
};

// Límite de intentos en los endpoints de autenticación (anti fuerza bruta)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 20, // 20 intentos por IP
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.",
  },
});

// Límite por cuenta (además del límite por IP): 5 fallos en 15 min
// bloquean ESA cuenta 15 min. Sin esto, rotando IPs se puede probar
// contraseñas contra una cuenta concreta sin que nunca se bloquee.
const loginFailures = new Map();
const LOGIN_MAX_FAILS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const accountLocked = (key) => {
  const rec = loginFailures.get(key);
  return !!rec && rec.blockedUntil && rec.blockedUntil > Date.now();
};
const recordLoginFailure = (key) => {
  const now = Date.now();
  const rec = loginFailures.get(key);
  if (!rec || now - rec.firstAt > LOGIN_WINDOW_MS)
    loginFailures.set(key, { count: 1, firstAt: now, blockedUntil: 0 });
  else {
    rec.count += 1;
    if (rec.count >= LOGIN_MAX_FAILS) rec.blockedUntil = now + LOGIN_WINDOW_MS;
  }
};
const clearLoginFailures = (key) => loginFailures.delete(key);

// --- CONSULTAS COMPARTIDAS ---
// Una tienda es visible en el mercado solo si es pública, no está
// suspendida Y tiene una concesión de licencia activa y vigente.
// (En la rama migrada hay 0 concesiones: la lista pública sale vacía
// hasta que el admin conceda licencias a las tiendas existentes.)
const PUBLIC_STORE_CONDITION = `s.is_public AND NOT s.is_suspended AND EXISTS (
  SELECT 1 FROM store_licenses sl
  WHERE sl.store_id = s.id AND sl.status = 'active' AND sl.valid_until > now()
)`;

// Tienda con nombre del dueño y de la provincia (lo que usa el frontend).
const fetchStoreFull = async (storeId) => {
  const r = await pool.query(
    `SELECT s.*, u.owner_name, u.whatsapp AS owner_whatsapp, p.name AS province_name
     FROM stores s JOIN users u ON u.id = s.owner_id
     LEFT JOIN provinces p ON p.id = s.province_id WHERE s.id = $1`,
    [storeId],
  );
  return r.rows[0] || null;
};

// Todas las tiendas de un usuario (la primera, por antigüedad, es la
// que muestra el panel del vendedor mientras no haya selector multi-tienda).
const fetchStoresOfUser = async (userId) => {
  const r = await pool.query(
    `SELECT s.*, u.owner_name, u.whatsapp AS owner_whatsapp, p.name AS province_name
     FROM stores s JOIN users u ON u.id = s.owner_id
     LEFT JOIN provinces p ON p.id = s.province_id
     WHERE s.owner_id = $1 ORDER BY s.created_at ASC`,
    [userId],
  );
  return r.rows;
};

// La tienda del vendedor: la indicada (si es suya) o su primera tienda.
const resolveVendorStore = async (userId, storeId) => {
  if (storeId) {
    const r = await pool.query(
      "SELECT * FROM stores WHERE id = $1 AND owner_id = $2",
      [storeId, userId],
    );
    return r.rows[0] || null;
  }
  const r = await pool.query(
    "SELECT * FROM stores WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1",
    [userId],
  );
  return r.rows[0] || null;
};

// Producto con sus fotos como array de URLs (campo `images`).
const fetchProductWithImages = async (productId) => {
  const r = await pool.query(
    `SELECT p.*, COALESCE(json_agg(pi.url ORDER BY pi.position) FILTER (WHERE pi.url IS NOT NULL), '[]') AS images
     FROM products p LEFT JOIN product_images pi ON pi.product_id = p.id
     WHERE p.id = $1 GROUP BY p.id`,
    [productId],
  );
  return r.rows[0] || null;
};

const fetchProductsOfStore = async (storeId, onlyVisible = false) => {
  const r = await pool.query(
    `SELECT p.*, COALESCE(json_agg(pi.url ORDER BY pi.position) FILTER (WHERE pi.url IS NOT NULL), '[]') AS images
     FROM products p LEFT JOIN product_images pi ON pi.product_id = p.id
     WHERE p.store_id = $1 ${onlyVisible ? "AND p.is_visible" : ""}
     GROUP BY p.id ORDER BY p.created_at DESC`,
    [storeId],
  );
  return r.rows;
};

// Listado público de productos con conteo total y búsqueda por texto
// (?q=). El ILIKE '%...%' usa los índices trigram (pg_trgm).
const listPublicProducts = async ({ provinceId = null, limit, offset, q = null }) => {
  const where = [PUBLIC_STORE_CONDITION, "p.is_visible"];
  const params = [];
  if (provinceId) {
    params.push(provinceId);
    where.push(`s.province_id = $${params.length}`);
  }
  if (q) {
    params.push(q);
    const i = params.length;
    where.push(
      `(p.name ILIKE '%' || $${i} || '%' OR s.name ILIKE '%' || $${i} || '%' OR p.category ILIKE '%' || $${i} || '%')`,
    );
  }
  const whereSql = where.join(" AND ");
  const itemsParams = [...params, limit, offset];
  const li = itemsParams.length - 1;
  const oi = itemsParams.length;
  const items = await pool.query(
    `SELECT p.*, COALESCE(json_agg(pi.url ORDER BY pi.position) FILTER (WHERE pi.url IS NOT NULL), '[]') AS images,
            s.name AS store_name, s.whatsapp AS store_whatsapp, s.slug AS store_slug, prov.name AS store_province
     FROM products p
     JOIN stores s ON p.store_id = s.id
     LEFT JOIN provinces prov ON s.province_id = prov.id
     LEFT JOIN product_images pi ON pi.product_id = p.id
     WHERE ${whereSql}
     GROUP BY p.id, s.id, prov.id
     ORDER BY p.created_at DESC LIMIT $${li} OFFSET $${oi}`,
    itemsParams,
  );
  const total = await pool.query(
    `SELECT COUNT(*)::int AS total FROM products p
     JOIN stores s ON p.store_id = s.id WHERE ${whereSql}`,
    params,
  );
  return { items: items.rows, total: total.rows[0].total };
};

// --- SALUD (sin consultar la base) ---
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// Sesión actual: restaura el usuario vendedor (con sus tiendas) o
// confirma el admin (con la fecha del último cambio de clave).
app.get("/api/me", authenticateToken, async (req, res, next) => {
  try {
    if (req.user.role === "superadmin") {
      let row = null;
      if (req.user.admin_id) {
        const a = await pool.query(
          "SELECT password_changed_at, support_whatsapp FROM admins WHERE id = $1",
          [req.user.admin_id],
        );
        row = a.rows[0] || null;
      }
      if (!row) {
        const a = await pool.query(
          "SELECT password_changed_at, support_whatsapp FROM admins ORDER BY created_at ASC LIMIT 1",
        );
        row = a.rows[0] || null;
      }
      return res.json({
        admin: true,
        password_changed_at: row ? row.password_changed_at : null,
        support_whatsapp: row ? row.support_whatsapp : null,
      });
    }
    if (req.user.role !== "vendor") {
      return res.status(403).json({ error: "No autorizado" });
    }
    const userRes = await pool.query(
      `SELECT ${SAFE_USER_COLUMNS} FROM users WHERE id = $1`,
      [req.user.id],
    );
    if (userRes.rows.length === 0)
      return res.status(404).json({ error: "Usuario no encontrado" });
    if (userRes.rows[0].is_suspended)
      return res.status(403).json({ error: "Cuenta suspendida." });
    const stores = await fetchStoresOfUser(req.user.id);
    const store = stores[0] || null;
    const products = store ? await fetchProductsOfStore(store.id) : [];
    res.json({ user: userRes.rows[0], stores, store, products });
  } catch (err) {
    next(err);
  }
});

// --- RUTAS PÚBLICAS ---

// Obtener Configuración Pública (Para que el frontend sepa a qué número mandar mensajes)
app.get("/api/public/config", async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT support_whatsapp FROM admins ORDER BY created_at ASC LIMIT 1",
    );
    if (result.rows.length === 0)
      return res.status(503).json({ error: "Configuración no disponible" });
    res.json({ whatsapp: result.rows[0].support_whatsapp });
  } catch (err) {
    next(err);
  }
});

// --- TASAS DE CAMBIO (mercado informal, según elTOQUE) ---
// La tasa la actualiza el admin desde su panel. No se lee directo de
// elTOQUE: su API oficial exige registro + clave, y el scraping lo
// desaconseja elTOQUE y lo bloquea Cloudflare. Si la tabla aún no
// existe, se devuelve lista vacía y el banner no se muestra.
app.get("/api/public/rates", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT currency, rate_cup, source, updated_at FROM exchange_rates
       ORDER BY CASE currency WHEN 'USD' THEN 0 WHEN 'EUR' THEN 1 WHEN 'MLC' THEN 2 WHEN 'CAD' THEN 3 WHEN 'MXN' THEN 4 WHEN 'ZELLE' THEN 5 WHEN 'CLA' THEN 6 ELSE 7 END`,
    );
    res.json({ rates: result.rows });
  } catch (err) {
    res.json({ rates: [] });
  }
});

app.put("/api/admin/rates", authenticateToken, async (req, res, next) => {
  if (req.user.role !== "superadmin")
    return res.status(403).json({ error: "Admin" });
  const allowed = ["USD", "EUR", "MLC", "CAD", "MXN", "ZELLE", "CLA"];
  const rates = Array.isArray(req.body.rates) ? req.body.rates : [];
  const clean = [];
  for (const r of rates) {
    const currency = String(r.currency || "")
      .toUpperCase()
      .trim();
    const rate = Number(r.rate_cup);
    if (!allowed.includes(currency)) continue;
    if (!Number.isFinite(rate) || rate <= 0)
      return res
        .status(400)
        .json({ error: `Tasa inválida para ${currency}` });
    clean.push({ currency, rate_cup: rate });
  }
  if (clean.length === 0)
    return res.status(400).json({ error: "Sin tasas válidas" });
  try {
    for (const r of clean) {
      await pool.query(
        `INSERT INTO exchange_rates (currency, rate_cup, source, updated_at)
         VALUES ($1, $2, 'elTOQUE', now())
         ON CONFLICT (currency) DO UPDATE SET rate_cup = EXCLUDED.rate_cup, source = 'elTOQUE', updated_at = now()`,
        [r.currency, r.rate_cup],
      );
    }
    await logAudit({
      actor_type: "admin",
      actor_id: req.user.admin_id,
      action: "admin_rates_update",
      target_type: "admin",
      target_id: req.user.admin_id,
      details: { rates: clean },
    });
    const result = await pool.query(
      `SELECT currency, rate_cup, source, updated_at FROM exchange_rates
       ORDER BY CASE currency WHEN 'USD' THEN 0 WHEN 'EUR' THEN 1 WHEN 'MLC' THEN 2 WHEN 'CAD' THEN 3 WHEN 'MXN' THEN 4 WHEN 'ZELLE' THEN 5 WHEN 'CLA' THEN 6 ELSE 7 END`,
    );
    res.json({ rates: result.rows });
  } catch (err) {
    next(err);
  }
});

// Endpoint para obtener la vitrina global (con conteo total y ?q=)
app.get("/api/public/all-products", async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const q =
      req.query.q && String(req.query.q).trim()
        ? String(req.query.q).trim()
        : null;
    const result = await listPublicProducts({ limit, offset, q });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.get("/api/public/landing", async (req, res, next) => {
  try {
    const storesRes = await pool.query(
      `SELECT COUNT(*)::int AS n FROM stores s WHERE ${PUBLIC_STORE_CONDITION}`,
    );
    const { items, total } = await listPublicProducts({
      limit: 100,
      offset: 0,
    });
    const firstImage = (p) =>
      Array.isArray(p.images) && p.images.length ? p.images[0] : "";
    // Destacados: con foto primero, sin repetir nombre+tienda, hasta 6.
    const seen = new Set();
    const featured = [];
    const withPhoto = items.filter((p) => firstImage(p));
    const withoutPhoto = items.filter((p) => !firstImage(p));
    for (const p of [...withPhoto, ...withoutPhoto]) {
      const key = `${String(p.store_slug || p.store_name || "").toLowerCase()}|${String(p.name || "").toLowerCase().trim().replace(/\s+/g, " ")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      featured.push({
        ...p,
        images: firstImage(p) ? [firstImage(p)] : [],
      });
      if (featured.length >= 6) break;
    }
    // Portada de cada tienda: la primera foto de su primer producto.
    const covers = {};
    for (const p of items) {
      const slug = String(p.store_slug || "").toLowerCase().trim();
      if (slug && !(slug in covers)) {
        const img = firstImage(p);
        if (img) covers[slug] = img;
      }
    }
    res.json({
      stores: storesRes.rows[0].n,
      products: total,
      featured,
      covers,
    });
  } catch (err) {
    next(err);
  }
});

app.get("/api/public/stores", async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.name, s.slug, s.description, s.whatsapp, s.logo_url, s.province_id, s.created_at,
              p.name AS province_name
       FROM stores s
       LEFT JOIN provinces p ON p.id = s.province_id
       WHERE ${PUBLIC_STORE_CONDITION}
       ORDER BY s.created_at DESC`,
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

app.get("/api/store/:identifier", async (req, res, next) => {
  try {
    const { identifier } = req.params;
    const isUUID = UUID_REGEX.test(identifier);
    const query = isUUID
      ? `SELECT s.*, u.owner_name, p.name AS province_name,
                (SELECT valid_until FROM store_licenses WHERE store_id = s.id ORDER BY valid_until DESC LIMIT 1) AS license_valid_until
         FROM stores s JOIN users u ON u.id = s.owner_id
         LEFT JOIN provinces p ON p.id = s.province_id WHERE s.id = $1`
      : `SELECT s.*, u.owner_name, p.name AS province_name,
                (SELECT valid_until FROM store_licenses WHERE store_id = s.id ORDER BY valid_until DESC LIMIT 1) AS license_valid_until
         FROM stores s JOIN users u ON u.id = s.owner_id
         LEFT JOIN provinces p ON p.id = s.province_id WHERE s.slug = $1`;

    const storeRes = await pool.query(query, [identifier]);
    if (storeRes.rows.length === 0)
      return res.status(404).json({ error: "Tienda no encontrada" });
    if (storeRes.rows[0].is_suspended)
      return res.status(403).json({ error: "Tienda suspendida." });
    // Una tienda oculta o sin licencia vigente no se abre ni por enlace
    // directo (misma regla que la lista pública).
    if (!storeRes.rows[0].is_public)
      return res.status(404).json({ error: "Tienda no encontrada" });
    const grantRes = await pool.query(
      `SELECT 1 FROM store_licenses WHERE store_id = $1 AND status = 'active' AND valid_until > now() LIMIT 1`,
      [storeRes.rows[0].id],
    );
    if (grantRes.rows.length === 0)
      return res.status(404).json({ error: "Tienda no encontrada" });

    const store = storeRes.rows[0];
    const products = await fetchProductsOfStore(store.id, true);
    res.json({ store, products });
  } catch (err) {
    next(err);
  }
});

// --- AUTH ---
// El vendedor entra con WhatsApp + clave contra la tabla `users`.
// CENTINELA: las cuentas migradas sin clave llevan password_hash =
// 'NO_PASSWORD_SET' y must_reset_password = TRUE. Se comprueba ANTES
// de bcrypt.compare, porque comparar el centinela falla.
app.post("/api/login", authLimiter, async (req, res, next) => {
  const { whatsapp, password } = req.body;
  try {
    // El vendedor puede escribir su número con o sin código de país:
    // se prueban el normalizado (+53/+1), sin código y el valor original.
    const normalized = normalizePhone(whatsapp);
    const candidates = [
      ...new Set(
        [
          normalized,
          stripCountryCode(normalized),
          String(whatsapp ?? "").replace(/\D/g, ""),
        ].filter(Boolean),
      ),
    ];
    const userRes = await pool.query(
      `SELECT * FROM users WHERE whatsapp = ANY($1)`,
      [candidates],
    );
    // Respuesta genérica para usuario inexistente o clave incorrecta:
    // no revelar si el número está registrado. La comparación ficticia
    // iguala el tiempo de respuesta en ambos casos.
    const DUMMY_HASH =
      "$2b$12$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0";
    if (userRes.rows.length === 0) {
      await bcrypt
        .compare(String(password || ""), DUMMY_HASH)
        .catch(() => false);
      return res.status(401).json({ error: "Credenciales inválidas" });
    }
    const user = userRes.rows[0];
    if (user.is_suspended)
      return res.status(403).json({ error: "Cuenta suspendida." });
    if (
      user.must_reset_password ||
      user.password_hash === "NO_PASSWORD_SET"
    ) {
      return res.status(403).json({
        error: "Debes crear tu contraseña para entrar",
        must_reset_password: true,
      });
    }
    if (accountLocked(candidates[0]))
      return res.status(429).json({
        error: "Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.",
      });
    if (!(await bcrypt.compare(password, user.password_hash || ""))) {
      recordLoginFailure(candidates[0]);
      return res.status(401).json({ error: "Credenciales inválidas" });
    }
    clearLoginFailures(candidates[0]);

    await pool.query(
      "UPDATE users SET last_login_at = now() WHERE id = $1",
      [user.id],
    );
    const token = jwt.sign(
      { id: user.id, role: "vendor", name: user.owner_name, v: 2 },
      JWT_SECRET,
      { expiresIn: "1d", algorithm: "HS256" },
    );
    const stores = await fetchStoresOfUser(user.id);
    const store = stores[0] || null;
    const products = store ? await fetchProductsOfStore(store.id) : [];
    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser, stores, store, products });
  } catch (err) {
    next(err);
  }
});

app.post("/api/register", authLimiter, async (req, res) => {
  const { name, whatsapp, ownerName, code, password } = req.body;
  if (!name || !String(name).trim())
    return res.status(400).json({ error: "El nombre de la tienda es obligatorio" });
  if (!whatsapp || !String(whatsapp).trim())
    return res.status(400).json({ error: "El número de WhatsApp es obligatorio" });
  const normalizedWhatsapp = normalizePhone(whatsapp);
  if (!isValidPhone(normalizedWhatsapp))
    return res.status(400).json({
      error: "Número de WhatsApp inválido (revisa el código de país)",
    });
  if (!password || String(password).length < 10)
    return res
      .status(400)
      .json({ error: "La contraseña debe tener al menos 10 caracteres" });
  if (!code || !String(code).trim())
    return res.status(400).json({ error: "El código de licencia es obligatorio" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Bloquear la fila del código: dos registros simultáneos no pueden canjearlo.
    const codeRes = await client.query(
      "SELECT * FROM licenses WHERE code = $1 FOR UPDATE",
      [String(code).trim().toUpperCase()],
    );
    if (codeRes.rows.length === 0) {
      throw new Error("INVALID_CODE");
    }
    const lic = codeRes.rows[0];
    if (lic.status === "used" || lic.status === "revoked") {
      throw new Error("USED_CODE");
    }
    if (
      lic.status !== "active" ||
      (lic.expires_at && new Date(lic.expires_at) <= new Date())
    ) {
      throw new Error("EXPIRED_CODE");
    }

    // Un WhatsApp = una cuenta. Si ya existe, hay que entrar con esa
    // cuenta (crear otra tienda con el mismo número no está en el panel).
    const existingUser = await client.query(
      "SELECT id FROM users WHERE whatsapp = $1",
      [normalizedWhatsapp],
    );
    if (existingUser.rows.length > 0) {
      throw new Error("WHATSAPP_IN_USE");
    }

    let slug = createSlug(name);
    for (let i = 0; i < 5; i++) {
      const checkSlug = await client.query(
        "SELECT id FROM stores WHERE slug = $1",
        [slug],
      );
      if (checkSlug.rows.length === 0) break;
      slug = `${createSlug(name)}-${Math.floor(Math.random() * 10000)}`;
    }

    const hash = await bcrypt.hash(password, 12);
    const owner = (ownerName && String(ownerName).trim()) || String(name).trim();
    const userRes = await client.query(
      `INSERT INTO users (whatsapp, password_hash, owner_name)
       VALUES ($1, $2, $3)
       RETURNING ${SAFE_USER_COLUMNS}`,
      [normalizedWhatsapp, hash, owner],
    );
    const user = userRes.rows[0];

    const storeRes = await client.query(
      `INSERT INTO stores (owner_id, name, slug, whatsapp)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [user.id, String(name).trim(), slug, normalizedWhatsapp],
    );
    const store = storeRes.rows[0];

    // Concesión de la licencia: vigencia = duration_days del código.
    const validUntil = new Date(
      Date.now() + (lic.duration_days || 365) * 86400000,
    );
    await client.query(
      "INSERT INTO store_licenses (license_id, store_id, user_id, valid_until) VALUES ($1, $2, $3, $4)",
      [lic.id, store.id, user.id, validUntil.toISOString()],
    );
    await client.query("UPDATE licenses SET status = 'used' WHERE id = $1", [
      lic.id,
    ]);
    await client.query(
      "INSERT INTO license_events (license_id, store_id, user_id, event, notes) VALUES ($1, $2, $3, 'redeemed', $4)",
      [
        lic.id,
        store.id,
        user.id,
        `Canje en registro; vigencia ${lic.duration_days || 365} días`,
      ],
    );

    await client.query("COMMIT");

    const token = jwt.sign(
      { id: user.id, role: "vendor", name: user.owner_name, v: 2 },
      JWT_SECRET,
      { expiresIn: "1d", algorithm: "HS256" },
    );
    const fullStore = await fetchStoreFull(store.id);
    res.json({ token, user, store: fullStore });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("Error al hacer ROLLBACK:", rollbackErr.message);
    }
    if (err.message === "INVALID_CODE")
      return res.status(400).json({ error: "Código de licencia inválido" });
    if (err.message === "USED_CODE")
      return res
        .status(400)
        .json({ error: "Ese código de licencia ya fue usado" });
    if (err.message === "EXPIRED_CODE")
      return res
        .status(400)
        .json({ error: "Ese código de licencia caducó" });
    if (err.message === "WHATSAPP_IN_USE")
      return res.status(400).json({
        error: "Ese WhatsApp ya tiene una cuenta. Entra con tu contraseña.",
      });
    console.error(err);
    return res.status(400).json({ error: "No se pudo crear la tienda" });
  } finally {
    client.release();
  }
});

app.post("/api/admin/login", authLimiter, async (req, res, next) => {
  const { password } = req.body;
  try {
    const dbRes = await pool.query(
      "SELECT id, password_hash FROM admins ORDER BY created_at ASC LIMIT 1",
    );
    if (dbRes.rows.length === 0)
      return res.status(500).json({ error: "Error de configuración" });
    const admin = dbRes.rows[0];
    if (await bcrypt.compare(password, admin.password_hash)) {
      await pool.query(
        "UPDATE admins SET last_login_at = now() WHERE id = $1",
        [admin.id],
      );
      const token = jwt.sign(
        { role: "superadmin", admin_id: admin.id },
        JWT_SECRET,
        { expiresIn: "4h", algorithm: "HS256" },
      );
      res.json({ token });
    } else {
      res.status(401).json({ error: "Inválido" });
    }
  } catch (err) {
    next(err);
  }
});

// --- PRODUCTOS ---
// Validación de datos de producto (compartida por crear y editar)
const validateProduct = (body, isUpdate) => {
  const { name, priceCup, priceUsd, category, stock } = body;
  if (name !== undefined && (!name || !String(name).trim())) {
    return "El nombre del producto es obligatorio";
  }
  if (!isUpdate && (!name || !String(name).trim())) {
    return "El nombre del producto es obligatorio";
  }
  for (const [label, value] of [
    ["CUP", priceCup],
    ["USD", priceUsd],
  ]) {
    if (value !== undefined && value !== null && value !== "") {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) {
        return `El precio en ${label} debe ser un número mayor o igual a 0`;
      }
    }
  }
  if (stock !== undefined && stock !== null && stock !== "") {
    const n = Number(stock);
    if (!Number.isInteger(n) || n < 0) {
      return "El stock debe ser un número entero mayor o igual a 0";
    }
  }
  if (category !== undefined && category !== null && typeof category !== "string") {
    return "La categoría debe ser texto";
  }
  return null;
};

// Las fotos son un array de URLs https. data: (base64) se rechaza:
// el esquema nuevo lo prohíbe con CHECK en product_images.
const validateImages = (images) => {
  if (images === undefined || images === null) return null;
  if (!Array.isArray(images))
    return "Las fotos deben ser una lista de enlaces (URLs)";
  if (images.length > 5) return "Máximo 5 fotos por producto";
  for (const u of images) {
    if (!isHttpsUrl(u))
      return "Las fotos deben ser enlaces https; no se aceptan imágenes en base64 (data:)";
  }
  return null;
};

app.post("/api/products", authenticateToken, async (req, res, next) => {
  if (req.user.role !== "vendor")
    return res.status(403).json({ error: "No autorizado" });

  const validationError = validateProduct(req.body, false);
  if (validationError)
    return res.status(400).json({ error: validationError });
  const imagesError = validateImages(req.body.images);
  if (imagesError) return res.status(400).json({ error: imagesError });

  const {
    name,
    description,
    priceCup,
    priceUsd,
    category,
    images,
    stock,
    is_visible,
    store_id,
  } = req.body;
  try {
    const store = await resolveVendorStore(req.user.id, store_id);
    if (!store)
      return res.status(404).json({ error: "No tienes tienda" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const prodRes = await client.query(
        "INSERT INTO products (store_id, name, description, price_cup, price_usd, category, stock, is_visible) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
        [
          store.id,
          String(name).trim(),
          description || null,
          numOr(priceCup, 0),
          numOr(priceUsd, 0),
          category || null,
          numOr(stock, 1),
          is_visible !== undefined ? !!is_visible : true,
        ],
      );
      const product = prodRes.rows[0];
      const imgs = (images || []).slice(0, 5);
      for (let i = 0; i < imgs.length; i++) {
        await client.query(
          "INSERT INTO product_images (product_id, url, position) VALUES ($1, $2, $3)",
          [product.id, String(imgs[i]).trim(), i],
        );
      }
      await client.query("COMMIT");
      res.json(await fetchProductWithImages(product.id));
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {}
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

app.put("/api/products/:id", authenticateToken, async (req, res, next) => {
  const { id } = req.params;
  const validationError = validateProduct(req.body, true);
  if (validationError)
    return res.status(400).json({ error: validationError });
  const imagesError = validateImages(req.body.images);
  if (imagesError) return res.status(400).json({ error: imagesError });

  const {
    name,
    description,
    priceCup,
    priceUsd,
    category,
    images,
    stock,
    is_visible,
  } = req.body;
  try {
    // Propiedad: el producto debe ser de una tienda del usuario.
    const check = await pool.query(
      `SELECT p.store_id FROM products p
       JOIN stores s ON s.id = p.store_id
       WHERE p.id = $1 AND s.owner_id = $2`,
      [id, req.user.id],
    );
    if (check.rows.length === 0)
      return res.status(403).json({ error: "No autorizado" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE products SET
         name = COALESCE($1, name), description = COALESCE($2, description),
         price_cup = COALESCE($3, price_cup), price_usd = COALESCE($4, price_usd),
         category = COALESCE($5, category), stock = COALESCE($6, stock),
         is_visible = COALESCE($7, is_visible),
         updated_at = now()
         WHERE id = $8`,
        [
          name !== undefined && name !== null ? String(name).trim() : null,
          description === undefined ? null : description,
          priceCup === undefined || priceCup === null || priceCup === ""
            ? null
            : Number(priceCup),
          priceUsd === undefined || priceUsd === null || priceUsd === ""
            ? null
            : Number(priceUsd),
          category === undefined ? null : category,
          stock === undefined || stock === null || stock === ""
            ? null
            : Number(stock),
          is_visible === undefined ? null : !!is_visible,
          id,
        ],
      );
      if (images !== undefined && images !== null) {
        await client.query(
          "DELETE FROM product_images WHERE product_id = $1",
          [id],
        );
        const imgs = images.slice(0, 5);
        for (let i = 0; i < imgs.length; i++) {
          await client.query(
            "INSERT INTO product_images (product_id, url, position) VALUES ($1, $2, $3)",
            [id, String(imgs[i]).trim(), i],
          );
        }
      }
      await client.query("COMMIT");
      res.json(await fetchProductWithImages(id));
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {}
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

app.delete("/api/products/:id", authenticateToken, async (req, res, next) => {
  try {
    const check = await pool.query(
      `SELECT p.store_id FROM products p
       JOIN stores s ON s.id = p.store_id
       WHERE p.id = $1 AND s.owner_id = $2`,
      [req.params.id, req.user.id],
    );
    if (check.rows.length === 0)
      return res.status(403).json({ error: "No autorizado" });
    await pool.query("DELETE FROM products WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

app.put("/api/store/settings", authenticateToken, async (req, res, next) => {
  if (req.user.role !== "vendor")
    return res.status(403).json({ error: "No autorizado" });

  const {
    name,
    description,
    logoUrl,
    whatsapp,
    is_public,
    province_id,
    store_id,
  } = req.body;

  if (!name || !String(name).trim())
    return res.status(400).json({ error: "El nombre de la tienda es obligatorio" });
  if (!whatsapp || !String(whatsapp).trim())
    return res.status(400).json({ error: "El número de WhatsApp es obligatorio" });
  // Guardar el WhatsApp normalizado (+53 Cuba / +1 EEUU) y validar el formato.
  const normalizedWhatsapp = normalizePhone(whatsapp);
  if (!isValidPhone(normalizedWhatsapp))
    return res.status(400).json({
      error: "Número de WhatsApp inválido (revisa el código de país)",
    });
  if (
    logoUrl !== undefined &&
    logoUrl !== null &&
    String(logoUrl).trim() !== "" &&
    !isHttpsUrl(logoUrl)
  )
    return res.status(400).json({
      error: "El logo debe ser un enlace https; no se aceptan imágenes en base64",
    });
  if (
    province_id !== undefined &&
    province_id !== null &&
    province_id !== "" &&
    !UUID_REGEX.test(String(province_id))
  ) {
    return res.status(400).json({ error: "Provincia no válida" });
  }

  try {
    const store = await resolveVendorStore(req.user.id, store_id);
    if (!store)
      return res.status(404).json({ error: "Tienda no encontrada" });

    await pool.query(
      `UPDATE stores
       SET name = $1, description = $2, logo_url = $3, whatsapp = $4, is_public = $5, province_id = $6
       WHERE id = $7`,
      [
        String(name).trim(),
        description || null,
        logoUrl && String(logoUrl).trim() ? String(logoUrl).trim() : null,
        normalizedWhatsapp,
        is_public !== undefined ? !!is_public : store.is_public,
        province_id === "" ? null : province_id || null,
        store.id,
      ],
    );
    res.json(await fetchStoreFull(store.id));
  } catch (err) {
    next(err);
  }
});

app.get("/api/public/provinces", async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT * FROM provinces ORDER BY name ASC",
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// --- ADMIN ROUTES ---
app.get("/api/admin/dashboard", authenticateToken, async (req, res, next) => {
  if (req.user.role !== "superadmin")
    return res.status(403).json({ error: "Requiere SuperAdmin" });
  try {
    const stats = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS total_users,
        (SELECT COUNT(*)::int FROM stores) AS total_stores,
        (SELECT COUNT(*)::int FROM products) AS total_products,
        (SELECT COUNT(*)::int FROM licenses WHERE status = 'active') AS available_licenses,
        (SELECT COUNT(*)::int FROM store_licenses WHERE status = 'active' AND valid_until > now()) AS active_grants,
        (SELECT COUNT(*)::int FROM store_licenses WHERE status = 'active' AND valid_until > now() AND valid_until <= now() + interval '30 days') AS expiring_soon
    `);
    const adminRow = await pool.query(
      "SELECT password_changed_at, support_whatsapp FROM admins ORDER BY created_at ASC LIMIT 1",
    );
    const stores = await pool.query(
      `SELECT s.id, s.name, s.slug, s.description, s.whatsapp, s.logo_url, s.province_id,
              s.is_public, s.is_suspended, s.created_at,
              u.owner_name, u.whatsapp AS owner_whatsapp, u.must_reset_password,
              p.name AS province_name,
              gl.valid_until AS license_valid_until, gl.status AS license_status
       FROM stores s
       JOIN users u ON u.id = s.owner_id
       LEFT JOIN provinces p ON p.id = s.province_id
       LEFT JOIN LATERAL (
         SELECT valid_until, status FROM store_licenses
         WHERE store_id = s.id ORDER BY valid_until DESC LIMIT 1
       ) gl ON true
       ORDER BY s.created_at DESC`,
    );
    const codes = await pool.query(
      `SELECT l.id, l.code, l.status, l.duration_days, l.expires_at, l.created_at,
              sl.store_id, s.name AS store_name, s.slug AS store_slug,
              sl.valid_until, sl.status AS grant_status
       FROM licenses l
       LEFT JOIN store_licenses sl ON sl.license_id = l.id
       LEFT JOIN stores s ON s.id = sl.store_id
       ORDER BY l.created_at DESC`,
    );
    res.json({
      stats: stats.rows[0],
      stores: stores.rows,
      codes: codes.rows,
      // Alimenta el recordatorio de cambio de clave en el panel.
      // El intervalo (30/60/90 días) lo elige el dueño después.
      password_changed_at: adminRow.rows[0]
        ? adminRow.rows[0].password_changed_at
        : null,
      support_whatsapp: adminRow.rows[0]
        ? adminRow.rows[0].support_whatsapp
        : null,
    });
  } catch (err) {
    next(err);
  }
});

// Genera un código aleatorio de 12 caracteres (A-Z, 0-9)
const generateLicenseCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 12; i++) {
    code += chars[crypto.randomInt(chars.length)];
  }
  return code;
};

app.post("/api/admin/codes", authenticateToken, async (req, res, next) => {
  if (req.user.role !== "superadmin")
    return res.status(403).json({ error: "Admin" });
  try {
    const code =
      req.body.code && String(req.body.code).trim()
        ? String(req.body.code).trim().toUpperCase()
        : generateLicenseCode();
    const expiresAt =
      req.body.expires_at && String(req.body.expires_at).trim()
        ? req.body.expires_at
        : null;
    let durationDays =
      req.body.duration_days !== undefined &&
      req.body.duration_days !== null &&
      req.body.duration_days !== ""
        ? parseInt(req.body.duration_days, 10)
        : 365;
    if (!Number.isInteger(durationDays) || durationDays < 1)
      return res.status(400).json({
        error: "La duración debe ser un número de días mayor que 0",
      });
    const newCode = await pool.query(
      "INSERT INTO licenses (code, expires_at, duration_days, created_by_admin_id) VALUES ($1, $2, $3, $4) RETURNING *",
      [code, expiresAt, durationDays, req.user.admin_id || null],
    );
    const lic = newCode.rows[0];
    await pool.query(
      "INSERT INTO license_events (license_id, admin_id, event, notes) VALUES ($1, $2, 'created', $3)",
      [
        lic.id,
        req.user.admin_id || null,
        `Código creado (vigencia ${durationDays} días)`,
      ],
    );
    await logAudit({
      actor_type: "admin",
      actor_id: req.user.admin_id,
      action: "license_create",
      target_type: "license",
      target_id: lic.id,
      details: { code: lic.code, duration_days: durationDays },
    });
    res.json(lic);
  } catch (err) {
    if (err.code === "23505")
      return res.status(400).json({ error: "Ese código ya existe" });
    next(err);
  }
});

app.delete("/api/admin/codes/:id", authenticateToken, async (req, res, next) => {
  if (req.user.role !== "superadmin")
    return res.status(403).json({ error: "Admin" });
  try {
    const lic = await pool.query(
      "SELECT id, code, status FROM licenses WHERE id = $1",
      [req.params.id],
    );
    if (lic.rows.length === 0)
      return res.status(404).json({ error: "Código no encontrado" });
    if (lic.rows[0].status === "used")
      return res.status(400).json({
        error: "No se puede borrar una licencia en uso; revócala primero",
      });
    await pool.query("DELETE FROM licenses WHERE id = $1", [req.params.id]);
    await logAudit({
      actor_type: "admin",
      actor_id: req.user.admin_id,
      action: "license_delete",
      target_type: "license",
      target_id: lic.rows[0].id,
      details: { code: lic.rows[0].code },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Revocar una licencia: la marca revocada y anula su concesión si la tenía.
app.put("/api/admin/codes/:id/revoke", authenticateToken, async (req, res, next) => {
  if (req.user.role !== "superadmin")
    return res.status(403).json({ error: "Admin" });
  try {
    const lic = await pool.query(
      "SELECT id, code, status FROM licenses WHERE id = $1",
      [req.params.id],
    );
    if (lic.rows.length === 0)
      return res.status(404).json({ error: "Código no encontrado" });
    if (lic.rows[0].status === "revoked")
      return res
        .status(400)
        .json({ error: "La licencia ya está revocada" });
    await pool.query("UPDATE licenses SET status = 'revoked' WHERE id = $1", [
      req.params.id,
    ]);
    const grant = await pool.query(
      "UPDATE store_licenses SET status = 'revoked' WHERE license_id = $1 RETURNING store_id, user_id",
      [req.params.id],
    );
    await pool.query(
      "INSERT INTO license_events (license_id, store_id, user_id, admin_id, event, notes) VALUES ($1, $2, $3, $4, 'revoked', 'Revocada por el admin')",
      [
        req.params.id,
        grant.rows[0] ? grant.rows[0].store_id : null,
        grant.rows[0] ? grant.rows[0].user_id : null,
        req.user.admin_id || null,
      ],
    );
    await logAudit({
      actor_type: "admin",
      actor_id: req.user.admin_id,
      action: "license_revoke",
      target_type: "license",
      target_id: lic.rows[0].id,
      details: { code: lic.rows[0].code },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Extender la vigencia de una licencia ya canjeada (+N días desde hoy
// si ya caducó, o desde su fecha si sigue vigente).
app.put("/api/admin/codes/:id/extend", authenticateToken, async (req, res, next) => {
  if (req.user.role !== "superadmin")
    return res.status(403).json({ error: "Admin" });
  let days = parseInt(req.body.days, 10);
  if (!Number.isInteger(days) || days < 1) days = 365;
  try {
    const grant = await pool.query(
      "SELECT * FROM store_licenses WHERE license_id = $1",
      [req.params.id],
    );
    if (grant.rows.length === 0)
      return res
        .status(400)
        .json({ error: "Esta licencia aún no fue canjeada" });
    const g = grant.rows[0];
    const updated = await pool.query(
      `UPDATE store_licenses
       SET valid_until = GREATEST(valid_until, now()) + ($1 || ' days')::interval, status = 'active'
       WHERE id = $2 RETURNING *`,
      [String(days), g.id],
    );
    await pool.query(
      "INSERT INTO license_events (license_id, store_id, user_id, admin_id, event, notes) VALUES ($1, $2, $3, $4, 'extended', $5)",
      [
        req.params.id,
        g.store_id,
        g.user_id,
        req.user.admin_id || null,
        `Vigencia extendida ${days} días`,
      ],
    );
    await logAudit({
      actor_type: "admin",
      actor_id: req.user.admin_id,
      action: "license_extend",
      target_type: "license",
      target_id: req.params.id,
      details: { days, valid_until: updated.rows[0].valid_until },
    });
    res.json(updated.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Conceder una licencia disponible a una tienda existente (p. ej. las
// 13 tiendas migradas, que no tienen ninguna concesión). Crea la
// concesión con vigencia = duration_days del código.
app.post("/api/admin/store/:id/grant", authenticateToken, async (req, res, next) => {
  if (req.user.role !== "superadmin")
    return res.status(403).json({ error: "Admin" });
  const { license_id } = req.body;
  if (!license_id)
    return res.status(400).json({ error: "Falta la licencia" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const storeRes = await client.query(
      "SELECT id, owner_id, name FROM stores WHERE id = $1 FOR UPDATE",
      [req.params.id],
    );
    if (storeRes.rows.length === 0) throw new Error("NO_STORE");
    const store = storeRes.rows[0];

    const licRes = await client.query(
      "SELECT * FROM licenses WHERE id = $1 FOR UPDATE",
      [license_id],
    );
    if (licRes.rows.length === 0) throw new Error("NO_LICENSE");
    const lic = licRes.rows[0];
    if (
      lic.status !== "active" ||
      (lic.expires_at && new Date(lic.expires_at) <= new Date())
    )
      throw new Error("LICENSE_NOT_ACTIVE");

    const activeGrant = await client.query(
      "SELECT id FROM store_licenses WHERE store_id = $1 AND status = 'active' AND valid_until > now()",
      [store.id],
    );
    if (activeGrant.rows.length > 0) throw new Error("ALREADY_LICENSED");

    const validUntil = new Date(
      Date.now() + (lic.duration_days || 365) * 86400000,
    );
    const grant = await client.query(
      "INSERT INTO store_licenses (license_id, store_id, user_id, valid_until) VALUES ($1, $2, $3, $4) RETURNING *",
      [lic.id, store.id, store.owner_id, validUntil.toISOString()],
    );
    await client.query("UPDATE licenses SET status = 'used' WHERE id = $1", [
      lic.id,
    ]);
    await client.query(
      "INSERT INTO license_events (license_id, store_id, user_id, admin_id, event, notes) VALUES ($1, $2, $3, $4, 'redeemed', 'Licencia concedida por el admin')",
      [lic.id, store.id, store.owner_id, req.user.admin_id || null],
    );
    await client.query("COMMIT");
    await logAudit({
      actor_type: "admin",
      actor_id: req.user.admin_id,
      action: "license_grant",
      target_type: "store",
      target_id: store.id,
      details: {
        license_id: lic.id,
        code: lic.code,
        valid_until: validUntil.toISOString(),
      },
    });
    res.json(grant.rows[0]);
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    if (err.message === "NO_STORE")
      return res.status(404).json({ error: "Tienda no encontrada" });
    if (err.message === "NO_LICENSE")
      return res.status(404).json({ error: "Licencia no encontrada" });
    if (err.message === "LICENSE_NOT_ACTIVE")
      return res
        .status(400)
        .json({ error: "Esa licencia no está disponible" });
    if (err.message === "ALREADY_LICENSED")
      return res
        .status(400)
        .json({ error: "La tienda ya tiene una licencia vigente" });
    next(err);
  } finally {
    client.release();
  }
});

app.put("/api/admin/store/:id/status", authenticateToken, async (req, res, next) => {
  if (req.user.role !== "superadmin")
    return res.status(403).json({ error: "Admin" });
  try {
    const result = await pool.query(
      "UPDATE stores SET is_suspended = $1 WHERE id = $2 RETURNING id, name",
      [!!req.body.is_suspended, req.params.id],
    );
    if (result.rowCount === 0)
      return res.status(404).json({ error: "Tienda no encontrada" });
    await logAudit({
      actor_type: "admin",
      actor_id: req.user.admin_id,
      action: req.body.is_suspended ? "store_suspend" : "store_unsuspend",
      target_type: "store",
      target_id: result.rows[0].id,
      details: { name: result.rows[0].name },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

app.delete("/api/admin/store/:id", authenticateToken, async (req, res, next) => {
  if (req.user.role !== "superadmin")
    return res.status(403).json({ error: "Admin" });
  try {
    // Borrar la tienda NO borra la cuenta: el usuario (owner_id)
    // queda intacto en `users` (ese era el error E1).
    const result = await pool.query(
      "DELETE FROM stores WHERE id = $1 RETURNING id, name, owner_id",
      [req.params.id],
    );
    if (result.rowCount === 0)
      return res.status(404).json({ error: "Tienda no encontrada" });
    await logAudit({
      actor_type: "admin",
      actor_id: req.user.admin_id,
      action: "store_delete",
      target_type: "store",
      target_id: result.rows[0].id,
      details: {
        name: result.rows[0].name,
        owner_id: result.rows[0].owner_id,
      },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Actualizar contraseña de tienda desde admin: se resetea la clave del
// USUARIO dueño de la tienda (no de la tienda, que ya no tiene clave).
app.put(
  "/api/admin/store/:id/password",
  authenticateToken,
  async (req, res, next) => {
    if (req.user.role !== "superadmin")
      return res.status(403).json({ error: "Admin" });
    if (!req.body.newPassword || String(req.body.newPassword).length < 10)
      return res
        .status(400)
        .json({ error: "La contraseña debe tener al menos 10 caracteres" });
    try {
      const store = await pool.query(
        "SELECT owner_id, name FROM stores WHERE id = $1",
        [req.params.id],
      );
      if (store.rows.length === 0)
        return res.status(404).json({ error: "Tienda no encontrada" });
      const hash = await bcrypt.hash(req.body.newPassword, 12);
      await pool.query(
        "UPDATE users SET password_hash = $1, must_reset_password = FALSE WHERE id = $2",
        [hash, store.rows[0].owner_id],
      );
      await logAudit({
        actor_type: "admin",
        actor_id: req.user.admin_id,
        action: "user_password_reset",
        target_type: "user",
        target_id: store.rows[0].owner_id,
        details: { store_id: req.params.id, store_name: store.rows[0].name },
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// Actualizar contacto de tienda desde admin (con normalización, como el
// camino del vendedor: el endpoint viejo guardaba el número tal cual).
app.put("/api/admin/store/:id/contact", authenticateToken, async (req, res, next) => {
  if (req.user.role !== "superadmin")
    return res.status(403).json({ error: "Admin" });
  try {
    const { whatsapp } = req.body;
    if (!whatsapp)
      return res.status(400).json({ error: "Número requerido" });
    const normalized = normalizePhone(whatsapp);
    if (!isValidPhone(normalized))
      return res.status(400).json({
        error: "Número de WhatsApp inválido (revisa el código de país)",
      });
    const result = await pool.query(
      "UPDATE stores SET whatsapp = $1 WHERE id = $2 RETURNING id, name",
      [normalized, req.params.id],
    );
    if (result.rowCount === 0)
      return res.status(404).json({ error: "Tienda no encontrada" });
    await logAudit({
      actor_type: "admin",
      actor_id: req.user.admin_id,
      action: "store_contact_change",
      target_type: "store",
      target_id: result.rows[0].id,
      details: { name: result.rows[0].name, whatsapp: normalized },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

app.put("/api/admin/password", authenticateToken, async (req, res, next) => {
  if (req.user.role !== "superadmin")
    return res.status(403).json({ error: "Admin" });
  if (!req.body.password || req.body.password.length < 10)
    return res
      .status(400)
      .json({ error: "La contraseña debe tener al menos 10 caracteres" });
  if (!req.body.currentPassword)
    return res.status(400).json({ error: "Escribe la clave actual" });
  try {
    // Hay que verificar la clave actual: con un token robado no basta
    // para cambiar la clave y dejar fuera al dueño.
    const adminIdRes = req.user.admin_id
      ? { rows: [{ id: req.user.admin_id }] }
      : await pool.query(
          "SELECT id FROM admins ORDER BY created_at ASC LIMIT 1",
        );
    const adminId = adminIdRes.rows[0] && adminIdRes.rows[0].id;
    if (!adminId)
      return res.status(404).json({ error: "Configuración no encontrada" });
    const adminRes = await pool.query(
      "SELECT password_hash FROM admins WHERE id = $1",
      [adminId],
    );
    if (
      adminRes.rows.length === 0 ||
      !(await bcrypt.compare(
        String(req.body.currentPassword),
        adminRes.rows[0].password_hash || "",
      ))
    )
      return res.status(401).json({ error: "La clave actual no coincide" });
    const hash = await bcrypt.hash(req.body.password, 12);
    // password_changed_at = now(): ahí arranca el reloj del recordatorio.
    const result = await pool.query(
      "UPDATE admins SET password_hash = $1, password_changed_at = now() WHERE id = $2 RETURNING id",
      [hash, adminId],
    );
    if (result.rowCount === 0)
      return res.status(404).json({ error: "Configuración no encontrada" });
    await logAudit({
      actor_type: "admin",
      actor_id: req.user.admin_id,
      action: "admin_password_change",
      target_type: "admin",
      target_id: result.rows[0].id,
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Actualizar Contacto de Soporte del SuperAdmin
app.put("/api/admin/config/contact", authenticateToken, async (req, res, next) => {
  if (req.user.role !== "superadmin")
    return res.status(403).json({ error: "Admin" });
  const { whatsapp } = req.body;
  if (!whatsapp) return res.status(400).json({ error: "Número requerido" });
  const normalized = normalizePhone(whatsapp);
  if (!isValidPhone(normalized))
    return res.status(400).json({
      error: "Número de WhatsApp inválido (revisa el código de país)",
    });

  try {
    const result = req.user.admin_id
      ? await pool.query(
          "UPDATE admins SET support_whatsapp = $1 WHERE id = $2 RETURNING id",
          [normalized, req.user.admin_id],
        )
      : await pool.query(
          "UPDATE admins SET support_whatsapp = $1 WHERE id = (SELECT id FROM admins ORDER BY created_at ASC LIMIT 1) RETURNING id",
          [normalized],
        );
    if (result.rowCount === 0)
      return res.status(404).json({ error: "Configuración no encontrada" });
    await logAudit({
      actor_type: "admin",
      actor_id: req.user.admin_id,
      action: "admin_contact_change",
      target_type: "admin",
      target_id: result.rows[0].id,
      details: { support_whatsapp: normalized },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Endpoint OPTIMIZADO: Busca productos SOLO de una provincia específica
app.get("/api/public/products/province/:id", async (req, res, next) => {
  const { id } = req.params;
  if (!UUID_REGEX.test(id)) {
    return res.status(400).json({ error: "Provincia no válida" });
  }
  try {
    const { limit, offset } = parsePagination(req);
    const q =
      req.query.q && String(req.query.q).trim()
        ? String(req.query.q).trim()
        : null;
    const result = await listPublicProducts({
      provinceId: id,
      limit,
      offset,
      q,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// --- MANEJO DE ERRORES (siempre al final) ---
// 404 JSON para rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// Middleware de errores: nunca filtrar mensajes internos de Postgres al cliente
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Error del servidor. Inténtalo de nuevo." });
});

app.listen(PORT, () => console.log(`Backend CubaMarket en puerto ${PORT}`));
