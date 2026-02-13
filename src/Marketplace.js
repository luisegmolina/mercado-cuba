import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShoppingBag,
  Store,
  MessageCircle,
  ChevronLeft,
  Search,
  ImageIcon,
  Loader2,
  MapPin, // Icono nuevo para ubicación
  XCircle, // Icono para limpiar filtros
} from "lucide-react";

const API_URL = "https://mercado-backend-o8vl.onrender.com/api";

const GlobalMarketplace = () => {
  const [products, setProducts] = useState([]);
  const [provinces, setProvinces] = useState([]); // Estado para lista de provincias
  const [loading, setLoading] = useState(true);

  // Estados de filtros
  const [filterText, setFilterText] = useState("");
  const [selectedProvinceId, setSelectedProvinceId] = useState(""); // Filtro por ID de provincia

  const navigate = useNavigate();

  const parseImages = (imgStr) => {
    if (!imgStr) return [];
    try {
      const parsed = JSON.parse(imgStr);
      return Array.isArray(parsed) ? parsed : [imgStr];
    } catch (e) {
      return typeof imgStr === "string" ? [imgStr] : [];
    }
  };

  useEffect(() => {
    // 1. Cargar Productos
    const fetchProducts = fetch(`${API_URL}/public/all-products`).then((res) =>
      res.json(),
    );

    // 2. Cargar Provincias (Categorías)
    const fetchProvinces = fetch(`${API_URL}/public/provinces`).then((res) =>
      res.json(),
    );

    Promise.all([fetchProducts, fetchProvinces])
      .then(([productsData, provincesData]) => {
        setProducts(productsData);
        setProvinces(provincesData); // Guardamos las provincias
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error cargando datos", err);
        setLoading(false);
      });
  }, []);

  // Lógica de filtrado combinada
  const filtered = products.filter((p) => {
    // Filtro Texto
    const matchesText =
      p.name.toLowerCase().includes(filterText.toLowerCase()) ||
      p.store_name.toLowerCase().includes(filterText.toLowerCase());

    // Filtro Provincia (Si hay una seleccionada, comparamos el ID)
    // Nota: El backend en 'all-products' debe devolver 'province_id' o 'store_province'
    // Asumiremos que filtramos por nombre si el backend devuelve el nombre,
    // o comparamos IDs si tienes el ID disponible.
    // Usaremos comparación por nombre para que coincida visualmente o por ID si está disponible.

    const matchesProvince =
      selectedProvinceId === "" ||
      // Verificamos si p.province_id existe (número) o si comparamos nombres
      (p.province_id && String(p.province_id) === String(selectedProvinceId)) ||
      (p.store_province &&
        provinces.find((prov) => prov.id === Number(selectedProvinceId))
          ?.name === p.store_province);

    return matchesText && matchesProvince;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={40} />
        <p className="text-blue-500 font-bold animate-pulse text-xs uppercase tracking-widest">
          Cargando Vitrina...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 pb-20 text-white font-sans">
      {/* HEADER */}
      <div className="sticky top-0 bg-gray-900/95 backdrop-blur-md z-30 px-4 py-4 border-b border-gray-800 flex items-center gap-3 shadow-2xl">
        <button
          onClick={() => navigate("/")}
          className="p-2 -ml-2 rounded-full hover:bg-gray-800 text-gray-400 transition-colors"
        >
          <ChevronLeft />
        </button>
        <h1 className="font-black text-xl tracking-tighter">Mercado Global</h1>
      </div>

      <div className="flex flex-col gap-4 pt-4">
        {/* BARRA DE BÚSQUEDA */}
        <div className="px-4">
          <div className="relative group">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors"
              size={18}
            />
            <input
              className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-700 bg-gray-800 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner"
              placeholder="¿Qué buscas hoy?"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
            {filterText && (
              <button
                onClick={() => setFilterText("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                <XCircle size={16} />
              </button>
            )}
          </div>
        </div>

        {/* FILTRO DE CATEGORÍAS (PROVINCIAS) - Scroll Horizontal */}
        <div className="w-full overflow-x-auto pb-2 hide-scrollbar px-4">
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedProvinceId("")}
              className={`
                  whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all border
                  ${
                    selectedProvinceId === ""
                      ? "bg-white text-black border-white"
                      : "bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700"
                  }
                `}
            >
              Todas
            </button>
            {provinces.map((prov) => (
              <button
                key={prov.id}
                onClick={() => setSelectedProvinceId(prov.id)} // Guardamos el ID al hacer click
                className={`
                  whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all border
                  ${
                    Number(selectedProvinceId) === prov.id
                      ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-900/40"
                      : "bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700"
                  }
                `}
              >
                {prov.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* GRID DE PRODUCTOS */}
      <div className="px-4 mt-4 grid grid-cols-2 gap-4">
        {filtered.map((p) => {
          const mainImg = parseImages(p.image_url)[0];
          // Usamos el nombre de provincia que viene del backend
          const provName = p.store_province || "Cuba";

          return (
            <div
              key={p.id}
              className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700 flex flex-col shadow-lg hover:border-blue-500/50 transition-all active:scale-[0.98]"
            >
              <div className="aspect-square bg-gray-900 relative group">
                {mainImg ? (
                  <img
                    src={mainImg}
                    alt={p.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="text-gray-700" />
                  </div>
                )}

                {/* Badge Tienda */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/${p.store_slug}`);
                  }}
                  className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1.5 border border-white/10 cursor-pointer hover:bg-blue-600 transition-colors max-w-[90%]"
                >
                  <Store size={10} className="text-blue-400 shrink-0" />
                  <span className="text-[10px] font-bold truncate">
                    {p.store_name}
                  </span>
                </div>
              </div>

              <div className="p-3 flex-1 flex flex-col gap-1">
                {/* Ubicación (Provincia) */}
                <div className="flex items-center gap-1 text-gray-500 mb-1">
                  <MapPin size={10} />
                  <span className="text-[10px] uppercase tracking-wide font-medium truncate">
                    {provName}
                  </span>
                </div>

                <h3 className="text-xs font-bold text-gray-200 line-clamp-2 leading-tight mb-2">
                  {p.name}
                </h3>

                <div className="mt-auto">
                  <div className="flex flex-wrap gap-1 items-baseline">
                    {p.price_cup > 0 && (
                      <span className="text-blue-400 font-black text-sm">
                        {p.price_cup} CUP
                      </span>
                    )}
                    {p.price_usd > 0 && (
                      <span className="text-emerald-400 font-bold text-[10px] bg-emerald-900/20 px-1 rounded ml-auto">
                        {p.price_usd} USD
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      window.open(
                        `https://wa.me/${p.store_whatsapp}?text=Hola, vi en el Mercado Global (${provName}): ${p.name}`,
                      )
                    }
                    className="w-full mt-3 bg-blue-600 hover:bg-blue-500 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                  >
                    <MessageCircle size={12} /> Pedir
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20 opacity-50 px-6">
          <ShoppingBag size={48} className="mx-auto mb-4 text-gray-600" />
          <p className="text-sm font-medium text-gray-400">
            No hay productos disponibles con ese filtro.
          </p>
          <button
            onClick={() => {
              setFilterText("");
              setSelectedProvinceId("");
            }}
            className="mt-4 text-xs text-blue-400 underline"
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  );
};

export default GlobalMarketplace;
