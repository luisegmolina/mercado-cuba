import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";

// Foto de Cuba para el hero y como fondo por defecto de las tiendas:
// La Habana desde el Malecón (Wikimedia Commons, licencia libre).
export const CUBA_HERO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Havana_view.jpg/960px-Havana_view.jpg";

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

export const priceLabel = (p) => {
  const parts = [
    formatPrice(p.price_cup, "CUP"),
    formatPrice(p.price_usd, "USD"),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Precio a consultar";
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
export const PhotoUploader = ({
  images = [],
  onChange,
  max = 3,
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
          onClick={() => cameraRef.current?.click()}
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
export const ProductDetailModal = ({ product, store, onClose }) => {
  const navigate = useNavigate();
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
            <h2 className="font-display text-xl font-extrabold text-slate-900 leading-snug">
              {cleanName(product.name)}
            </h2>
            <p className="text-lg font-black bg-gradient-to-r from-cyan-600 to-teal-500 bg-clip-text text-transparent">
              {priceLabel(product)}
            </p>
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
              <p className="text-xs text-slate-500 flex items-center gap-1 pt-1">
                <Store size={12} className="shrink-0" /> {storeName}
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
                    onClose();
                    navigate(`/${storeSlug}`);
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
