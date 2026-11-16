import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import {
  X,
  MessageCircle,
  Store,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Image as ImageIcon,
  Camera,
  ImagePlus,
  Loader2,
  Heart,
  Star,
  BadgeCheck,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import {
  Camera as CapacitorCamera,
  CameraResultType,
  CameraSource,
} from "@capacitor/camera";

// Foto de Cuba para el hero y como fondo por defecto de las tiendas:
// La Habana desde el Malecón (Wikimedia Commons, licencia libre).
export const CUBA_HERO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Havana_view.jpg/960px-Havana_view.jpg";

// Fotos del hero de la portada: una al azar en cada visita.
// Todas de Wikimedia Commons (licencia libre: CC0, CC BY o CC BY-SA);
// los archivos viven en public/hero-*.jpg y se sirven desde la web.
export const HERO_IMAGES = [
  "/hero-habana.jpg",
  "/hero-malecon.jpg",
  "/hero-trinidad.jpg",
  "/hero-vinales.jpg",
  "/hero-varadero.jpg",
  "/hero-capitolio.jpg",
];

// Elige una foto al azar, distinta a la de la visita anterior (si la hay).
export const pickRandomHero = () => {
  let prev = -1;
  try {
    prev = Number(sessionStorage.getItem("heroIdx"));
  } catch {}
  let idx = Math.floor(Math.random() * HERO_IMAGES.length);
  if (HERO_IMAGES.length > 1 && idx === prev)
    idx = (idx + 1) % HERO_IMAGES.length;
  try {
    sessionStorage.setItem("heroIdx", String(idx));
  } catch {}
  return HERO_IMAGES[idx];
};

// --- CLOUDINARY (subida de fotos desde el celular / cámara) ---
// El vendedor sube la foto desde el teléfono y Cloudinary devuelve el
// enlace, que es lo que se guarda en la base (product_images). La subida
// va directa del teléfono a Cloudinary: no pasa por el backend.
// VALORES PROVISIONALES: hay que crear la cuenta gratuita de Cloudinary
// y rellenar el cloud name y el upload preset (unsigned, carpeta
// "mercado-cuba") antes de probar la subida. Mientras sigan como
// "RELLENAR_...", uploadImage avisa con un mensaje claro en vez de fallar.
export const CLOUDINARY_CLOUD_NAME = "fzeuvndq";
export const CLOUDINARY_UPLOAD_PRESET = "mercado-cuba";
export const CLOUDINARY_FOLDER = "mercado-cuba";
export const MAX_PHOTO_SIZE_MB = 5;

export const isCloudinaryConfigured = () =>
  !!CLOUDINARY_CLOUD_NAME &&
  !CLOUDINARY_CLOUD_NAME.startsWith("RELLENAR") &&
  !!CLOUDINARY_UPLOAD_PRESET &&
  !CLOUDINARY_UPLOAD_PRESET.startsWith("RELLENAR");

// Sube una foto a Cloudinary y devuelve su enlace seguro (https).
export const uploadImage = async (file) => {
  if (!file) throw new Error("No elegiste ninguna foto.");
  if (!file.type || !file.type.startsWith("image/"))
    throw new Error("Ese archivo no es una foto. Elige una imagen.");
  if (file.size > MAX_PHOTO_SIZE_MB * 1024 * 1024)
    throw new Error(
      `La foto pesa más de ${MAX_PHOTO_SIZE_MB} MB. Elige una foto más liviana.`,
    );
  if (!isCloudinaryConfigured())
    throw new Error(
      "La subida de fotos aún no está configurada. Avísale al administrador.",
    );
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  form.append("folder", CLOUDINARY_FOLDER);
  let res;
  try {
    res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: "POST", body: form },
    );
  } catch (e) {
    throw new Error(
      "No hay conexión para subir la foto. Revisa el internet e inténtalo de nuevo.",
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.secure_url)
    throw new Error(
      (data && data.error && data.error.message) ||
        "No se pudo subir la foto. Inténtalo de nuevo.",
    );
  return data.secure_url;
};

// --- TELÉFONOS ---
// Normaliza un número a dígitos con código de país:
// Cuba (8 dígitos) -> "53" + número; EEUU (10 dígitos) -> "1" + número;
// si ya trae el código de país, se deja tal cual.
export const normalizePhone = (raw) => {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("53") && d.length === 10) return d;
  if (d.length === 8) return "53" + d;
  if (d.startsWith("1") && d.length === 11) return d;
  if (d.length === 10) return "1" + d;
  return d;
};

// Muestra el número bonito: Cuba "+53 5915 0911", EEUU "+1 (806) 316-8743".
export const formatPhone = (raw) => {
  const d = normalizePhone(raw);
  if (!d) return "";
  if (d.startsWith("53") && d.length === 10)
    return `+53 ${d.slice(2, 6)} ${d.slice(6)}`;
  if (d.startsWith("1") && d.length === 11)
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return `+${d}`;
};

// Enlace de WhatsApp con el número ya normalizado (+53 Cuba, +1 EEUU).
export const waLink = (raw, text) => {
  const base = "https://wa.me/" + normalizePhone(raw);
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
};

// --- PRECIOS ---
// Un solo formato para toda la app: español (2.700 CUP).
// Sin decimales cuando el precio es entero ("2.700 CUP", no "2.700,00 CUP").
export const formatPrice = (value, code) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  const decimals = Number.isInteger(n) ? 0 : 2;
  return (
    n.toLocaleString("es-ES", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: 2,
    }) +
    " " +
    code
  );
};

// Nombres sin espacios al inicio/fin (hay tiendas y productos guardados
// con espacios al final). Para mostrar, nunca para guardar.
export const cleanName = (v) => String(v ?? "").trim();

// Fecha corta en español ("14 nov 2026").
export const formatDateShort = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// --- CATEGORÍAS, DESTACADOS Y FAVORITOS ---
// Lista canónica de categorías en español (la misma que en server.js y
// que devuelve /api/public/categories). El filtro de búsqueda y el
// formulario del vendedor usan esta lista.
export const PRODUCT_CATEGORIES = [
  "Alimentos",
  "Bebidas",
  "Electrodomésticos",
  "Celulares",
  "Ropa y calzado",
  "Hogar",
  "Motos",
  "Belleza",
  "Salud",
  "Ferretería",
  "Juguetes",
  "Otros",
];

// Duraciones de anuncio destacado, como los paquetes de Revolico.
// Los precios se configuran en el panel del súper admin (NULL = sin definir).
export const FEATURED_DURATIONS = [3, 7, 30];

// ¿Sigue vigente el destacado? Solo por fecha (featured_until > ahora),
// sin depender de ningún cron.
export const isFeatured = (p) =>
  !!(
    p &&
    p.featured_until &&
    new Date(p.featured_until).getTime() > Date.now()
  );

// Sello "Destacado" para tarjetas y detalle de producto.
export const FeaturedBadge = () => (
  <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-[11px] font-bold px-2 py-1 rounded-full shadow">
    <Star size={11} className="fill-white text-white" /> Destacado
  </span>
);

// Sello "Vendedor verificado" para la página de la tienda y tarjetas.
export const VerifiedBadge = () => (
  <span className="inline-flex items-center gap-1 bg-cyan-600/10 text-cyan-700 border border-cyan-600/20 text-xs font-bold px-2 py-1 rounded-full">
    <BadgeCheck size={13} /> Vendedor verificado
  </span>
);

// Favoritos: solo ids en localStorage (sin cuenta ni inicio de sesión).
// Al abrir Favoritos se re-consultan los datos por id, así el precio
// que se ve es el actual aunque haya cambiado. Funciona en la web y en
// la APK (el WebView guarda el localStorage del origen pages.dev).
// Si el almacenamiento no está disponible (incógnito, lleno), se
// degrada en silencio y el corazón simplemente no guarda.
export const FAVORITES_KEY = "mc:favorites";
const FAVORITES_EVENT = "mc:favorites-changed";

export const getFavoriteIds = () => {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr)
      ? arr.filter((id) => typeof id === "string")
      : [];
  } catch {
    return [];
  }
};

export const isFavorite = (id) => getFavoriteIds().includes(id);

export const toggleFavorite = (id) => {
  const ids = getFavoriteIds();
  const next = ids.includes(id)
    ? ids.filter((x) => x !== id)
    : [...ids, id];
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  } catch {}
  window.dispatchEvent(
    new CustomEvent(FAVORITES_EVENT, { detail: next }),
  );
  return next;
};

// Hook para leer los favoritos y re-renderizar cuando cambian en
// cualquier tarjeta o en el detalle.
export const useFavorites = () => {
  const [favs, setFavs] = useState(getFavoriteIds);
  useEffect(() => {
    const handler = (e) => setFavs(e.detail || getFavoriteIds());
    window.addEventListener(FAVORITES_EVENT, handler);
    return () => window.removeEventListener(FAVORITES_EVENT, handler);
  }, []);
  return [favs, toggleFavorite];
};

// Corazón de favorito para las tarjetas de producto. No abre el detalle:
// el clic se queda en el corazón.
export const FavHeart = ({
  productId,
  className = "absolute top-2 right-2 z-10",
}) => {
  const [favs, toggle] = useFavorites();
  const active = favs.includes(productId);
  return (
    <button
      type="button"
      aria-label={
        active ? "Quitar de favoritos" : "Guardar en favoritos"
      }
      onClick={(e) => {
        e.stopPropagation();
        toggle(productId);
      }}
      className={`${className} bg-white/90 backdrop-blur p-2 rounded-full shadow-md hover:scale-110 active:scale-95 transition-transform`}
    >
      <Heart
        size={18}
        className={
          active ? "fill-rose-500 text-rose-500" : "text-slate-500"
        }
      />
    </button>
  );
};

export const priceLabel = (p) => {
  const parts = [
    formatPrice(p.price_cup, "CUP"),
    formatPrice(p.price_usd, "USD"),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Precio a consultar";
};

// "Actualizado hace X": frescura del anuncio para el comprador.
// El vendedor la refresca con cualquier edición (precio, stock...).
export const timeAgo = (iso) => {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const mins = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (mins < 1) return "ahora mismo";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "hace 1 día";
  return `hace ${days} días`;
};

// --- TASA DE CAMBIO (banner del header) ---
// La tasa la pone el admin desde su panel (fuente: elTOQUE, mercado
// informal). Si no hay tasas guardadas o el servidor no responde, el
// banner no se muestra.
const RATES_API_URL = "https://mercado-backend-o8vl.onrender.com/api";
const ELTOQUE_RATES_URL = "https://eltoque.com/tasas-de-cambio-cuba";

export const RatesBanner = () => {
  const [rates, setRates] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch(`${RATES_API_URL}/public/rates`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && Array.isArray(d.rates) && d.rates.length > 0)
          setRates(d.rates);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  if (!rates) return null;
  const updatedAt = rates[0]?.updated_at;
  // Contenido del ticker (se repite dos veces para el bucle sin salto).
  const tickerContent = (
    <span className="flex items-center gap-x-2 pr-2">
      {rates.map((r) => (
        <span key={r.currency} className="font-mono">
          {r.currency} {formatPrice(r.rate_cup, "CUP")}
        </span>
      ))}
      <span className="text-slate-400">
        · {updatedAt ? `Actualizado ${timeAgo(updatedAt)} · ` : ""}Fuente:
        elTOQUE
      </span>
    </span>
  );
  return (
    <div className="rates-ticker bg-slate-900 text-white px-3 py-1.5 text-xs flex items-center gap-x-2 overflow-hidden">
      <span className="font-bold shrink-0">💵 Tasa informal</span>
      <div className="flex-1 overflow-hidden">
        <div className="rates-ticker-track flex items-center whitespace-nowrap w-max">
          {tickerContent}
          <span aria-hidden="true">{tickerContent}</span>
        </div>
      </div>
      <a
        href={ELTOQUE_RATES_URL}
        target="_blank"
        rel="noreferrer"
        className="underline text-cyan-300 shrink-0"
      >
        Ver en elTOQUE
      </a>
    </div>
  );
};

// Mensaje que le llega al vendedor por WhatsApp: producto, precio,
// tienda, provincia y enlace. Así sabe de qué le hablan.
export const orderMessage = ({ name, prices, storeName, province, slug }) =>
  `Hola, vi en Mercado Cuba: ${name} — ${prices}. Tienda: ${storeName}${province ? ` (${province})` : ""}.${slug ? ` Ver: https://mercado-cuba.pages.dev/${slug}` : ""}`;

// --- IMÁGENES ---
// Normaliza las imágenes que vienen del servidor para que siempre sean un Array manejable por React.
// El backend nuevo devuelve `images` como array de URLs; se acepta también
// el formato viejo (string JSON o URL suelta) por si algún dato viejo lo trae.
// Las data: (base64) ya no existen en el esquema nuevo y se descartan.
export const parseImages = (img) => {
  if (!img) return [];
  if (Array.isArray(img))
    return img.filter(
      (u) => typeof u === "string" && u.startsWith("http"),
    );
  if (typeof img === "string") {
    if (img.startsWith("data:")) return [];
    try {
      const parsed = JSON.parse(img);
      if (Array.isArray(parsed))
        return parsed.filter(
          (u) => typeof u === "string" && u.startsWith("http"),
        );
      return [img];
    } catch (e) {
      return img
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.startsWith("http"));
    }
  }
  return [];
};

// Primera foto de una lista de productos: se usa como fondo de la tienda.
export const firstProductImage = (list) => {
  for (const p of Array.isArray(list) ? list : []) {
    const imgs = parseImages(p.images ?? p.image_url);
    if (imgs.length) return imgs[0];
  }
  return "";
};

export const SafeImage = ({
  src,
  className,
  alt = "Foto del producto",
  fallbackIcon: Icon = ImageIcon,
}) => {
  const [error, setError] = useState(false);
  useEffect(() => setError(false), [src]);

  if (!src || error) {
    return (
      <div
        className={`bg-sky-100 flex items-center justify-center border border-sky-100 ${className}`}
      >
        <Icon className="text-slate-600 opacity-50" size="40%" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setError(true)}
      loading="lazy"
    />
  );
};

// --- SUBIDA DE FOTOS (celular / cámara) ---
// Dos botones grandes, pensados para quien sabe lo menos posible:
// "Tomar foto" abre la cámara del teléfono; "Galería" abre las fotos
// guardadas (permite elegir varias). Cada foto se sube a Cloudinary al
// elegirla y se muestra la vista previa. El enlace resultante es lo que
// se guarda en el producto o en el logo.
// Nota: en los navegadores del móvil `capture` se ignora cuando el input
// es `multiple`, por eso la cámara y la galería son dos botones separados
// en vez de un solo input con capture+multiple.
// OJO: en la app instalada el WebView IGNORA `capture` siempre (aunque el
// input no sea multiple) y abre la galería; por eso "Tomar foto" usa la
// cámara nativa del plugin en la app y el input solo en la web.
export const PhotoUploader = ({
  images = [],
  onChange,
  max = 5,
  single = false,
  label = "Fotos",
}) => {
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState("");
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const limit = single ? 1 : max;

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const room = limit - images.length;
    if (room <= 0) {
      setError(
        single
          ? "Ya tienes una foto. Quítala primero si quieres cambiarla."
          : `Máximo ${limit} fotos por producto.`,
      );
      return;
    }
    const toUpload = files.slice(0, room);
    if (files.length > room)
      setError(`Solo se pueden añadir ${room} más (máx. ${limit}).`);
    else setError("");
    setUploading((n) => n + toUpload.length);
    const urls = [];
    for (const f of toUpload) {
      try {
        urls.push(await uploadImage(f));
      } catch (e) {
        setError(e.message || "No se pudo subir la foto. Inténtalo de nuevo.");
      }
    }
    setUploading((n) => n - toUpload.length);
    if (urls.length) onChange([...images, ...urls]);
  };

  const removeAt = (i) => {
    setError("");
    onChange(images.filter((_, idx) => idx !== i));
  };

  // "Tomar foto": en la app instalada abre la cámara nativa (el WebView
  // ignora el capture del input y abriría la galería); en la web usa el
  // input con capture, que ahí sí abre la cámara.
  const takePhoto = async () => {
    if (!Capacitor.isNativePlatform()) {
      cameraRef.current?.click();
      return;
    }
    try {
      const photo = await CapacitorCamera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        saveToGallery: false,
      });
      if (!photo.dataUrl) return;
      const blob = await (await fetch(photo.dataUrl)).blob();
      const file = new File([blob], `foto-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      await handleFiles([file]);
    } catch (e) {
      const msg = String((e && e.message) || "");
      // Cerrar la cámara sin tomar foto no es un error.
      if (/cancel/i.test(msg)) return;
      // APK viejo sin el plugin instalado: vuelve al input (galería).
      if (/not implemented/i.test(msg)) {
        cameraRef.current?.click();
        return;
      }
      setError("No se pudo abrir la cámara. Inténtalo de nuevo.");
    }
  };

  const disabled = uploading > 0 || images.length >= limit;

  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
        {label} (máx. {limit})
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={takePhoto}
          className="flex-1 bg-cyan-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-cyan-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Camera size={18} /> Tomar foto
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => galleryRef.current?.click()}
          className="flex-1 bg-sky-100 border border-slate-200 text-slate-900 py-3 rounded-xl text-sm font-bold hover:bg-sky-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <ImagePlus size={18} /> Galería
        </button>
      </div>
      {/* La cámara abre la cámara; la galería abre las fotos guardadas. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple={!single}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {uploading > 0 && (
        <p className="text-xs text-cyan-700 font-bold mt-2 flex items-center gap-1">
          <Loader2 size={14} className="animate-spin" /> Subiendo foto
          {uploading > 1 ? "s" : ""}...
        </p>
      )}
      {error && <p className="text-xs text-rose-600 font-bold mt-2">{error}</p>}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mt-3">
          {images.map((url, i) => (
            <div
              key={i}
              className="aspect-square bg-sky-50 rounded-xl overflow-hidden relative"
            >
              <SafeImage src={url} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute top-1 right-1 bg-rose-600 rounded-full p-1 text-white"
                aria-label="Quitar foto"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- VISTA DE PRODUCTO ---
// Modal a pantalla completa en el móvil para ver UN producto con
// todas sus fotos, precio, tienda y el botón de pedir.
// --- NAVEGACIÓN ATRÁS (un paso cada vez) ---
// React Router guarda el índice del historial en window.history.state.idx:
// 0 = primera página de la pestaña (enlace directo), >0 = hay a dónde volver.
// Atrás de un paso: si hay historial, vuelve un paso (igual que el botón
// del teléfono); si no hay, va a la vista padre sin dejar un callejón
// sin salida (replace, para que atrás desde ahí salga de la app y no
// vuelva a la misma página).
export function useGoBack(fallback = "/") {
  const navigate = useNavigate();
  return useCallback(() => {
    const idx =
      window.history.state && window.history.state.idx;
    if (typeof idx === "number" && idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  }, [navigate, fallback]);
}

// Cierra un detalle abierto por URL (?producto=): atrás si hay historial,
// si no quita el parámetro sin salir de la página.
export function useCloseDetail() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  return useCallback(() => {
    const idx =
      window.history.state && window.history.state.idx;
    if (typeof idx === "number" && idx > 0) {
      navigate(-1);
    } else {
      const next = new URLSearchParams(searchParams);
      next.delete("producto");
      setSearchParams(next, { replace: true });
    }
  }, [navigate, searchParams, setSearchParams]);
}

export const ProductDetailModal = ({ product, store, onClose }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const imgs = parseImages(product.images ?? product.image_url);
  const [idx, setIdx] = useState(0);

  useEffect(() => setIdx(0), [product?.id]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!product) return null;

  const storeName = product.store_name || store?.name || "";
  const storeWhatsapp = product.store_whatsapp || store?.whatsapp || "";
  const storeSlug = product.store_slug || store?.slug || "";
  const province =
    product.store_province || store?.province_name || store?.province || "";
  const stock = product.stock;
  const isOut = Number(stock) === 0;
  const prev = () => setIdx((i) => (i - 1 + imgs.length) % imgs.length);
  const next = () => setIdx((i) => (i + 1) % imgs.length);

  return (
    <div
      className="fixed inset-0 z-[70] bg-sky-950/70 backdrop-blur-sm overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div className="min-h-full flex items-start sm:items-center justify-center sm:p-4">
        <div
          className="bg-white w-full max-w-md sm:rounded-[2rem] overflow-hidden ring-1 ring-slate-200 shadow-2xl my-0 sm:my-8"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Galería */}
          <div className="relative bg-sky-50">
            <div className="aspect-square overflow-hidden">
              <SafeImage
                src={imgs[idx]}
                alt={cleanName(product.name)}
                className="w-full h-full object-cover"
              />
            </div>
            <button
              onClick={onClose}
              className="absolute top-2 left-2 bg-black/60 text-white p-2 rounded-full hover:bg-sky-950/60 backdrop-blur"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
            {imgs.length > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 text-white p-2 rounded-full hover:bg-sky-950/60 backdrop-blur"
                  aria-label="Foto anterior"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={next}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 text-white p-2 rounded-full hover:bg-sky-950/60 backdrop-blur"
                  aria-label="Foto siguiente"
                >
                  <ChevronRight size={20} />
                </button>
                <span className="absolute top-2 right-2 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-full backdrop-blur">
                  {idx + 1} / {imgs.length}
                </span>
              </>
            )}
          </div>
          {imgs.length > 1 && (
            <div className="flex gap-2 p-3 overflow-x-auto bg-sky-50">
              {imgs.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={`w-16 h-16 shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
                    i === idx
                      ? "border-cyan-500 ring-2 ring-cyan-500/30"
                      : "border-slate-200"
                  }`}
                >
                  <SafeImage
                    src={src}
                    alt={`${cleanName(product.name)} (${i + 1})`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Datos del producto */}
          <div className="p-5 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-display text-xl font-extrabold text-slate-900 leading-snug">
                {cleanName(product.name)}
              </h2>
              <FavHeart
                productId={product.id}
                className="relative shrink-0 z-10"
              />
            </div>
            {isFeatured(product) && (
              <p>
                <FeaturedBadge />
              </p>
            )}
            <p className="text-lg font-black bg-gradient-to-r from-cyan-600 to-teal-500 bg-clip-text text-transparent">
              {priceLabel(product)}
            </p>
            {product.updated_at && (
              <p className="text-xs text-slate-400">
                Actualizado {timeAgo(product.updated_at)}
              </p>
            )}
            {product.category && (
              <p className="text-xs text-slate-500">
                Categoría: {product.category}
              </p>
            )}
            {stock !== undefined && stock !== null && stock !== "" && (
              <p>
                <span
                  className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full ${
                    Number(stock) === 0
                      ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                      : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                  }`}
                >
                  {Number(stock) === 0
                    ? "Agotado"
                    : Number(stock) <= 5
                      ? `Quedan ${stock}`
                      : "Disponible"}
                </span>
              </p>
            )}
            {product.description && (
              <p className="text-sm text-slate-600 leading-relaxed">
                {product.description}
              </p>
            )}
            {storeName && (
              <p className="text-xs text-slate-500 flex flex-wrap items-center gap-1 pt-1">
                <Store size={12} className="shrink-0" /> {storeName}
                {(product.store_verified || store?.is_verified) && (
                  <span className="inline-flex items-center gap-0.5 text-cyan-700 font-bold">
                    <BadgeCheck size={12} /> Verificado
                  </span>
                )}
                {province && (
                  <>
                    {" "}
                    · <MapPin size={12} className="shrink-0" /> {province}
                  </>
                )}
              </p>
            )}
            <div className="pt-3 space-y-2">
              {storeWhatsapp &&
                (isOut ? (
                  <button
                    disabled
                    className="w-full bg-slate-100 border border-slate-200 text-slate-500 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
                  >
                    Agotado
                  </button>
                ) : (
                  <a
                    href={waLink(
                      storeWhatsapp,
                      orderMessage({
                        name: product.name,
                        prices: priceLabel(product),
                        storeName,
                        province,
                        slug: storeSlug,
                      }),
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white py-3.5 rounded-2xl text-sm font-bold hover:from-emerald-400 hover:to-green-500 transition-all flex items-center justify-center gap-2 shadow-glow-green"
                  >
                    <MessageCircle size={18} /> Pedir por WhatsApp
                  </a>
                ))}
              {storeSlug && (
                <button
                  onClick={() => {
                    // Si ya estamos en esa tienda, solo cierra el detalle;
                    // si no, ir a la tienda es un paso nuevo del historial
                    // (atrás desde la tienda vuelve a este detalle).
                    if (pathname.replace(/\/$/, "") === `/${storeSlug}`)
                      onClose();
                    else navigate(`/${storeSlug}`);
                  }}
                  className="w-full bg-sky-50 border border-slate-200 text-slate-900 py-3 rounded-2xl text-sm font-bold hover:bg-sky-100 transition-all flex items-center justify-center gap-2"
                >
                  <Store size={16} /> Ver tienda
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
