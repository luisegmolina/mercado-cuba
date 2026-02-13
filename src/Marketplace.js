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
  MapPin,
  //Navigation,
} from "lucide-react";

const API_URL = "https://mercado-backend-o8vl.onrender.com/api";

const GlobalMarketplace = () => {
  const [products, setProducts] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [loading, setLoading] = useState(false); // Empieza en false porque no cargamos productos aun
  const [initialLoading, setInitialLoading] = useState(true); // Solo para cargar la lista de provincias

  // Estado crucial: Si es null, mostramos el selector. Si tiene ID, mostramos productos.
  const [selectedProvince, setSelectedProvince] = useState(null);
  const [filterText, setFilterText] = useState("");

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

  // 1. Al inicio, SOLO cargamos la lista de provincias (muy rápido)
  useEffect(() => {
    fetch(`${API_URL}/public/provinces`)
      .then((res) => res.json())
      .then((data) => {
        setProvinces(data);
        setInitialLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setInitialLoading(false);
      });
  }, []);

  // 2. Función para cargar productos cuando el usuario elige provincia
  const handleSelectProvince = (provinceId, provinceName) => {
    setLoading(true);
    setSelectedProvince({ id: provinceId, name: provinceName }); // Guardamos cual eligió

    // Llamamos al NUEVO endpoint optimizado
    fetch(`${API_URL}/public/products/province/${provinceId}`)
      .then((res) => res.json())
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  // Filtrado local (solo busca texto en los productos YA descargados de esa provincia)
  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(filterText.toLowerCase()) ||
      p.store_name.toLowerCase().includes(filterText.toLowerCase()),
  );

  // --- VISTA DE CARGA INICIAL (Solo carga provincias) ---
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );
  }

  // --- VISTA 1: SELECTOR DE PROVINCIA (Si no ha elegido nada) ---
  if (!selectedProvince) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6 flex flex-col items-center justify-center animate-fade-in">
        <div className="mb-8 text-center">
          <div className="w-20 h-20 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-500">
            <MapPin size={40} />
          </div>
          <h1 className="text-3xl font-black tracking-tight mb-2">
            Bienvenido
          </h1>
          <p className="text-gray-400">
            Selecciona tu ubicación para ver ofertas cercanas
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full max-w-md">
          {provinces.map((prov) => (
            <button
              key={prov.id}
              onClick={() => handleSelectProvince(prov.id, prov.name)}
              className="bg-gray-800 hover:bg-blue-600 hover:text-white border border-gray-700 text-gray-300 py-4 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 active:scale-95 shadow-lg"
            >
              {prov.name}
            </button>
          ))}
        </div>

        <button
          onClick={() => navigate("/")}
          className="mt-12 text-gray-500 text-sm flex items-center gap-2 hover:text-white"
        >
          <ChevronLeft size={16} /> Volver al inicio
        </button>
      </div>
    );
  }

  // --- VISTA 2: LISTADO DE PRODUCTOS (Si ya eligió) ---
  return (
    <div className="min-h-screen bg-gray-900 pb-20 text-white font-sans">
      {/* Header con botón para cambiar ubicación */}
      <div className="sticky top-0 bg-gray-900/95 backdrop-blur-md z-30 px-4 py-3 border-b border-gray-800 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="p-2 -ml-2 rounded-full hover:bg-gray-800 text-gray-400"
          >
            <ChevronLeft />
          </button>
          <div>
            <h1 className="font-black text-lg leading-none">Mercado</h1>
            <button
              onClick={() => {
                setSelectedProvince(null);
                setProducts([]);
                setFilterText("");
              }}
              className="text-xs text-blue-400 flex items-center gap-1 mt-1 font-bold hover:underline"
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
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
            size={18}
          />
          <input
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-700 bg-gray-800 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            placeholder={`Buscar en ${selectedProvince.name}...`}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>
      </div>

      {/* Loader de productos */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
      ) : (
        /* Grid */
        <div className="px-4 grid grid-cols-2 gap-4 animate-fade-in-up">
          {filtered.map((p) => {
            const mainImg = parseImages(p.image_url)[0];
            return (
              <div
                key={p.id}
                className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700 flex flex-col shadow-lg"
              >
                <div className="aspect-square bg-gray-900 relative">
                  {mainImg ? (
                    <img
                      src={mainImg}
                      alt={p.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="text-gray-700" />
                    </div>
                  )}
                  <div
                    onClick={() => navigate(`/${p.store_slug}`)}
                    className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <Store size={10} className="text-blue-400" />
                    <span className="text-[10px] font-bold truncate max-w-[80px] text-white">
                      {p.store_name}
                    </span>
                  </div>
                </div>

                <div className="p-3 flex-1 flex flex-col gap-1">
                  <h3 className="text-xs font-bold text-gray-200 line-clamp-2 h-8">
                    {p.name}
                  </h3>
                  <div className="mt-auto pt-2">
                    <div className="flex flex-wrap gap-1 items-baseline mb-2">
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
                          `https://wa.me/${p.store_whatsapp}?text=Hola, vi en Mercado (${selectedProvince.name}): ${p.name}`,
                        )
                      }
                      className="w-full bg-blue-600 hover:bg-blue-500 py-2 rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-2"
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

      {!loading && filtered.length === 0 && (
        <div className="text-center py-20 opacity-50 px-6">
          <ShoppingBag size={48} className="mx-auto mb-4 text-gray-600" />
          <p className="text-sm">
            No hay productos en{" "}
            <span className="text-blue-400 font-bold">
              {selectedProvince.name}
            </span>
            .
          </p>
          <button
            onClick={() => setSelectedProvince(null)}
            className="mt-4 text-xs text-blue-400 underline"
          >
            Cambiar provincia
          </button>
        </div>
      )}
    </div>
  );
};

export default GlobalMarketplace;
