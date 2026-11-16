import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  Heart,
  BadgeCheck,
} from "lucide-react";
import {
  parseImages,
  formatPrice,
  priceLabel,
  waLink,
  orderMessage,
  ProductDetailModal,
  cleanName,
  useGoBack,
  useCloseDetail,
  PRODUCT_CATEGORIES,
  FavHeart,
  FeaturedBadge,
  isFeatured,
  useFavorites,
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
  const [totalProducts, setTotalProducts] = useState(null);
  const [stores, setStores] = useState([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [productsLoaded, setProductsLoaded] = useState(false);

  // --- LA VISTA VIVE EN LA URL (cada paso es un paso del historial) ---
  // /explorar = selector de provincia
  // /explorar?provincia=<id> = lista (pestaña Tiendas por defecto)
  //   &vista=productos = pestaña de productos
  //   &vista=favoritos = pestaña de favoritos (guardados en este teléfono)
  //   &municipio=<id> = filtro por municipio (no añade historial)
  //   &categoria=<nombre> = filtro por categoría (no añade historial)
  //   &min=<n>&max=<n>&moneda=cup|usd = rango de precio (no añade historial)
  //   &producto=<id> = detalle del producto
  // Así el botón atrás (flecha o teléfono) retrocede de uno en uno:
  // detalle → lista → selector → inicio.
  const [searchParams, setSearchParams] = useSearchParams();
  const provinciaId = searchParams.get("provincia");
  const vistaParam = searchParams.get("vista");
  const view =
    vistaParam === "productos"
      ? "products"
      : vistaParam === "favoritos"
        ? "favorites"
        : "stores";
  const municipioId = searchParams.get("municipio");
  const productoId = searchParams.get("producto");
  // Filtros de búsqueda de productos (viven en la URL, no añaden historial).
  const categoryFilter = searchParams.get("categoria") || "";
  const minPriceFilter = searchParams.get("min") || "";
  const maxPriceFilter = searchParams.get("max") || "";
  const currencyFilter =
    searchParams.get("moneda") === "usd" ? "usd" : "cup";
  const [favoriteIds] = useFavorites();
  // id "all" = todas las provincias (endpoint /public/all-products).
  const selectedProvince = provinciaId
    ? {
        id: provinciaId,
        name:
          provinciaId === "all"
            ? "Todas las provincias"
            : provinces.find((p) => p.id === provinciaId)?.name || "",
      }
    : null;
  // Municipio dentro de la provincia elegida (null = todos). Solo se
  // muestra cuando la provincia es concreta, no con "Todas".
  const [municipalities, setMunicipalities] = useState([]);
  const selectedMunicipality = municipioId
    ? {
        id: municipioId,
        name: municipalities.find((m) => m.id === municipioId)?.name || "",
      }
    : null;
  const detailProduct = productoId
    ? products.find((p) => p.id === productoId) || null
    : null;
  const [filterText, setFilterText] = useState("");

  const navigate = useNavigate();
  const goBack = useGoBack("/explorar");
  const goHome = useGoBack("/");
  const closeDetail = useCloseDetail();
  const searchTimer = useRef(null);
  // Para no pedir la primera página de productos dos veces en el mismo
  // arranque (el efecto de provincia y el de vista corren juntos).
  const productsKeyRef = useRef("");

  // Cambia parámetros de la URL. push=true (por defecto) crea un paso del
  // historial (vista nueva); push=false reemplaza (filtros, no añaden pasos).
  const updateParams = (patch, push = true) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === null || v === undefined) next.delete(k);
      else next.set(k, v);
    });
    setSearchParams(next, { replace: !push });
  };

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
  // El backend devuelve { items, total } y acepta ?q= (búsqueda en el
  // servidor con trigram), así la búsqueda ya no se limita a lo cargado.
  // Filtros del servidor: categoría, rango de precio (CUP o USD) y municipio.
  const loadProducts = async (
    province,
    startOffset = 0,
    append = false,
    query = filterText,
    municipality = selectedMunicipality,
    filters = {
      category: categoryFilter,
      min: minPriceFilter,
      max: maxPriceFilter,
      currency: currencyFilter,
    },
  ) => {
    setLoading(true);
    setLoadError(null);
    try {
      const q = (query || "").trim();
      const qParam = q ? `&q=${encodeURIComponent(q)}` : "";
      const mParam = municipality ? `&municipality=${municipality.id}` : "";
      const cParam = filters.category
        ? `&category=${encodeURIComponent(filters.category)}`
        : "";
      const priceParam =
        filters.currency === "usd"
          ? `${filters.min !== "" ? `&minUsd=${encodeURIComponent(filters.min)}` : ""}${filters.max !== "" ? `&maxUsd=${encodeURIComponent(filters.max)}` : ""}`
          : `${filters.min !== "" ? `&minCup=${encodeURIComponent(filters.min)}` : ""}${filters.max !== "" ? `&maxCup=${encodeURIComponent(filters.max)}` : ""}`;
      const url =
        province.id === "all"
          ? `${API_URL}/public/all-products?limit=${PAGE_LIMIT}&offset=${startOffset}${qParam}${mParam}${cParam}${priceParam}`
          : `${API_URL}/public/products/province/${province.id}?limit=${PAGE_LIMIT}&offset=${startOffset}${qParam}${mParam}${cParam}${priceParam}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("No se pudieron cargar los productos");
      const data = await res.json();
      const items = Array.isArray(data) ? data : data.items || [];
      const total = Array.isArray(data)
        ? null
        : typeof data.total === "number"
          ? data.total
          : null;
      setProducts((prev) => (append ? [...prev, ...items] : items));
      setTotalProducts(total);
      setHasMore(
        total !== null
          ? startOffset + items.length < total
          : items.length >= PAGE_LIMIT,
      );
      setOffset(startOffset + items.length);
    } catch (err) {
      console.error(err);
      if (!append) setProducts([]);
      setLoadError("products");
    } finally {
      setLoading(false);
    }
  };

  // 3. Cargar tiendas cuando el usuario elige provincia. El backend ya
  // devuelve slug y provincia, así que el filtro por provincia es local.
  const loadStores = async (province) => {
    setStoresLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`${API_URL}/public/stores`);
      if (!res.ok) throw new Error("No se pudieron cargar las tiendas");
      const data = await res.json();
      const all = Array.isArray(data) ? data : data.items || [];
      const list =
        province.id === "all"
          ? all
          : all.filter((s) => s.province_id === province.id);
      // Organizadas por municipio (alfabético; sin municipio al final)
      // y dentro de cada municipio por nombre.
      list.sort((a, b) => {
        const ma = a.municipality_name || "";
        const mb = b.municipality_name || "";
        if (!ma && mb) return 1;
        if (ma && !mb) return -1;
        return (
          ma.localeCompare(mb) || (a.name || "").localeCompare(b.name || "")
        );
      });
      setStores(list);
    } catch (err) {
      console.error(err);
      setStores([]);
      setLoadError("stores");
    } finally {
      setStoresLoading(false);
    }
  };

  // Favoritos: solo ids en localStorage; los datos se re-consultan al
  // servidor (hasta 100 ids por consulta), así el precio que se ve es
  // el actual aunque el vendedor lo haya cambiado.
  const loadFavorites = async (query = filterText) => {
    setLoading(true);
    setLoadError(null);
    try {
      const ids = favoriteIds;
      if (ids.length === 0) {
        setProducts([]);
        setTotalProducts(0);
        setHasMore(false);
        setOffset(0);
        return;
      }
      const q = (query || "").trim();
      const qParam = q ? `&q=${encodeURIComponent(q)}` : "";
      const res = await fetch(
        `${API_URL}/public/all-products?limit=100&offset=0&ids=${ids.map(encodeURIComponent).join(",")}${qParam}`,
      );
      if (!res.ok) throw new Error("No se pudieron cargar los favoritos");
      const data = await res.json();
      const items = Array.isArray(data) ? data : data.items || [];
      setProducts(items);
      setTotalProducts(items.length);
      setHasMore(false);
      setOffset(items.length);
    } catch (err) {
      console.error(err);
      setProducts([]);
      setLoadError("products");
    } finally {
      setLoading(false);
    }
  };

  // Pide la primera página de productos para la URL actual (con el
  // filtro de búsqueda y municipio que haya). La clave evita pedirla dos
  // veces en el mismo arranque.
  const requestProducts = (force = false) => {
    if (!provinciaId) return;
    const key = `${provinciaId}|${view}|${municipioId || ""}|${filterText}|${categoryFilter}|${minPriceFilter}|${maxPriceFilter}|${currencyFilter}|${view === "favorites" ? favoriteIds.join(",") : ""}`;
    if (!force && productsKeyRef.current === key) return;
    productsKeyRef.current = key;
    setProductsLoaded(true);
    if (view === "favorites") {
      loadFavorites(filterText);
      return;
    }
    loadProducts(
      { id: provinciaId },
      0,
      false,
      filterText,
      municipioId ? { id: municipioId } : null,
    );
  };

  // Al cambiar la provincia en la URL: reinicia las listas, carga tiendas
  // (y productos si la URL ya pide esa vista, p. ej. enlace directo).
  useEffect(() => {
    if (!provinciaId) return;
    setStores([]);
    setProducts([]);
    setOffset(0);
    setHasMore(false);
    setTotalProducts(null);
    setProductsLoaded(false);
    productsKeyRef.current = "";
    loadStores({ id: provinciaId });
    if (provinciaId !== "all") loadMunicipalities(provinciaId);
    else setMunicipalities([]);
    if (view === "products" || view === "favorites") requestProducts();
    window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provinciaId]);

  // Al cambiar a la pestaña Productos o Favoritos: carga si aún no.
  useEffect(() => {
    if (
      !provinciaId ||
      (view !== "products" && view !== "favorites") ||
      productsLoaded
    )
      return;
    requestProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Al cambiar el municipio: recarga los productos con el nuevo filtro
  // (solo si la vista de productos ya estaba cargada; el primer arranque
  // lo cubre el efecto de provincia).
  const firstMunicipioRun = useRef(true);
  useEffect(() => {
    if (firstMunicipioRun.current) {
      firstMunicipioRun.current = false;
      return;
    }
    if (!provinciaId || view !== "products" || !productsLoaded) return;
    requestProducts(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [municipioId]);

  // Al cambiar los filtros de búsqueda (categoría, precio, moneda):
  // recarga con 500 ms de espera, para no pedir en cada tecla del precio.
  // El primer arranque lo cubre el efecto de provincia.
  const firstFiltersRun = useRef(true);
  const filtersTimer = useRef(null);
  useEffect(() => {
    if (firstFiltersRun.current) {
      firstFiltersRun.current = false;
      return;
    }
    if (!provinciaId || view !== "products" || !productsLoaded) return;
    if (filtersTimer.current) clearTimeout(filtersTimer.current);
    filtersTimer.current = setTimeout(() => requestProducts(true), 500);
    return () => {
      if (filtersTimer.current) clearTimeout(filtersTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, minPriceFilter, maxPriceFilter, currencyFilter]);

  // Parámetro de producto que no está en lo cargado (enlace directo a una
  // página posterior): quítalo sin añadir historial.
  useEffect(() => {
    if (productoId && productsLoaded && !loading && !detailProduct) {
      updateParams({ producto: null }, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoId, productsLoaded, loading]);

  // Elegir provincia = un paso nuevo del historial (el selector queda atrás).
  const handleSelectProvince = (provinceId) => {
    setFilterText("");
    updateParams({
      provincia: provinceId,
      municipio: null,
      vista: null,
      producto: null,
      categoria: null,
      min: null,
      max: null,
      moneda: null,
    });
  };

  // Municipios de la provincia elegida (para el filtro de Explorar).
  const loadMunicipalities = async (provinceId) => {
    try {
      const res = await fetch(
        `${API_URL}/public/municipalities?province_id=${provinceId}`,
      );
      if (!res.ok) throw new Error("No se pudieron cargar los municipios");
      const data = await res.json();
      setMunicipalities(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setMunicipalities([]);
    }
  };

  // Elegir municipio es un filtro: reemplaza la URL sin añadir historial.
  const handleSelectMunicipality = (municipalityId) => {
    setFilterText("");
    updateParams(
      { municipio: municipalityId === "all" ? null : municipalityId },
      false,
    );
  };

  // Cambiar de pestaña (Tiendas/Productos/Favoritos) es un paso del
  // historial. Al cambiar, la nueva pestaña recarga su lista.
  const switchView = (next) => {
    productsKeyRef.current = "";
    setProductsLoaded(false);
    updateParams({
      vista:
        next === "products"
          ? "productos"
          : next === "favorites"
            ? "favoritos"
            : null,
    });
  };

  // Volver al selector: un paso atrás (el selector es la vista anterior).
  const handleBackToSelector = goBack;

  const handleLoadMore = () => {
    if (selectedProvince && !loading) {
      loadProducts(selectedProvince, offset, true);
    }
  };

  // La búsqueda filtra en local lo ya cargado y, con una pausa corta
  // para no pedir a cada tecla, vuelve a cargar desde la primera página
  // (el servidor filtra por ?q= en toda la provincia, no solo lo cargado).
  const handleSearchChange = (e) => {
    const v = e.target.value;
    setFilterText(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      if (!selectedProvince) return;
      if (view === "favorites") loadFavorites(v);
      else if (view === "products")
        loadProducts(selectedProvince, 0, false, v);
    }, 500);
  };

  // Filtrado local (solo busca texto en los productos YA descargados de esa provincia)
  const filtered = (Array.isArray(products) ? products : []).filter(
    (p) =>
      (view !== "favorites" || favoriteIds.includes(p.id)) &&
      ((p.name || "").toLowerCase().includes(filterText.toLowerCase()) ||
        (p.store_name || "").toLowerCase().includes(filterText.toLowerCase())),
  );

  // Contador de Favoritos: en la pestaña Favoritos cuenta solo los
  // favoritos que de verdad se ven (los que devolvió el servidor y pasan
  // el filtro). Un favorito de una tienda suspendida u oculta sigue
  // guardado en el teléfono pero no cuenta aquí. En las demás pestañas,
  // sin datos de favoritos cargados, muestra los guardados.
  const visibleFavoriteCount =
    view === "favorites" ? filtered.length : favoriteIds.length;

  // Tiendas filtradas por municipio y por el buscador (nombre, provincia
  // o municipio).
  const filteredStores = (Array.isArray(stores) ? stores : []).filter(
    (s) =>
      (!selectedMunicipality ||
        s.municipality_id === selectedMunicipality.id) &&
      ((s.name || "").toLowerCase().includes(filterText.toLowerCase()) ||
        (s.province_name || "")
          .toLowerCase()
          .includes(filterText.toLowerCase()) ||
        (s.municipality_name || "")
          .toLowerCase()
          .includes(filterText.toLowerCase())),
  );

  // --- VISTA DE CARGA INICIAL (Solo carga provincias) ---
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-[#F2FBFC] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-cyan-700" size={40} />
        <p className="text-slate-500 text-sm font-bold">
          Cargando provincias...
        </p>
      </div>
    );
  }

  // --- VISTA DE ERROR AL CARGAR PROVINCIAS ---
  if (loadError === "provinces" && !selectedProvince) {
    return (
      <div className="min-h-screen bg-[#F2FBFC] text-slate-900 p-6 flex flex-col items-center justify-center animate-fade-in">
        <AlertCircle size={48} className="text-rose-600 mb-4" />
        <h1 className="font-display text-xl font-bold mb-2">
          No se pudo cargar el mercado
        </h1>
        <p className="text-slate-500 text-sm text-center mb-6">
          Revisa tu conexión e inténtalo de nuevo.
        </p>
        <button
          onClick={loadProvinces}
          className="bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-glow"
        >
          Reintentar
        </button>
        <button
          onClick={goHome}
          className="mt-6 text-slate-500 text-sm flex items-center gap-2 hover:text-slate-800"
        >
          <ChevronLeft size={16} /> Volver al inicio
        </button>
      </div>
    );
  }

  // --- VISTA 1: SELECTOR DE PROVINCIA (Si no ha elegido nada) ---
  if (!selectedProvince) {
    return (
      <div className="min-h-screen bg-[#F2FBFC] relative overflow-hidden text-slate-900 p-6 flex flex-col items-center justify-center animate-fade-in">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.3),transparent_60%)]"
        />
        <div className="relative mb-8 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-cyan-600 to-sky-600 rounded-[1.75rem] flex items-center justify-center mx-auto mb-4 text-white shadow-glow ring-1 ring-sky-300">
            <MapPin size={38} />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">
            ¿Por dónde andas? 🇨🇺
          </h1>
          <p className="text-slate-500">
            Elige tu provincia para ver lo que hay cerca de ti
          </p>
        </div>

        <div className="relative w-full max-w-md space-y-3">
          <button
            onClick={() =>
              handleSelectProvince("all", "Todas las provincias")
            }
            className="w-full bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white py-4 rounded-2xl font-bold transition-all text-sm flex items-center justify-center gap-2 active:scale-95 shadow-glow"
          >
            <Globe size={18} /> Todas las provincias
          </button>
          {favoriteIds.length > 0 && (
            <button
              onClick={() =>
                updateParams({ provincia: "all", vista: "favoritos" })
              }
              className="w-full bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 py-3.5 rounded-2xl font-bold transition-all text-sm flex items-center justify-center gap-2 active:scale-95"
            >
              <Heart size={18} className="fill-rose-500 text-rose-500" /> Ver
              mis favoritos ({favoriteIds.length})
            </button>
          )}
          <div className="grid grid-cols-2 gap-3">
            {provinces.map((prov) => (
              <button
                key={prov.id}
                onClick={() => handleSelectProvince(prov.id, prov.name)}
                className="bg-white hover:bg-cyan-600/20 hover:border-cyan-500/50 hover:text-slate-800 border border-slate-200 text-slate-600 py-4 rounded-2xl font-bold transition-all text-sm flex items-center justify-center gap-2 active:scale-95"
              >
                {prov.name}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={goHome}
          className="relative mt-12 text-slate-500 text-sm flex items-center gap-2 hover:text-slate-800"
        >
          <ChevronLeft size={16} /> Volver al inicio
        </button>
      </div>
    );
  }

  // --- VISTA 2: LISTADO DE PRODUCTOS (Si ya eligió) ---
  return (
    <div className="min-h-screen bg-[#F2FBFC] pb-20 text-slate-900 font-sans">
      {/* Header con botón para cambiar ubicación */}
      <div className="sticky top-0 bg-[#F2FBFC]/95 backdrop-blur-md z-30 px-4 py-3 border-b border-slate-200 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="p-2 -ml-2 rounded-full hover:bg-sky-100 text-slate-500"
          >
            <ChevronLeft />
          </button>
          <div>
            <h1 className="font-display font-extrabold text-lg leading-none">
              Mercado
            </h1>
            <button
              onClick={handleBackToSelector}
              className="text-xs text-cyan-700 flex items-center gap-1 mt-1 font-bold hover:underline"
            >
              <MapPin size={10} /> {selectedProvince.name}
              {selectedMunicipality ? ` · ${selectedMunicipality.name}` : ""}{" "}
              (Cambiar)
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
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-slate-200 bg-white text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 transition-all placeholder:text-slate-500"
            placeholder={
              view === "stores"
                ? `Buscar tiendas en ${selectedProvince.name}...`
                : view === "favorites"
                  ? "Buscar en tus favoritos..."
                  : `Buscar en ${selectedProvince.name}...`
            }
            value={filterText}
            onChange={handleSearchChange}
          />
        </div>
      </div>

      {/* Filtros de búsqueda de productos (categoría y precio, en CUP o USD) */}
      {view === "products" && (
        <div className="px-4 pb-1 space-y-2">
          <select
            className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-900 outline-none appearance-none text-sm"
            value={categoryFilter}
            onChange={(e) =>
              updateParams({ categoria: e.target.value || null }, false)
            }
          >
            <option value="">Todas las categorías</option>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              inputMode="decimal"
              placeholder="Precio mínimo"
              value={minPriceFilter}
              onChange={(e) =>
                updateParams({ min: e.target.value || null }, false)
              }
              className="flex-1 min-w-0 px-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 placeholder:text-slate-500"
            />
            <input
              type="number"
              min="0"
              inputMode="decimal"
              placeholder="Precio máximo"
              value={maxPriceFilter}
              onChange={(e) =>
                updateParams({ max: e.target.value || null }, false)
              }
              className="flex-1 min-w-0 px-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 placeholder:text-slate-500"
            />
            <select
              className="px-3 py-3 rounded-2xl border border-slate-200 bg-white text-slate-900 outline-none appearance-none text-sm shrink-0"
              value={currencyFilter}
              onChange={(e) =>
                updateParams(
                  { moneda: e.target.value === "usd" ? "usd" : null },
                  false,
                )
              }
            >
              <option value="cup">CUP</option>
              <option value="usd">USD</option>
            </select>
          </div>
        </div>
      )}

      {/* Filtro por municipio (solo con provincia concreta; no en Favoritos) */}
      {view !== "favorites" &&
        selectedProvince.id !== "all" &&
        municipalities.length > 0 && (
        <div className="px-4 pb-1">
          <select
            className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-900 outline-none appearance-none text-sm"
            value={selectedMunicipality?.id || "all"}
            onChange={(e) => {
              const id = e.target.value;
              const mun = municipalities.find((m) => m.id === id);
              handleSelectMunicipality(id, mun ? mun.name : "");
            }}
          >
            <option value="all">Todos los municipios</option>
            {municipalities.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tiendas / Productos / Favoritos */}
      <div className="px-4 pb-2">
        <div className="max-w-5xl mx-auto w-full bg-white border border-slate-200 rounded-2xl p-1 grid grid-cols-3 gap-1">
          <button
            onClick={() => switchView("stores")}
            className={`py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              view === "stores"
                ? "bg-gradient-to-r from-cyan-600 to-sky-600 text-white shadow-glow"
                : "text-slate-500 hover:bg-sky-100"
            }`}
          >
            <Store size={14} /> Tiendas
            {stores.length > 0 ? ` (${stores.length})` : ""}
          </button>
          <button
            onClick={() => switchView("products")}
            className={`py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              view === "products"
                ? "bg-gradient-to-r from-cyan-600 to-sky-600 text-white shadow-glow"
                : "text-slate-500 hover:bg-sky-100"
            }`}
          >
            <ShoppingBag size={14} /> Productos
          </button>
          <button
            onClick={() => switchView("favorites")}
            className={`py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              view === "favorites"
                ? "bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-glow"
                : "text-slate-500 hover:bg-rose-50"
            }`}
          >
            <Heart
              size={14}
              className={view === "favorites" ? "fill-white" : ""}
            />{" "}
            Favoritos
            {visibleFavoriteCount > 0 ? ` (${visibleFavoriteCount})` : ""}
          </button>
        </div>
      </div>

      {view === "stores" ? (
        <>
          {storesLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="animate-spin text-cyan-700" size={32} />
              <p className="text-slate-500 text-sm font-bold">
                Cargando tiendas...
              </p>
            </div>
          ) : loadError === "stores" ? (
            <div className="text-center py-20 px-6">
              <AlertCircle size={48} className="mx-auto mb-4 text-rose-600" />
              <p className="text-sm text-slate-600 mb-4">
                No se pudieron cargar las tiendas.
              </p>
              <button
                onClick={() => loadStores(selectedProvince)}
                className="bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-glow"
              >
                Reintentar
              </button>
            </div>
          ) : (
            <div className="px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in-up max-w-5xl mx-auto w-full">
              {filteredStores.map((s) => {
                const slug =
                  s.slug ||
                  (s.name || "").toLowerCase().trim().replace(/\s+/g, "-");
                return (
                  <div
                    key={s.id}
                    onClick={() => navigate(`/${slug}`)}
                    className="group bg-white rounded-3xl overflow-hidden border border-slate-200 flex items-center gap-4 p-4 shadow-xl cursor-pointer transition-all hover:-translate-y-1 hover:shadow-2xl hover:border-cyan-300 active:scale-[0.98]"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-sky-50 flex items-center justify-center overflow-hidden shrink-0">
                      {s.logo_url ? (
                        <img
                          src={s.logo_url}
                          alt={cleanName(s.name)}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Store size={28} className="text-cyan-700" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 truncate flex items-center gap-1.5">
                        {cleanName(s.name)}
                        {s.is_verified && (
                          <BadgeCheck
                            size={15}
                            className="text-cyan-600 shrink-0"
                          />
                        )}
                      </h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                        <MapPin size={12} />{" "}
                        {s.municipality_name
                          ? `${s.municipality_name}, ${s.province_name || selectedProvince.name}`
                          : s.province_name || selectedProvince.name}
                      </p>
                      {s.description ? (
                        <p className="text-xs text-slate-500 line-clamp-1 mt-1">
                          {s.description}
                        </p>
                      ) : null}
                    </div>
                    <ChevronLeft
                      size={18}
                      className="rotate-180 text-slate-400 shrink-0"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {!storesLoading &&
            loadError !== "stores" &&
            filteredStores.length === 0 && (
              <div className="text-center py-20 opacity-50 px-6">
                <Store size={48} className="mx-auto mb-4 text-slate-400" />
                <p className="text-sm">
                  No hay tiendas en{" "}
                  <span className="text-cyan-700 font-bold">
                    {selectedMunicipality
                      ? `${selectedMunicipality.name}, ${selectedProvince.name}`
                      : selectedProvince.name}
                  </span>
                  .
                </p>
                <button
                  onClick={handleBackToSelector}
                  className="mt-4 text-xs text-cyan-700 underline"
                >
                  Cambiar provincia
                </button>
              </div>
            )}

          {!storesLoading &&
            loadError !== "stores" &&
            filteredStores.length > 0 && (
              <div className="px-4 mt-6 text-center max-w-5xl mx-auto">
                <p className="text-xs text-slate-500">
                  {filterText
                    ? `Mostrando ${filteredStores.length} de ${stores.length} tiendas`
                    : `Mostrando ${filteredStores.length} tiendas`}
                </p>
              </div>
            )}
        </>
      ) : (
        <>
      {/* Loader de productos */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="animate-spin text-cyan-700" size={32} />
          <p className="text-slate-500 text-sm font-bold">
            Cargando productos...
          </p>
        </div>
      ) : loadError === "products" ? (
        <div className="text-center py-20 px-6">
          <AlertCircle size={48} className="mx-auto mb-4 text-rose-600" />
          <p className="text-sm text-slate-600 mb-4">
            No se pudieron cargar los productos.
          </p>
          <button
            onClick={() =>
              view === "favorites"
                ? loadFavorites()
                : loadProducts(selectedProvince, 0, false)
            }
            className="bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-glow"
          >
            Reintentar
          </button>
        </div>
      ) : (
        /* Grid */
        <div className="px-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 animate-fade-in-up max-w-5xl mx-auto w-full">
          {filtered.map((p) => {
            const mainImg = parseImages(p.images ?? p.image_url)[0];
            const isOut = Number(p.stock) === 0;
            const hasPrice =
              Number(p.price_cup) > 0 || Number(p.price_usd) > 0;
            return (
              <div
                key={p.id}
                onClick={() => updateParams({ producto: p.id })}
                className="group bg-white rounded-3xl overflow-hidden border border-slate-200 flex flex-col shadow-xl cursor-pointer transition-all hover:-translate-y-1 hover:shadow-2xl hover:border-cyan-300 active:scale-[0.98]"
              >
                <div className="aspect-square bg-sky-50 relative overflow-hidden">
                  {mainImg ? (
                    <img
                      src={mainImg}
                      alt={cleanName(p.name)}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="text-slate-700" />
                    </div>
                  )}
                  <FavHeart productId={p.id} />
                  <div className="absolute top-2 left-2 z-10 flex flex-col items-start gap-1">
                    {isFeatured(p) && <FeaturedBadge />}
                    {isOut && (
                      <span className="bg-rose-600 text-white text-[11px] font-bold px-2 py-1 rounded-full">
                        Agotado
                      </span>
                    )}
                  </div>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/${p.store_slug}`);
                    }}
                    className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <Store size={10} className="text-cyan-700 shrink-0" />
                    <span className="text-[11px] font-bold text-white">
                      {cleanName(p.store_name)}
                    </span>
                  </div>
                </div>

                <div className="p-3 flex-1 flex flex-col gap-1">
                  <h3 className="text-sm font-bold text-slate-900 line-clamp-2 min-h-10">
                    {cleanName(p.name)}
                  </h3>
                  <div className="mt-auto pt-2">
                    <div className="flex flex-wrap gap-1 items-baseline mb-2">
                      {Number(p.price_cup) > 0 && (
                        <span className="text-cyan-700 font-black text-sm">
                          {formatPrice(p.price_cup, "CUP")}
                        </span>
                      )}
                      {Number(p.price_usd) > 0 && (
                        <span className="text-emerald-600 font-bold text-[10px] bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-lg ml-auto">
                          {formatPrice(p.price_usd, "USD")}
                        </span>
                      )}
                      {!hasPrice && (
                        <span className="text-xs text-slate-500 font-bold">
                          Precio a consultar
                        </span>
                      )}
                    </div>
                    {isOut ? (
                      <button
                        disabled
                        className="w-full bg-slate-100 border border-slate-200 text-slate-500 py-2.5 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-2"
                      >
                        Agotado
                      </button>
                    ) : (
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
                        className="w-full bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 py-2.5 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-2 shadow-glow"
                      >
                        <MessageCircle size={12} /> Pedir
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && loadError !== "products" && filtered.length === 0 && (
        <div className="text-center py-20 opacity-50 px-6">
          {view === "favorites" && favoriteIds.length === 0 ? (
            <>
              <Heart
                size={48}
                className="mx-auto mb-4 text-rose-400 fill-rose-200"
              />
              <p className="text-sm">
                Aún no tienes favoritos. Toca el corazón de un producto para
                guardarlo aquí.
              </p>
            </>
          ) : view === "favorites" &&
            favoriteIds.length > 0 &&
            !filterText ? (
            <>
              <Heart
                size={48}
                className="mx-auto mb-4 text-rose-400 fill-rose-200"
              />
              <p className="text-sm font-bold">
                Tus favoritos no están disponibles en este momento.
              </p>
              <p className="text-sm mt-2">
                La tienda puede estar suspendida u oculta, o el producto ya
                no existe. Si vuelve a estar disponible, aparecerá aquí de
                nuevo.
              </p>
            </>
          ) : (
            <>
              <ShoppingBag
                size={48}
                className="mx-auto mb-4 text-slate-400"
              />
              <p className="text-sm">
                {filterText ? (
                  <>
                    No encontramos eso por aquí, prueba con otra palabra o{" "}
                    <button
                      onClick={handleBackToSelector}
                      className="text-cyan-700 underline"
                    >
                      cambia de provincia
                    </button>
                    .
                  </>
                ) : (
                  <>
                    No hay productos en{" "}
                    <span className="text-cyan-700 font-bold">
                      {selectedProvince.name}
                    </span>
                    .
                  </>
                )}
              </p>
            </>
          )}
          {!filterText && view !== "favorites" && (
            <button
              onClick={handleBackToSelector}
              className="mt-4 text-xs text-cyan-700 underline"
            >
              Cambiar provincia
            </button>
          )}
        </div>
      )}

      {!loading && loadError !== "products" && filtered.length > 0 && (
        <div className="px-4 mt-6 text-center space-y-3 max-w-5xl mx-auto">
          <p className="text-xs text-slate-500">
            {filterText
              ? `Mostrando ${filtered.length} de ${products.length} cargados`
              : totalProducts !== null
                ? `Mostrando ${filtered.length} de ${totalProducts} productos`
                : `Mostrando ${filtered.length} productos`}
          </p>
          {hasMore && (
            <button
              onClick={handleLoadMore}
              className="bg-white text-slate-700 px-6 py-3 rounded-2xl text-sm font-bold border border-slate-200 hover:bg-sky-100 transition-all"
            >
              Cargar más
            </button>
          )}
        </div>
      )}

        </>
      )}

      {detailProduct && (
        <ProductDetailModal
          product={detailProduct}
          onClose={closeDetail}
        />
      )}
    </div>
  );
};

export default GlobalMarketplace;
