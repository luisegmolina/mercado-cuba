import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Store, MessageCircle, ChevronLeft, Search } from "lucide-react";
// Asumiendo que exportas AppContext y API_URL desde tu App.js
// import { AppContext, API_URL } from './App';

const GlobalMarketplace = () => {
  const [products, setProducts] = useState([]);
  //const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    // Debes crear este endpoint en tu backend: /api/public/all-products
    fetch(`https://mercado-backend-o8vl.onrender.com/api/public/all-products`)
      .then((res) => res.json())
      .then((data) => {
        setProducts(data);
        //    setLoading(false);
      });
    //.catch(() => setLoading(false));
  }, []);

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(filter.toLowerCase()) ||
      p.store_name.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-gray-900 pb-20 text-white">
      {/* Header */}
      <div className="sticky top-0 bg-gray-900/95 backdrop-blur-md z-30 px-4 py-4 border-b border-gray-800 flex items-center gap-3">
        <button
          onClick={() => navigate("/")}
          className="p-2 -ml-2 rounded-full hover:bg-gray-800 text-gray-400"
        >
          <ChevronLeft />
        </button>
        <h1 className="font-black text-xl tracking-tight">Explorar Mercado</h1>
      </div>

      {/* Buscador */}
      <div className="p-4">
        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
            size={18}
          />
          <input
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-700 bg-gray-800 text-sm outline-none focus:border-blue-500 transition-all"
            placeholder="Buscar productos o tiendas..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Grid de Productos */}
      <div className="px-4 grid grid-cols-2 gap-4">
        {filtered.map((p) => (
          <div
            key={p.id}
            className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700 flex flex-col shadow-2xl"
          >
            <div className="aspect-square bg-gray-900 relative">
              {/* Reutiliza tu componente SafeImage si lo exportas */}
              <img
                src={JSON.parse(p.image_url)[0]}
                alt={p.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1.5 border border-white/10">
                <Store size={10} className="text-blue-400" />
                <span className="text-[10px] font-bold truncate max-w-[80px]">
                  {p.store_name}
                </span>
              </div>
            </div>
            <div className="p-3 flex-1 flex flex-col gap-2">
              <h3 className="text-xs font-semibold text-gray-200 line-clamp-2">
                {p.name}
              </h3>
              <div className="mt-auto">
                <p className="text-blue-400 font-black text-sm">
                  {p.price_cup} CUP
                </p>
                <button
                  onClick={() =>
                    window.open(`https://wa.me/${p.store_whatsapp}`)
                  }
                  className="w-full mt-2 bg-gray-700 hover:bg-blue-600 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2"
                >
                  <MessageCircle size={12} /> Contactar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GlobalMarketplace;
