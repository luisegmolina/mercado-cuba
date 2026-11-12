import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShoppingBag,
  Store,
  MessageCircle,
  ChevronLeft,
  Search,
  ImageIcon,
  Loader2,
  MapPin,
  Globe,
  AlertCircle,
} from "lucide-react";
import {
  parseImages,
  formatPrice,
  priceLabel,
  waLink,
  orderMessage,
  ProductDetailModal,
} from "./shared";

const API_URL = "https://mercado-backend-o8vl.onrender.com/api";
const PAGE_LIMIT = 20;

const GlobalMarketplace = () => {
  const [products, setProducts] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [loading, setLoading] = useState(false); // Empieza en false porque no cargamos productos aun
  const [initialLoading, setInitialLoading] = useState(true); // Solo para cargar la lista de provincias
  // "provinces" | "products" | null
  const [loadError, setLoadError] = useState(null);
  // Paginación: se cargan de 20 en 20 con "Cargar más".
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [detailProduct, setDetailProduct] = useState(null);

  // Estado crucial: Si es null, mostramos el selector. Si tiene ID, mostramos productos.
  // id "all" = todas las provincias (endpoint /public/all-products).
  const [selectedProvince, setSelectedProvince] = useState(null);
  const [filterText, setFilterText] = useState("");

  const navigate = useNavigate();
  const searchTimer = useRef(null);

  // 1. Al inicio, SOLO cargamos la lista de provincias (muy rápido)
  const loadProvinces = async () => {
    setInitialLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`${API_URL}/public/provinces`);
      if (!res.ok) throw new Error("No se pudieron cargar las provincias");
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Respuesta inválida");
      setProvinces(data);
    } catch (err) {
      console.error(err);
      setProvinces([]);
      setLoadError("provinces");
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    loadProvinces();
  }, []);

  // 2. Función para cargar productos cuando el usuario elige provincia.
  // append=false reemplaza la lista (cambio de provincia o de búsqueda);
  // append=true añade la siguiente página ("Cargar más").
  const loadProducts = async (province, startOffset = 0, append = false) => {
    setLoading(true);
    setLoadError(null);
    try {
      const url =
        province.id === "all"
          ? `${API_URL}/public/all-products?limit=${PAGE_LIMIT}&offset=${startOffset}`
          : `${API_URL}/public/products/province/${province.id}?limit=${PAGE_LIMIT}&offset=${startOffset}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("No se pudieron cargar los productos");
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Respuesta inválida");
      setProducts((prev) => (append ? [...prev, ...data] : data));
      setHasMore(data.length >= PAGE_LIMIT);
      setOffset(startOffset + data.length);
    } catch (err) {
      console.error(err);
      if (!append) setProducts([]);
      setLoadError("products");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProvince = (provinceId, provinceName) => {
    const province = { id: provinceId, name: provinceName };
    setSelectedProvince(province);
    setFilterText("");
    setOffset(0);
    setHasMore(false);
    setProducts([]);
    loadProducts(province, 0, false);
  };

  const handleBackToSelector = () => {
    setSelectedProvince(null);
    setProducts([]);
    setFilterText("");
    setLoadError(null);
    setOffset(0);
    setHasMore(false);
  };

  const handleLoadMore = () => {
    if (selectedProvince && !loading) {
      loadProducts(selectedProvince, offset, true);
    }
  };

  // La búsqueda filtra en local lo ya cargado y, con una pausa corta
  // para no pedir a cada tecla, vuelve a cargar desde la primera página.
  const handleSearchChange = (e) => {
    const v = e.target.value;
    setFilterText(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      if (selectedProvince) loadProducts(selectedProvince, 0, false);
    }, 500);
  };

  // Filtrado local (solo busca texto en los productos YA descargados de esa provincia)
  const filtered = (Array.isArray(products) ? products : []).filter(
    (p) =>
      (p.name || "").toLowerCase().includes(filterText.toLowerCase()) ||
      (p.store_name || "").toLowerCase().includes(filterText.toLowerCase()),
  );

  // --- VISTA DE CARGA INICIAL (Solo carga provincias) ---
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-[#070B14] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-sky-400" size={40} />
        <p className="text-slate-400 text-sm font-bold">
          Cargando provincias...
        </p>
      </div>
    );
  }

  // --- VISTA DE ERROR AL CARGAR PROVINCIAS ---
  if (loadError === "provinces" && !selectedProvince) {
    return (
      <div className="min-h-screen bg-[#070B14] text-white p-6 flex flex-col items-center justify-center animate-fade-in">
        <AlertCircle size={48} className="text-red-400 mb-4" />
        <h1 className="font-display text-xl font-bold mb-2">
          No se pudo cargar el mercado
        </h1>
        <p className="text-slate-400 text-sm text-center mb-6">
          Revisa tu conexión e inténtalo de nuevo.
        </p>
        <button
          onClick={loadProvinces}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-glow"
        >
          Reintentar
        </button>
        <button
          onClick={() => navigate("/")}
          className="mt-6 text-slate-500 text-sm flex items-center gap-2 hover:text-white"
        >
          <ChevronLeft size={16} /> Volver al inicio
        </button>
      </div>
    );
  }

  // --- VISTA 1: SELECTOR DE PROVINCIA (Si no ha elegido nada) ---
  if (!selectedProvince) {
    return (
      <div className="min-h-screen bg-[#070B14] relative overflow-hidden text-white p-6 flex flex-col items-center justify-center animate-fade-in">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.3),transparent_60%)]"
        />
        <div className="relative mb-8 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-[1.75rem] flex items-center justify-center mx-auto mb-4 text-white shadow-glow ring-1 ring-white/20">
            <MapPin size={38} />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">
            ¿Por dónde andas? 🇨🇺
          </h1>
          <p className="text-slate-400">
            Elige tu provincia para ver lo que hay cerca de ti
          </p>
        </div>

        <div className="relative w-full max-w-md space-y-3">
          <button
            onClick={() =>
              handleSelectProvince("all", "Todas las provincias")
            }
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-4 rounded-2xl font-bold transition-all text-sm flex items-center justify-center gap-2 active:scale-95 shadow-glow"
          >
            <Globe size={18} /> Todas las provincias
          </button>
          <div className="grid grid-cols-2 gap-3">
            {provinces.map((prov) => (
              <button
                key={prov.id}
                onClick={() => handleSelectProvince(prov.id, prov.name)}
                className="bg-white/[0.04] hover:bg-blue-600/20 hover:border-blue-500/50 hover:text-white border border-white/10 text-slate-300 py-4 rounded-2xl font-bold transition-all text-sm flex items-center justify-center gap-2 active:scale-95"
              >
                {prov.name}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => navigate("/")}
          className="relative mt-12 text-slate-500 text-sm flex items-center gap-2 hover:text-white"
        >
          <ChevronLeft size={16} /> Volver al inicio
        </button>
      </div>
    );
  }

  // --- VISTA 2: LISTADO DE PRODUCTOS (Si ya eligió) ---
  return (
    <div className="min-h-screen bg-[#070B14] pb-20 text-white font-sans">
      {/* Header con botón para cambiar ubicación */}
      <div className="sticky top-0 bg-[#070B14]/95 backdrop-blur-md z-30 px-4 py-3 border-b border-white/10 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="p-2 -ml-2 rounded-full hover:bg-white/10 text-slate-400"
          >
            <ChevronLeft />
          </button>
          <div>
            <h1 className="font-display font-extrabold text-lg leading-none">
              Mercado
            </h1>
            <button
              onClick={handleBackToSelector}
              className="text-xs text-sky-400 flex items-center gap-1 mt-1 font-bold hover:underline"
            >
              <MapPin size={10} /> {selectedProvince.name} (Cambiar)
            </button>
          </div>
        </div>
      </div>

      {/* Buscador */}
      <div className="p-4">
        <div className="relative group">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
            size={18}
          />
          <input
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-white/10 bg-white/[0.04] text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 transition-all placeholder:text-slate-500"
            placeholder={`Buscar en ${selectedProvince.name}...`}
            value={filterText}
            onChange={handleSearchChange}
          />
        </div>
      </div>

      {/* Loader de productos */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="animate-spin text-sky-400" size={32} />
          <p className="text-slate-400 text-sm font-bold">
            Cargando productos...
          </p>
        </div>
      ) : loadError === "products" ? (
        <div className="text-center py-20 px-6">
          <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
          <p className="text-sm text-slate-300 mb-4">
            No se pudieron cargar los productos.
          </p>
          <button
            onClick={() => loadProducts(selectedProvince, 0, false)}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-glow"
          >
            Reintentar
          </button>
        </div>
      ) : (
        /* Grid */
        <div className="px-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 animate-fade-in-up max-w-5xl mx-auto w-full">
          {filtered.map((p) => {
            const mainImg = parseImages(p.image_url)[0];
            return (
              <div
                key={p.id}
                onClick={() => setDetailProduct(p)}
                className="group bg-white/[0.04] rounded-3xl overflow-hidden border border-white/10 flex flex-col shadow-xl cursor-pointer transition-all hover:-translate-y-1 hover:shadow-2xl hover:border-white/20 active:scale-[0.98]"
              >
                <div className="aspect-square bg-slate-900 relative overflow-hidden">
                  {mainImg ? (
                    <img
                      src={mainImg}
                      alt={p.name}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="text-slate-700" />
                    </div>
                  )}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/${p.store_slug}`);
                    }}
                    className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <Store size={10} className="text-sky-400 shrink-0" />
                    <span className="text-[11px] font-bold text-white">
                      {p.store_name}
                    </span>
                  </div>
                </div>

                <div className="p-3 flex-1 flex flex-col gap-1">
                  <h3 className="text-sm font-bold text-slate-100 line-clamp-2 min-h-10">
                    {p.name}
                  </h3>
                  <div className="mt-auto pt-2">
                    <div className="flex flex-wrap gap-1 items-baseline mb-2">
                      {Number(p.price_cup) > 0 && (
                        <span className="text-sky-400 font-black text-sm">
                          {formatPrice(p.price_cup, "CUP")}
                        </span>
                      )}
                      {Number(p.price_usd) > 0 && (
                        <span className="text-emerald-400 font-bold text-[10px] bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-lg ml-auto">
                          {formatPrice(p.price_usd, "USD")}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(
                          waLink(
                            p.store_whatsapp,
                            orderMessage({
                              name: p.name,
                              prices: priceLabel(p),
                              storeName: p.store_name,
                              province:
                                p.store_province ||
                                (selectedProvince.id !== "all"
                                  ? selectedProvince.name
                                  : ""),
                              slug: p.store_slug,
                            }),
                          ),
                          "_blank",
                        );
                      }}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 py-2.5 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-2 shadow-glow"
                    >
                      <MessageCircle size={12} /> Pedir
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && loadError !== "products" && filtered.length === 0 && (
        <div className="text-center py-20 opacity-50 px-6">
          <ShoppingBag size={48} className="mx-auto mb-4 text-gray-600" />
          <p className="text-sm">
            {filterText ? (
              <>
                No encontramos eso por aquí, prueba con otra palabra o{" "}
                <button
                  onClick={handleBackToSelector}
                  className="text-blue-400 underline"
                >
                  cambia de provincia
                </button>
                .
              </>
            ) : (
              <>
                No hay productos en{" "}
                <span className="text-blue-400 font-bold">
                  {selectedProvince.name}
                </span>
                .
              </>
            )}
          </p>
          {!filterText && (
            <button
              onClick={handleBackToSelector}
              className="mt-4 text-xs text-blue-400 underline"
            >
              Cambiar provincia
            </button>
          )}
        </div>
      )}

      {!loading && loadError !== "products" && filtered.length > 0 && (
        <div className="px-4 mt-6 text-center space-y-3 max-w-5xl mx-auto">
          <p className="text-xs text-slate-500">
            Mostrando {filtered.length} productos
          </p>
          {hasMore && (
            <button
              onClick={handleLoadMore}
              className="bg-white/[0.04] text-slate-200 px-6 py-3 rounded-2xl text-sm font-bold border border-white/10 hover:bg-white/10 transition-all"
            >
              Cargar más
            </button>
          )}
        </div>
      )}

      {detailProduct && (
        <ProductDetailModal
          product={detailProduct}
          onClose={() => setDetailProduct(null)}
        />
      )}
    </div>
  );
};

export default GlobalMarketplace;
