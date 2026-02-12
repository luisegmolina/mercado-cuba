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
} from "lucide-react";
// Importamos las constantes y utilidades de tu App principal si las exportas,
// o las definimos aquí para independencia.
const API_URL = "https://mercado-backend-o8vl.onrender.com/api";

const GlobalMarketplace = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const navigate = useNavigate();

  // Reutilizamos tu lógica de parseo de imágenes
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
    fetch(`${API_URL}/public/all-products`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(filter.toLowerCase()) ||
      p.store_name.toLowerCase().includes(filter.toLowerCase()),
  );

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
      {/* HEADER DINÁMICO */}
      <div className="sticky top-0 bg-gray-900/95 backdrop-blur-md z-30 px-4 py-4 border-b border-gray-800 flex items-center gap-3 shadow-2xl">
        <button
          onClick={() => navigate("/")}
          className="p-2 -ml-2 rounded-full hover:bg-gray-800 text-gray-400 transition-colors"
        >
          <ChevronLeft />
        </button>
        <h1 className="font-black text-xl tracking-tighter">Mercado Global</h1>
      </div>

      {/* BARRA DE BÚSQUEDA */}
      <div className="p-4">
        <div className="relative group">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors"
            size={18}
          />
          <input
            className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-700 bg-gray-800 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner"
            placeholder="¿Qué buscas hoy en Cuba?"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      {/* GRID DE PRODUCTOS */}
      <div className="px-4 grid grid-cols-2 gap-4">
        {filtered.map((p) => {
          const mainImg = parseImages(p.image_url)[0];
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
                {/* Badge de la Tienda */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/${p.store_slug}`);
                  }}
                  className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1.5 border border-white/10 cursor-pointer hover:bg-blue-600 transition-colors"
                >
                  <Store size={10} className="text-blue-400" />
                  <span className="text-[10px] font-bold truncate max-w-[70px]">
                    {p.store_name}
                  </span>
                </div>
              </div>

              <div className="p-3 flex-1 flex flex-col gap-2">
                <h3 className="text-xs font-bold text-gray-200 line-clamp-2 leading-tight">
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
                        `https://wa.me/${p.store_whatsapp}?text=Hola, vi en el Mercado Global: ${p.name}`,
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
        <div className="text-center py-20 opacity-50">
          <ShoppingBag size={48} className="mx-auto mb-4 text-gray-600" />
          <p className="text-sm">No encontramos productos con ese nombre.</p>
        </div>
      )}
    </div>
  );
};

export default GlobalMarketplace;
