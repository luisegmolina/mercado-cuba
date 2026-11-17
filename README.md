# Mercado Cuba

Marketplace web para comprar y vender en Cuba: las tiendas publican
productos con precio en CUP y USD, y los pedidos se cierran por
WhatsApp. También existe como app Android (Capacitor, paquete
`com.luis.mercadocuba`).

- Web: https://mercado-cuba.onrender.com
- API: https://mercado-backend-o8vl.onrender.com/api
- Política de privacidad: https://mercado-cuba.onrender.com/privacidad

## Stack

- Frontend: React 19 + react-router-dom 7 (Create React App), Tailwind.
- Backend: Node + Express 5 (`server.js`), PostgreSQL (`pg`).
- Auth: JWT (HS256) + bcrypt. Contraseña mínima de 10 caracteres.
- El `postbuild` genera una página por tienda con etiquetas Open Graph
  (`scripts/prerender-stores.js`) para la vista previa de WhatsApp.

## Servicios

| Servicio | Para qué |
| --- | --- |
| Render (plan gratis) | Alojamiento de la web (Static Site) y del backend (Web Service `mercado-backend-o8vl`). El plan gratis duerme el backend a los 15 min sin tráfico; un keep-alive externo lo mantiene despierto. |
| Neon (plan gratis) | Base de datos PostgreSQL (`mercado_cuba`). El esquema canónico está en `schema.sql`. |
| Cloudinary | Fotos de productos, logo y portada de las tiendas (preset sin firmar `mercado-cuba`). |
| API de elTOQUE | Tasas USD/EUR/MLC del mercado informal, actualizadas solas cada hora. CAD/MXN/ZELLE/CLA se ponen a mano desde el panel admin. |
| GitHub | Código. Cada push a `main` despliega solo la web y el backend en Render. |
| WhatsApp | Los pedidos y el contacto con cada tienda van por wa.me; la web no cobra ni procesa pagos. |
| Mega | Carpeta con el APK para descargar en Cuba (la web enlaza a ella desde la portada). |
| Cloudflare Pages | Solo redirige `mercado-cuba.pages.dev` a la web de Render. Cloudflare bloquea Cuba, por eso la web vive en Render. |

## Variables de entorno (backend, en Render)

| Variable | Qué es |
| --- | --- |
| `DATABASE_URL` | Cadena de conexión de Neon (pooled). |
| `DB_SSL` | `true`. |
| `JWT_SECRET` | Secreto para firmar los tokens. Rotarlo cierra todas las sesiones. |
| `SUPER_ADMIN_PASS` | Contraseña inicial del súper admin (solo se usa si la tabla `admins` está vacía; después se cambia desde el panel). |
| `ELTOQUE_API_KEY` | Clave de la API de tasas de elTOQUE. Sin ella, las tasas quedan en el último valor guardado o en lo que ponga el admin. |
| `ELTOQUE_ORIGIN` | Origen registrado en elTOQUE para la clave. Por defecto `https://mercado-cuba.pages.dev`. |
| `NODE_VERSION` | `20` (definida en `render.yaml`). |

El frontend no usa variables: la URL de la API es una sola constante
(`API_URL` en `src/shared.js`, importada por App.js y Marketplace.js).
Ojo: en desarrollo local el frontend también apunta a la API de
producción; no hay API local salvo que se levante el backend a mano y
se cambie esa constante temporalmente (sin commitear el cambio).

## Desarrollo local

```bash
npm install
npm start                 # backend (node server.js) en http://localhost:3001
npx react-scripts start   # frontend en http://localhost:3000
```

Pruebas (helpers de teléfono y precios):

```bash
CI=true npm test -- --watchAll=false
```

Build de producción (con `CI=true` los avisos de ESLint son errores):

```bash
CI=true npm run build
```

## Despliegue

Push a `main` → Render reconstruye y despliega la web y el backend
(~2 min). Comprobar el estado con `GET /api/health` (`{"ok":true}`) y
que la web sirva el nuevo paquete. `render.yaml` es solo la
declaración del servicio; el `healthCheckPath` es `/api/health`.

## App Android

```bash
npm run build
npx cap sync android
# en android/: ./gradlew bundleRelease  (JDK 21; el keystore vive
# fuera del repo, en la máquina que firma)
```

La app carga la web en vivo, así que los cambios web no necesitan
nueva versión. Solo un cambio de `capacitor.config.ts` o de plugins
exige reconstruirla.
