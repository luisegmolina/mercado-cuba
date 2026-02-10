require("dotenv").config();
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

// Usamos la misma conexión que tu servidor
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});

async function resetPass() {
  const newPass = "jefecuba2026";

  console.log("⏳ Generando nueva seguridad...");

  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPass, salt);

    // Asegurar que la tabla existe
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_config (
        key VARCHAR(50) PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Intentar actualizar
    const updateRes = await pool.query(
      "UPDATE admin_config SET value = $1 WHERE key = 'super_admin_hash'",
      [hash],
    );

    // Si no actualizó nada (estaba vacía), insertar
    if (updateRes.rowCount === 0) {
      await pool.query(
        "INSERT INTO admin_config (key, value) VALUES ('super_admin_hash', $1)",
        [hash],
      );
      console.log("✅ Contraseña CREADA exitosamente.");
    } else {
      console.log("✅ Contraseña ACTUALIZADA exitosamente.");
    }

    console.log(`🔐 Tu clave SuperAdmin es: ${newPass}`);
  } catch (err) {
    console.error("❌ Error grave:", err.message);
    if (err.message.includes("permission denied")) {
      console.log(
        "⚠️ PISTA: Parece un problema de permisos. Ejecuta los comandos GRANT en tu terminal SQL.",
      );
    }
  } finally {
    pool.end();
  }
}

resetPass();
