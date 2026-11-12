require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
//const path = require("path");

const app = express();
app.use(compression());
app.use(
  cors({
    origin: "*", // Permite que cualquier dominio (como tu .pages.dev) se conecte
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
// Aumentar límite para subida de imágenes
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

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

// Columnas seguras de una tienda (nunca devolver password_hash)
const SAFE_STORE_COLUMNS =
  "id, name, slug, description, whatsapp, logo_url, owner_name, is_active, is_suspended, is_public_market, province_id, whatsapp_clicks, created_at";

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

// Inicializar Seguridad Admin y Configuración
const initAdminSecurity = async () => {
  let client;
  try {
    client = await pool.connect();
    // Crear tabla de configuración si no existe
    await client.query(
      `CREATE TABLE IF NOT EXISTS admin_config (key VARCHAR(50) PRIMARY KEY, value TEXT NOT NULL);`,
    );

    // 1. Contraseña Admin
    const resPass = await client.query(
      "SELECT value FROM admin_config WHERE key = 'super_admin_hash'",
    );
    if (resPass.rows.length === 0) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(DEFAULT_ADMIN_PASS, salt);
      await client.query(
        "INSERT INTO admin_config (key, value) VALUES ('super_admin_hash', $1)",
        [hash],
      );
      console.log(`[INFO] Contraseña Admin inicializada.`);
    }

    // 2. WhatsApp de Soporte (Venta de Licencias)
    const resWa = await client.query(
      "SELECT value FROM admin_config WHERE key = 'super_admin_whatsapp'",
    );
    if (resWa.rows.length === 0) {
      await client.query(
        "INSERT INTO admin_config (key, value) VALUES ('super_admin_whatsapp', '5350000000')",
      );
      console.log(`[INFO] WhatsApp de soporte inicializado.`);
    }
  } catch (err) {
    console.error("Error init admin:", err);
  } finally {
    if (client) client.release();
  }
};
initAdminSecurity();

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token requerido" });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Token inválido" });
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

// --- SALUD (sin consultar la base) ---
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// Sesión actual: restaura la tienda del vendedor o confirma el admin
app.get("/api/me", authenticateToken, async (req, res, next) => {
  try {
    if (req.user.role === "superadmin") {
      return res.json({ admin: true });
    }
    if (req.user.role !== "vendor") {
      return res.status(403).json({ error: "No autorizado" });
    }
    const storeRes = await pool.query(
      `SELECT ${SAFE_STORE_COLUMNS} FROM stores WHERE id = $1`,
      [req.user.id],
    );
    if (storeRes.rows.length === 0)
      return res.status(404).json({ error: "Tienda no encontrada" });
    const productsRes = await pool.query(
      "SELECT * FROM products WHERE store_id = $1 ORDER BY created_at DESC",
      [req.user.id],
    );
    res.json({ store: storeRes.rows[0], products: productsRes.rows });
  } catch (err) {
    next(err);
  }
});

// --- RUTAS PÚBLICAS ---

// Obtener Configuración Pública (Para que el frontend sepa a qué número mandar mensajes)
app.get("/api/public/config", async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT value FROM admin_config WHERE key = 'super_admin_whatsapp'",
    );
    const whatsapp =
      result.rows.length > 0 ? result.rows[0].value : "5350000000";
    res.json({ whatsapp });
  } catch (err) {
    next(err);
  }
});

// Endpoint para obtener la vitrina global
app.get("/api/public/all-products", async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const query = `
      SELECT 
        p.id, p.name, p.price_cup, p.price_usd, p.image_url, p.category, p.stock, p.description,
        s.name as store_name, s.whatsapp as store_whatsapp, s.slug as store_slug,
        prov.name as store_province
      FROM products p
      JOIN stores s ON p.store_id = s.id
      LEFT JOIN provinces prov ON s.province_id = prov.id -- <--- NUEVO JOIN
      WHERE (s.is_public_market = true OR s.is_public_market::text = 'true') 
        AND (s.is_suspended = false OR s.is_suspended::text = 'false')
        AND (p.is_visible = true OR p.is_visible::text = 'true')
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2;
    `;
    const result = await pool.query(query, [limit, offset]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

app.get("/api/public/stores", async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, logo_url, description, whatsapp FROM stores WHERE is_active = TRUE AND is_suspended = FALSE ORDER BY created_at DESC`,
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
      ? "SELECT id, name, slug, description, whatsapp, logo_url, owner_name, is_suspended FROM stores WHERE id = $1"
      : "SELECT id, name, slug, description, whatsapp, logo_url, owner_name, is_suspended FROM stores WHERE slug = $1";

    const storeRes = await pool.query(query, [identifier]);
    if (storeRes.rows.length === 0)
      return res.status(404).json({ error: "Tienda no encontrada" });
    if (storeRes.rows[0].is_suspended)
      return res.status(403).json({ error: "Tienda suspendida." });

    const store = storeRes.rows[0];
    const productsRes = await pool.query(
      "SELECT * FROM products WHERE store_id = $1 AND is_visible = TRUE ORDER BY created_at DESC",
      [store.id],
    );
    res.json({ store, products: productsRes.rows });
  } catch (err) {
    next(err);
  }
});

// --- AUTH ---
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
    const storeRes = await pool.query(
      "SELECT * FROM stores WHERE whatsapp = ANY($1)",
      [candidates],
    );
    if (storeRes.rows.length === 0)
      return res.status(404).json({ error: "Usuario no encontrado" });
    const store = storeRes.rows[0];
    if (store.is_suspended)
      return res.status(403).json({ error: "Cuenta suspendida." });
    if (!(await bcrypt.compare(password, store.password_hash || "")))
      return res.status(401).json({ error: "Contraseña incorrecta" });

    const token = jwt.sign(
      { id: store.id, role: "vendor", name: store.owner_name },
      JWT_SECRET,
      { expiresIn: "7d" },
    );
    const productsRes = await pool.query(
      "SELECT * FROM products WHERE store_id = $1 ORDER BY created_at DESC",
      [store.id],
    );
    delete store.password_hash;
    res.json({ token, store, products: productsRes.rows });
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
  if (!password || String(password).length < 6)
    return res
      .status(400)
      .json({ error: "La contraseña debe tener al menos 6 caracteres" });
  if (!code || !String(code).trim())
    return res.status(400).json({ error: "El código de licencia es obligatorio" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Bloquear la fila del código: dos registros simultáneos no pueden canjearlo.
    const codeRes = await client.query(
      "SELECT * FROM activation_codes WHERE code = $1 FOR UPDATE",
      [String(code).trim().toUpperCase()],
    );
    if (codeRes.rows.length === 0) {
      throw new Error("INVALID_CODE");
    }
    const codeRow = codeRes.rows[0];
    if (codeRow.status === "used") {
      throw new Error("USED_CODE");
    }
    if (
      codeRow.status !== "active" ||
      (codeRow.expires_at && new Date(codeRow.expires_at) <= new Date())
    ) {
      throw new Error("EXPIRED_CODE");
    }

    let slug = createSlug(name);
    const checkSlug = await client.query(
      "SELECT id FROM stores WHERE slug = $1",
      [slug],
    );
    if (checkSlug.rows.length > 0)
      slug = `${slug}-${Math.floor(Math.random() * 1000)}`;

    const hash = await bcrypt.hash(password, 10);
    const storeRes = await client.query(
      `INSERT INTO stores (name, slug, whatsapp, owner_name, password_hash) VALUES ($1, $2, $3, $4, $5) RETURNING ${SAFE_STORE_COLUMNS}`,
      [name, slug, normalizedWhatsapp, ownerName, hash],
    );
    const newStore = storeRes.rows[0];

    // Marcar el código como usado (NO borrarlo: queda la auditoría de quién lo canjeó)
    await client.query(
      "UPDATE activation_codes SET status = 'used', used_by_store_id = $1, used_at = now() WHERE id = $2",
      [newStore.id, codeRow.id],
    );

    await client.query("COMMIT");

    const token = jwt.sign({ id: newStore.id, role: "vendor" }, JWT_SECRET, {
      expiresIn: "7d",
    });
    res.json({ store: newStore, token });
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
      "SELECT value FROM admin_config WHERE key = 'super_admin_hash'",
    );
    if (dbRes.rows.length === 0)
      return res.status(500).json({ error: "Error de configuración" });
    if (await bcrypt.compare(password, dbRes.rows[0].value)) {
      const token = jwt.sign({ role: "superadmin" }, JWT_SECRET, {
        expiresIn: "4h",
      });
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

app.post("/api/products", authenticateToken, async (req, res, next) => {
  if (req.user.role !== "vendor")
    return res.status(403).json({ error: "No autorizado" });

  const validationError = validateProduct(req.body, false);
  if (validationError)
    return res.status(400).json({ error: validationError });

  // CORRECCIÓN: Agregamos is_visible al destructuring y enviamos a la BD.
  const { name, priceCup, priceUsd, category, imageUrl, stock, is_visible } =
    req.body;
  try {
    const newProd = await pool.query(
      "INSERT INTO products (store_id, name, price_cup, price_usd, category, image_url, stock, is_visible) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
      [
        req.user.id,
        name,
        priceCup === undefined || priceCup === null || priceCup === ""
          ? 0
          : Number(priceCup),
        priceUsd === undefined || priceUsd === null || priceUsd === ""
          ? 0
          : Number(priceUsd),
        category || null,
        imageUrl || null,
        stock === undefined || stock === null || stock === ""
          ? 1
          : Number(stock),
        is_visible !== undefined ? is_visible : true, // Asegurar que sea true por defecto
      ],
    );
    res.json(newProd.rows[0]);
  } catch (err) {
    next(err);
  }
});

app.put("/api/products/:id", authenticateToken, async (req, res, next) => {
  const { id } = req.params;
  const validationError = validateProduct(req.body, true);
  if (validationError)
    return res.status(400).json({ error: validationError });

  const { name, priceCup, priceUsd, category, imageUrl, stock, is_visible } =
    req.body;
  try {
    const check = await pool.query(
      "SELECT store_id FROM products WHERE id = $1",
      [id],
    );
    if (check.rows.length === 0 || check.rows[0].store_id !== req.user.id)
      return res.status(403).json({ error: "No autorizado" });

    const updated = await pool.query(
      `UPDATE products SET 
       name=COALESCE($1, name), price_cup=COALESCE($2, price_cup), price_usd=COALESCE($3, price_usd), 
       category=COALESCE($4, category), image_url=COALESCE($5, image_url), 
       stock=COALESCE($6, stock), is_visible=COALESCE($7, is_visible) 
       WHERE id=$8 RETURNING *`,
      [
        name,
        priceCup === undefined || priceCup === null || priceCup === ""
          ? null
          : Number(priceCup),
        priceUsd === undefined || priceUsd === null || priceUsd === ""
          ? null
          : Number(priceUsd),
        category,
        imageUrl,
        stock === undefined || stock === null || stock === ""
          ? null
          : Number(stock),
        is_visible,
        id,
      ],
    );
    res.json(updated.rows[0]);
  } catch (err) {
    next(err);
  }
});

app.delete("/api/products/:id", authenticateToken, async (req, res, next) => {
  try {
    const check = await pool.query(
      "SELECT store_id FROM products WHERE id = $1",
      [req.params.id],
    );
    if (check.rows.length === 0 || check.rows[0].store_id !== req.user.id)
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
    is_public_market,
    province_id,
  } = req.body;
  const storeId = req.user.id;

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
    province_id !== undefined &&
    province_id !== null &&
    province_id !== "" &&
    !UUID_REGEX.test(String(province_id))
  ) {
    return res.status(400).json({ error: "Provincia no válida" });
  }

  try {
    const query = `
      UPDATE stores 
      SET name = $1, description = $2, logo_url = $3, whatsapp = $4, is_public_market = $5, province_id = $6
      WHERE id = $7
      RETURNING ${SAFE_STORE_COLUMNS};
    `;
    const values = [
      name,
      description,
      logoUrl,
      normalizedWhatsapp,
      is_public_market,
      province_id === "" ? null : province_id || null,
      storeId,
    ];
    const result = await pool.query(query, values);
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Tienda no encontrada" });

    res.json(result.rows[0]);
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
        (SELECT COUNT(*) FROM stores) as total_stores, 
        (SELECT COUNT(*) FROM products) as total_products,
        (SELECT COUNT(*) FROM activation_codes WHERE status = 'active') as available_licenses
    `);
    const stores = await pool.query(
      `SELECT id, name, slug, whatsapp, owner_name, is_suspended, whatsapp_clicks, created_at, description, is_public_market FROM stores ORDER BY created_at DESC`,
    );
    const codes = await pool.query(
      "SELECT * FROM activation_codes ORDER BY created_at DESC",
    );
    res.json({ stats: stats.rows[0], stores: stores.rows, codes: codes.rows });
  } catch (err) {
    next(err);
  }
});

// Genera un código aleatorio de 12 caracteres (A-Z, 0-9)
const generateLicenseCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 12; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
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
    const newCode = await pool.query(
      "INSERT INTO activation_codes (code, expires_at) VALUES ($1, $2) RETURNING *",
      [code, expiresAt],
    );
    res.json(newCode.rows[0]);
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
    const result = await pool.query("DELETE FROM activation_codes WHERE id = $1", [
      req.params.id,
    ]);
    if (result.rowCount === 0)
      return res.status(404).json({ error: "Código no encontrado" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

app.put("/api/admin/store/:id/status", authenticateToken, async (req, res, next) => {
  if (req.user.role !== "superadmin")
    return res.status(403).json({ error: "Admin" });
  try {
    const result = await pool.query(
      "UPDATE stores SET is_suspended = $1 WHERE id = $2",
      [req.body.is_suspended, req.params.id],
    );
    if (result.rowCount === 0)
      return res.status(404).json({ error: "Tienda no encontrada" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

app.delete("/api/admin/store/:id", authenticateToken, async (req, res, next) => {
  if (req.user.role !== "superadmin")
    return res.status(403).json({ error: "Admin" });
  try {
    const result = await pool.query("DELETE FROM stores WHERE id = $1", [
      req.params.id,
    ]);
    if (result.rowCount === 0)
      return res.status(404).json({ error: "Tienda no encontrada" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Actualizar contraseña de tienda desde admin
app.put(
  "/api/admin/store/:id/password",
  authenticateToken,
  async (req, res, next) => {
    if (req.user.role !== "superadmin")
      return res.status(403).json({ error: "Admin" });
    if (!req.body.newPassword || String(req.body.newPassword).length < 6)
      return res
        .status(400)
        .json({ error: "La contraseña debe tener al menos 6 caracteres" });
    try {
      const hash = await bcrypt.hash(req.body.newPassword, 10);
      const result = await pool.query(
        "UPDATE stores SET password_hash = $1 WHERE id = $2",
        [hash, req.params.id],
      );
      if (result.rowCount === 0)
        return res.status(404).json({ error: "Tienda no encontrada" });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// Actualizar contacto de tienda desde admin
app.put("/api/admin/store/:id/contact", authenticateToken, async (req, res, next) => {
  if (req.user.role !== "superadmin")
    return res.status(403).json({ error: "Admin" });
  try {
    const result = await pool.query(
      "UPDATE stores SET whatsapp = $1 WHERE id = $2",
      [req.body.whatsapp, req.params.id],
    );
    if (result.rowCount === 0)
      return res.status(404).json({ error: "Tienda no encontrada" });
    res.json({ success: true });
  } catch (err) {
    if (err.code === "23505")
      return res.status(400).json({ error: "Número en uso" });
    next(err);
  }
});

app.put("/api/admin/password", authenticateToken, async (req, res, next) => {
  if (req.user.role !== "superadmin")
    return res.status(403).json({ error: "Admin" });
  if (!req.body.password || req.body.password.length < 6)
    return res.status(400).json({ error: "Contraseña corta" });
  try {
    const hash = await bcrypt.hash(req.body.password, 10);
    const result = await pool.query(
      "UPDATE admin_config SET value = $1 WHERE key = 'super_admin_hash'",
      [hash],
    );
    if (result.rowCount === 0)
      return res.status(404).json({ error: "Configuración no encontrada" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// NUEVO: Actualizar Contacto de Soporte del SuperAdmin
app.put("/api/admin/config/contact", authenticateToken, async (req, res, next) => {
  if (req.user.role !== "superadmin")
    return res.status(403).json({ error: "Admin" });
  const { whatsapp } = req.body;
  if (!whatsapp) return res.status(400).json({ error: "Número requerido" });

  try {
    await pool.query(
      `INSERT INTO admin_config (key, value) VALUES ('super_admin_whatsapp', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [whatsapp],
    );
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
    const query = `
      SELECT 
        p.id, p.name, p.price_cup, p.price_usd, p.image_url, p.category, p.stock, p.description,
        s.name as store_name, s.whatsapp as store_whatsapp, s.slug as store_slug,
        prov.name as store_province
      FROM products p
      JOIN stores s ON p.store_id = s.id
      JOIN provinces prov ON s.province_id = prov.id
      WHERE (s.is_public_market = true OR s.is_public_market::text = 'true') 
        AND (s.is_suspended = false OR s.is_suspended::text = 'false')
        AND (p.is_visible = true OR p.is_visible::text = 'true')
        AND s.province_id = $1  -- <--- AQUÍ ESTÁ EL FILTRO MÁGICO
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3;
    `;
    const result = await pool.query(query, [id, limit, offset]);
    res.json(result.rows);
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
