import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  MessageCircle,
  Store,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Image as ImageIcon,
} from "lucide-react";

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
// Un solo formato para toda la app: español (2.000,00 CUP).
export const formatPrice = (value, code) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return (
    n.toLocaleString("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) +
    " " +
    code
  );
};

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
export const parseImages = (imgStr) => {
  if (!imgStr) return [];
  if (Array.isArray(imgStr)) return imgStr;
  try {
    const parsed = JSON.parse(imgStr);
    if (Array.isArray(parsed)) return parsed;
    return [imgStr];
  } catch (e) {
    if (typeof imgStr === "string") {
      if (imgStr.startsWith("data:image")) return [imgStr];
      return imgStr
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s);
    }
    return [];
  }
};

export const SafeImage = ({ src, className, fallbackIcon: Icon = ImageIcon }) => {
  const [error, setError] = useState(false);
  useEffect(() => setError(false), [src]);

  if (!src || error) {
    return (
      <div
        className={`bg-gray-800 flex items-center justify-center border border-gray-700 ${className}`}
      >
        <Icon className="text-gray-600 opacity-50" size="40%" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt="img"
      className={className}
      onError={() => setError(true)}
      loading="lazy"
    />
  );
};

// --- VISTA DE PRODUCTO ---
// Modal a pantalla completa en el móvil para ver UN producto con
// todas sus fotos, precio, tienda y el botón de pedir.
export const ProductDetailModal = ({ product, store, onClose }) => {
  const navigate = useNavigate();
  const imgs = parseImages(product.image_url);
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
  const prev = () => setIdx((i) => (i - 1 + imgs.length) % imgs.length);
  const next = () => setIdx((i) => (i + 1) % imgs.length);

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div className="min-h-full flex items-start sm:items-center justify-center sm:p-4">
        <div
          className="bg-gray-800 w-full max-w-md sm:rounded-2xl overflow-hidden border border-gray-700 shadow-2xl my-0 sm:my-8"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Galería */}
          <div className="relative bg-gray-900">
            <div className="aspect-square overflow-hidden">
              <SafeImage
                src={imgs[idx]}
                className="w-full h-full object-cover"
              />
            </div>
            <button
              onClick={onClose}
              className="absolute top-2 left-2 bg-black/60 text-white p-2 rounded-full hover:bg-black/80"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
            {imgs.length > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 text-white p-2 rounded-full hover:bg-black/80"
                  aria-label="Foto anterior"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={next}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 text-white p-2 rounded-full hover:bg-black/80"
                  aria-label="Foto siguiente"
                >
                  <ChevronRight size={20} />
                </button>
                <span className="absolute top-2 right-2 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {idx + 1} / {imgs.length}
                </span>
              </>
            )}
          </div>
          {imgs.length > 1 && (
            <div className="flex gap-2 p-3 overflow-x-auto bg-gray-900">
              {imgs.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={`w-16 h-16 shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                    i === idx ? "border-blue-500" : "border-gray-700"
                  }`}
                >
                  <SafeImage
                    src={src}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Datos del producto */}
          <div className="p-4 space-y-2">
            <h2 className="text-lg font-black text-white leading-snug">
              {product.name}
            </h2>
            <p className="text-base font-black text-blue-400">
              {priceLabel(product)}
            </p>
            {product.category && (
              <p className="text-xs text-gray-400">
                Categoría: {product.category}
              </p>
            )}
            {stock !== undefined && stock !== null && stock !== "" && (
              <p
                className={`text-xs font-bold ${
                  Number(stock) === 0 ? "text-red-400" : "text-emerald-400"
                }`}
              >
                {Number(stock) === 0
                  ? "Agotado"
                  : Number(stock) <= 5
                    ? `Quedan ${stock}`
                    : "Disponible"}
              </p>
            )}
            {product.description && (
              <p className="text-sm text-gray-300 leading-relaxed">
                {product.description}
              </p>
            )}
            {storeName && (
              <p className="text-xs text-gray-500 flex items-center gap-1 pt-1">
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
              {storeWhatsapp && (
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
                  className="w-full bg-green-600 text-white py-3.5 rounded-xl text-sm font-bold hover:bg-green-500 transition-all flex items-center justify-center gap-2"
                >
                  <MessageCircle size={18} /> Pedir por WhatsApp
                </a>
              )}
              {storeSlug && (
                <button
                  onClick={() => {
                    onClose();
                    navigate(`/${storeSlug}`);
                  }}
                  className="w-full bg-gray-700 text-white py-3 rounded-xl text-sm font-bold hover:bg-gray-600 transition-all flex items-center justify-center gap-2"
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
