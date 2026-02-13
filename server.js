require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
//const path = require("path");

const app = express();
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
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "secreto-cuba-2024";
const DEFAULT_ADMIN_PASS = process.env.SUPER_ADMIN_PASS || "jefecuba2026";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
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

// Inicializar Seguridad Admin y Configuración
const initAdminSecurity = async () => {
  try {
    const client = await pool.connect();
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

    client.release();
  } catch (err) {
    console.error("Error init admin:", err);
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

// --- RUTAS PÚBLICAS ---

// Obtener Configuración Pública (Para que el frontend sepa a qué número mandar mensajes)
app.get("/api/public/config", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT value FROM admin_config WHERE key = 'super_admin_whatsapp'",
    );
    const whatsapp =
      result.rows.length > 0 ? result.rows[0].value : "5350000000";
    res.json({ whatsapp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para obtener la vitrina global
app.get("/api/public/all-products", async (req, res) => {
  try {
    const query = `
      SELECT 
        p.id, p.name, p.price_cup, p.price_usd, p.image_url, 
        s.name as store_name, s.whatsapp as store_whatsapp, s.slug as store_slug,
        prov.name as store_province
      FROM products p
      JOIN stores s ON p.store_id = s.id
      LEFT JOIN provinces prov ON s.province_id = prov.id -- <--- NUEVO JOIN
      WHERE (s.is_public_market = true OR s.is_public_market::text = 'true') 
        AND (s.is_suspended = false OR s.is_suspended::text = 'false')
        AND (p.is_visible = true OR p.is_visible::text = 'true')
      ORDER BY p.id DESC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener el mercado global" });
  }
});

app.get("/api/public/stores", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, logo_url, description, whatsapp FROM stores WHERE is_active = TRUE AND is_suspended = FALSE ORDER BY created_at DESC`,
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/store/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    const isUUID =
      /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/.test(
        identifier,
      );
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
    await pool.query(
      "UPDATE stores SET whatsapp_clicks = whatsapp_clicks + 1 WHERE id = $1",
      [store.id],
    );
    res.json({ store, products: productsRes.rows });
  } catch (err) {
    res.status(500).json({ error: "Error del servidor" });
  }
});

// --- AUTH ---
app.post("/api/login", async (req, res) => {
  const { whatsapp, password } = req.body;
  try {
    const storeRes = await pool.query(
      "SELECT * FROM stores WHERE whatsapp = $1",
      [whatsapp],
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
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/register", async (req, res) => {
  const { name, whatsapp, ownerName, code, password } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const codeRes = await client.query(
      "SELECT * FROM activation_codes WHERE code = $1",
      [code],
    );
    if (codeRes.rows.length === 0)
      throw new Error("Código inválido o ya usado");

    let slug = createSlug(name);
    const checkSlug = await client.query(
      "SELECT id FROM stores WHERE slug = $1",
      [slug],
    );
    if (checkSlug.rows.length > 0)
      slug = `${slug}-${Math.floor(Math.random() * 1000)}`;

    const hash = await bcrypt.hash(password, 10);
    const storeRes = await client.query(
      "INSERT INTO stores (name, slug, whatsapp, owner_name, password_hash) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [name, slug, whatsapp, ownerName, hash],
    );
    const newStore = storeRes.rows[0];

    // Borrar código usado
    await client.query("DELETE FROM activation_codes WHERE id = $1", [
      codeRes.rows[0].id,
    ]);

    await client.query("COMMIT");

    const token = jwt.sign({ id: newStore.id, role: "vendor" }, JWT_SECRET);
    delete newStore.password_hash;
    res.json({ store: newStore, token });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.post("/api/admin/login", async (req, res) => {
  const { password } = req.body;
  try {
    const dbRes = await pool.query(
      "SELECT value FROM admin_config WHERE key = 'super_admin_hash'",
    );
    if (dbRes.rows.length === 0)
      return res.status(500).json({ error: "Error config" });
    if (await bcrypt.compare(password, dbRes.rows[0].value)) {
      const token = jwt.sign({ role: "superadmin" }, JWT_SECRET, {
        expiresIn: "4h",
      });
      res.json({ token });
    } else {
      res.status(401).json({ error: "Inválido" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PRODUCTOS ---
app.post("/api/products", authenticateToken, async (req, res) => {
  if (req.user.role !== "vendor")
    return res.status(403).json({ error: "No autorizado" });

  // CORRECCIÓN: Agregamos is_visible al destructuring y enviamos a la BD.
  const { name, priceCup, priceUsd, category, imageUrl, stock, is_visible } =
    req.body;
  try {
    const newProd = await pool.query(
      "INSERT INTO products (store_id, name, price_cup, price_usd, category, image_url, stock, is_visible) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
      [
        req.user.id,
        name,
        priceCup || 0,
        priceUsd || 0,
        category,
        imageUrl,
        stock,
        is_visible !== undefined ? is_visible : true, // Asegurar que sea true por defecto
      ],
    );
    res.json(newProd.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/products/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
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
      [name, priceCup, priceUsd, category, imageUrl, stock, is_visible, id],
    );
    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/products/:id", authenticateToken, async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/store/settings", authenticateToken, async (req, res) => {
  const {
    name,
    description,
    logoUrl,
    whatsapp,
    is_public_market,
    province_id,
  } = req.body;
  const storeId = req.user.id;

  try {
    const query = `
      UPDATE stores 
      SET name = $1, description = $2, logo_url = $3, whatsapp = $4, is_public_market = $5, province_id = $6
      WHERE id = $7
      RETURNING *;
    `;
    const values = [
      name,
      description,
      logoUrl,
      whatsapp,
      is_public_market,
      province_id,
      storeId,
    ];
    const result = await pool.query(query, values);
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Tienda no encontrada" });

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar la configuración" });
  }
});

app.get("/api/public/provinces", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM provinces ORDER BY name ASC",
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener provincias" });
  }
});

// --- ADMIN ROUTES ---
app.get("/api/admin/dashboard", authenticateToken, async (req, res) => {
  if (req.user.role !== "superadmin")
    return res.status(403).json({ error: "Requiere SuperAdmin" });
  try {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM stores) as total_stores, 
        (SELECT COUNT(*) FROM products) as total_products,
        (SELECT COUNT(*) FROM activation_codes) as available_licenses
    `);
    const stores = await pool.query(
      `SELECT id, name, slug, whatsapp, owner_name, is_suspended, whatsapp_clicks, created_at, description, is_public_market FROM stores ORDER BY created_at DESC`,
    );
    const codes = await pool.query(
      "SELECT * FROM activation_codes ORDER BY created_at DESC",
    );
    res.json({ stats: stats.rows[0], stores: stores.rows, codes: codes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/codes", authenticateToken, async (req, res) => {
  if (req.user.role !== "superadmin")
    return res.status(403).json({ error: "Admin" });
  try {
    const newCode = await pool.query(
      "INSERT INTO activation_codes (code) VALUES ($1) RETURNING *",
      [req.body.code],
    );
    res.json(newCode.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/admin/codes/:id", authenticateToken, async (req, res) => {
  if (req.user.role !== "superadmin")
    return res.status(403).json({ error: "Admin" });
  try {
    await pool.query("DELETE FROM activation_codes WHERE id = $1", [
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/admin/store/:id/status", authenticateToken, async (req, res) => {
  if (req.user.role !== "superadmin")
    return res.status(403).json({ error: "Admin" });
  try {
    await pool.query("UPDATE stores SET is_suspended = $1 WHERE id = $2", [
      req.body.is_suspended,
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/admin/store/:id", authenticateToken, async (req, res) => {
  if (req.user.role !== "superadmin")
    return res.status(403).json({ error: "Admin" });
  try {
    await pool.query("DELETE FROM stores WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar contraseña de tienda desde admin
app.put(
  "/api/admin/store/:id/password",
  authenticateToken,
  async (req, res) => {
    if (req.user.role !== "superadmin")
      return res.status(403).json({ error: "Admin" });
    try {
      const hash = await bcrypt.hash(req.body.newPassword, 10);
      await pool.query("UPDATE stores SET password_hash = $1 WHERE id = $2", [
        hash,
        req.params.id,
      ]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// Actualizar contacto de tienda desde admin
app.put("/api/admin/store/:id/contact", authenticateToken, async (req, res) => {
  if (req.user.role !== "superadmin")
    return res.status(403).json({ error: "Admin" });
  try {
    await pool.query("UPDATE stores SET whatsapp = $1 WHERE id = $2", [
      req.body.whatsapp,
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (err) {
    if (err.code === "23505")
      return res.status(400).json({ error: "Número en uso" });
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/admin/password", authenticateToken, async (req, res) => {
  if (req.user.role !== "superadmin")
    return res.status(403).json({ error: "Admin" });
  if (!req.body.password || req.body.password.length < 6)
    return res.status(400).json({ error: "Contraseña corta" });
  try {
    const hash = await bcrypt.hash(req.body.password, 10);
    await pool.query(
      "UPDATE admin_config SET value = $1 WHERE key = 'super_admin_hash'",
      [hash],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// NUEVO: Actualizar Contacto de Soporte del SuperAdmin
app.put("/api/admin/config/contact", authenticateToken, async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// Endpoint OPTIMIZADO: Busca productos SOLO de una provincia específica
app.get("/api/public/products/province/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const query = `
      SELECT 
        p.id, p.name, p.price_cup, p.price_usd, p.image_url, 
        s.name as store_name, s.whatsapp as store_whatsapp, s.slug as store_slug,
        prov.name as store_province
      FROM products p
      JOIN stores s ON p.store_id = s.id
      JOIN provinces prov ON s.province_id = prov.id
      WHERE (s.is_public_market = true OR s.is_public_market::text = 'true') 
        AND (s.is_suspended = false OR s.is_suspended::text = 'false')
        AND (p.is_visible = true OR p.is_visible::text = 'true')
        AND s.province_id = $1  -- <--- AQUÍ ESTÁ EL FILTRO MÁGICO
      ORDER BY p.id DESC;
    `;
    const result = await pool.query(query, [id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener productos por provincia" });
  }
});

app.listen(PORT, () => console.log(`Backend CubaMarket en puerto ${PORT}`));
