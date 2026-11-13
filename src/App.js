import React, {
  useState,
  useEffect,
  createContext,
  useContext,
  //use,
} from "react";
import GlobalMarketplace from "./Marketplace"; // Asegúrate de que el nombre coincida
import "./index.css";
import {
  parseImages,
  SafeImage,
  normalizePhone,
  formatPhone,
  waLink,
  formatPrice,
  priceLabel,
  orderMessage,
  ProductDetailModal,
  CUBA_HERO,
  firstProductImage,
  cleanName,
} from "./shared";
// Importamos los componentes de navegación para crear una Single Page Application (SPA)
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
  useNavigate,
  useParams,
  useLocation,
} from "react-router-dom";
// Importamos una colección completa de iconos para mejorar la experiencia visual
import {
  BookOpen,
  FileText,
  ShoppingBag,
  Plus,
  Trash2,
  LogOut,
  User,
  MessageCircle,
  X,
  Copy,
  Store,
  ChevronLeft,
  ChevronRight,
  Loader2,
  // Lock,
  Eye,
  EyeOff,
  //notify,
  Edit,
  Ban,
  CheckCircle,
  Image as ImageIcon,
  ArrowRight,
  Info,
  Grid,
  Settings as SettingsIcon,
  AlertCircle,
  MapPin,
  Search,
  Zap,
  ShieldCheck,
  Globe,
  Wallet,
  BadgeCheck,
  Sparkles,
  //Camera,
  //Share2,
} from "lucide-react";

/** * --- CONFIGURACIÓN DE RED Y CONSTANTES ---
 * API_URL: Punto de enlace con el servidor backend en Render.
 * APP_NAME: Nombre comercial de la plataforma.
 */
const API_URL = "https://mercado-backend-o8vl.onrender.com/api";

const APP_NAME = "Mercado Cuba";

/** * --- UTILIDADES DE PROCESAMIENTO ---
 * (parseImages y SafeImage viven en ./shared.js y se importan arriba)
 */

// Inyecta Tailwind CSS dinámicamente.
// Nota: El error "Unexpected token <" ocurre si este script falla al cargar.
/*const TailwindInjector = () => {
  useEffect(() => {
    if (!document.getElementById("tailwind-script")) {
      const script = document.createElement("script");
      script.id = "tailwind-script";
      script.src = "https://cdn.tailwindcss.com";
      document.head.appendChild(script);
    }
    // Configuración de estilos globales del cuerpo de la página
    document.body.style.backgroundColor = "#111827";
    document.body.style.color = "#f3f4f6";
    document.body.style.margin = "0";
    document.body.style.fontFamily = "sans-serif";
  }, []);
  return null;
};
*/
/** * --- TOAST CONTEXT (NOTIFICACIONES) --- */
const ToastContext = createContext();

const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const notify = (message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 3000);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="fixed top-4 right-4 left-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-2xl flex items-center gap-3 border transition-all animate-bounce-in ${
              t.type === "success"
                ? "bg-white border-emerald-500 text-emerald-600"
                : "bg-white border-rose-400 text-rose-600"
            }`}
          >
            {t.type === "success" ? (
              <CheckCircle size={20} />
            ) : (
              <AlertCircle size={20} />
            )}
            <span className="text-sm font-medium">{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="ml-auto text-slate-500 hover:text-slate-800"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
const useToast = () => useContext(ToastContext);

/** * --- COMPONENTES UI GLOBALES --- */
const LoadingOverlay = () => (
  <div className="fixed inset-0 bg-white/90 z-[999] flex flex-col items-center justify-center backdrop-blur-sm">
    <Loader2 className="animate-spin text-cyan-600" size={40} />
    <p className="text-cyan-600 mt-4 font-bold animate-pulse uppercase tracking-widest text-xs">
      Cargando datos...
    </p>
  </div>
);

/** * --- APP CONTEXT (EL CEREBRO DE LA APLICACIÓN) --- */
const AppContext = createContext();

const AppProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(false);
  const { notify } = useToast();
  const [myStore, setMyStore] = useState(null);
  const [myProducts, setMyProducts] = useState([]);
  const [adminData, setAdminData] = useState(null);
  const [superAdminContact, setSuperAdminContact] = useState("");
  const [provinces, setProvinces] = useState([]);
  const [provincesError, setProvincesError] = useState(false);

  // Provincias compartidas: se cargan una sola vez en el contexto y las
  // usan la landing, el mercado y el formulario de Ajustes del vendedor.
  const loadProvinces = async () => {
    setProvincesError(false);
    try {
      const res = await fetch(`${API_URL}/public/provinces`);
      if (!res.ok) throw new Error("No se pudieron cargar las provincias");
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Respuesta inválida");
      setProvinces(data);
    } catch (err) {
      console.error("Error cargando provincias:", err);
      setProvinces([]);
      setProvincesError(true);
    }
  };

  useEffect(() => {
    loadProvinces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restaurar la sesión al montar si hay un token guardado.
  // GET /api/me devuelve { store, products } para el vendedor
  // y { admin: true } para el superadmin.
  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    if (!savedToken) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/me`, {
          headers: { Authorization: `Bearer ${savedToken}` },
        });
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem("token");
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        if (data.store) {
          setCurrentUser({
            role: "vendor",
            storeId: data.store.id,
            name: data.store.owner_name,
          });
          setMyStore(data.store);
          setMyProducts(Array.isArray(data.products) ? data.products : []);
        } else if (data.admin) {
          setCurrentUser({ role: "superadmin", name: "SuperAdmin" });
          fetchAdminData(savedToken);
        }
      } catch (e) {
        // Sin conexión: se mantiene el login manual.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincronización del Token con el LocalStorage
  useEffect(() => {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  }, [token]);

  // Obtener configuración pública (como WhatsApp de soporte)
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch(`${API_URL}/public/config`);
        if (!res.ok) throw new Error("Backend no disponible");
        const data = await res.json();
        setSuperAdminContact(data.whatsapp);
      } catch (e) {
        console.warn("Usando configuración local por defecto.");
      }
    };
    fetchConfig();
  }, []);

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  });

  // --- MÉTODOS DE API ---

  // Lee el mensaje de error de una respuesta; si no es JSON válido
  // (p. ej. el backend está dormido o caído), devuelve un mensaje claro
  // en vez de un error técnico.
  const readErrorMessage = async (res) => {
    try {
      const data = await res.json();
      return data.error || "Error en el servidor";
    } catch (e) {
      return "Sin conexión con el servidor, inténtalo de nuevo";
    }
  };

  const friendlyError = (err) =>
    !err || !err.message || err.message === "Failed to fetch"
      ? "Sin conexión con el servidor, inténtalo de nuevo"
      : err.message;

  const getStoreById = async (id) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/store/${id}`);
      if (!res.ok) throw new Error("Tienda no encontrada");
      return await res.json();
    } catch (err) {
      notify("Error de conexión", "error");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const loginStore = async (whatsapp, password) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp: normalizePhone(whatsapp), password }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      const data = await res.json();
      setToken(data.token);
      setCurrentUser({
        role: "vendor",
        storeId: data.store.id,
        name: data.store.owner_name,
      });
      setMyStore(data.store);
      setMyProducts(Array.isArray(data.products) ? data.products : []);
      notify(`Bienvenido, ${data.store.name}`);
    } catch (err) {
      notify(friendlyError(err), "error");
    } finally {
      setLoading(false);
    }
  };

  const registerStore = async (data, code, pwd) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          whatsapp: normalizePhone(data.whatsapp),
          code,
          password: pwd,
        }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      const resp = await res.json();
      setToken(resp.token);
      setCurrentUser({
        role: "vendor",
        storeId: resp.store.id,
        name: resp.store.owner_name,
      });
      setMyStore(resp.store);
      setMyProducts([]);
      notify("¡Tienda creada con éxito!");
    } catch (err) {
      notify(friendlyError(err), "error");
    } finally {
      setLoading(false);
    }
  };

  const saveProduct = async (prod, isEdit) => {
    setLoading(true);
    try {
      const url = isEdit
        ? `${API_URL}/products/${prod.id}`
        : `${API_URL}/products`;
      const payload = { ...prod, imageUrl: JSON.stringify(prod.images || []) };
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Error al guardar");
      const saved = await res.json();
      setMyProducts((prev) =>
        isEdit
          ? prev.map((p) => (p.id === prod.id ? saved : p))
          : [saved, ...prev],
      );
      notify(isEdit ? "Actualizado" : "Creado");
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const deleteProduct = async (id) => {
    if (!window.confirm("¿Eliminar este producto?")) return;
    setLoading(true);
    try {
      await fetch(`${API_URL}/products/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      setMyProducts((prev) => prev.filter((p) => p.id !== id));
      notify("Producto eliminado");
    } catch (err) {
      notify("Error al borrar", "error");
    } finally {
      setLoading(false);
    }
  };

  const updateStoreSettings = async (settings) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/store/settings`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Error al actualizar");
      setMyStore(await res.json());
      notify("Cambios guardados");
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const loginSuperAdmin = async (password) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      const data = await res.json();
      setToken(data.token);
      setCurrentUser({ role: "superadmin", name: "SuperAdmin" });
      fetchAdminData(data.token);
      notify("Modo Admin activado");
    } catch (err) {
      notify(friendlyError(err), "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminData = async (t) => {
    try {
      const res = await fetch(`${API_URL}/admin/dashboard`, {
        headers: { Authorization: `Bearer ${t || token}` },
      });
      if (res.ok) setAdminData(await res.json());
    } catch (e) {}
  };

  const generateCode = async () => {
    const code = "PRO-" + Math.random().toString(36).substr(2, 6).toUpperCase();
    await fetch(`${API_URL}/admin/codes`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ code }),
    });
    fetchAdminData();
    notify("Licencia generada");
  };

  const deleteCode = async (id) => {
    if (!window.confirm("¿Borrar licencia?")) return;
    try {
      await fetch(`${API_URL}/admin/codes/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      fetchAdminData();
      notify("Licencia eliminada");
    } catch (e) {
      notify("Error", "error");
    }
  };

  const toggleStore = async (id, status) => {
    if (!window.confirm("¿Cambiar estado de suspensión?")) return;
    await fetch(`${API_URL}/admin/store/${id}/status`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ is_suspended: !status }),
    });
    fetchAdminData();
    notify("Estado actualizado");
  };

  const deleteStore = async (id) => {
    if (!window.confirm("¿ELIMINAR TIENDA?")) return;
    await fetch(`${API_URL}/admin/store/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    fetchAdminData();
    notify("Tienda eliminada");
  };

  const adminUpdateStoreContact = async (storeId, whatsapp) => {
    try {
      const res = await fetch(`${API_URL}/admin/store/${storeId}/contact`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ whatsapp }),
      });
      if (res.ok) {
        notify("Contacto actualizado");
        fetchAdminData();
        return true;
      }
      return false;
    } catch (e) {
      notify("Error", "error");
      return false;
    }
  };

  const adminResetStorePass = async (storeId, newPassword) => {
    try {
      await fetch(`${API_URL}/admin/store/${storeId}/password`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ newPassword }),
      });
      notify("Clave de tienda restablecida");
    } catch (e) {
      notify("Error", "error");
    }
  };

  const updateSuperAdminContact = async (newNumber) => {
    try {
      await fetch(`${API_URL}/admin/config/contact`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ whatsapp: newNumber }),
      });
      setSuperAdminContact(newNumber);
      notify("Soporte actualizado");
    } catch (e) {
      notify("Error", "error");
    }
  };

  const updateAdminPass = async (password) => {
    await fetch(`${API_URL}/admin/password`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ password }),
    });
    notify("Contraseña actualizada");
  };

  const logout = () => {
    setCurrentUser(null);
    setToken(null);
    setMyStore(null);
    setMyProducts([]);
    setAdminData(null);
    notify("Sesión cerrada");
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        loading,
        myStore,
        myProducts,
        adminData,
        superAdminContact,
        provinces,
        provincesError,
        loadProvinces,
        loginStore,
        registerStore,
        saveProduct,
        deleteProduct,
        updateStoreSettings,
        loginSuperAdmin,
        fetchAdminData,
        generateCode,
        toggleStore,
        deleteStore,
        updateAdminPass,
        adminResetStorePass,
        adminUpdateStoreContact,
        updateSuperAdminContact,
        getStoreById,
        deleteCode,
        logout,
      }}
    >
      {/* El LoadingOverlay se renderiza aquí para estar por encima de todo */}
      {loading && <LoadingOverlay />}
      {children}
    </AppContext.Provider>
  );
};

// --- COMPONENTES UI REUTILIZABLES ---
// (SafeImage vive en ./shared.js y se importa arriba)

const Button = ({ children, onClick, className = "", ...props }) => (
  <button
    onClick={onClick}
    className={`px-4 py-3.5 rounded-2xl font-bold active:scale-95 flex items-center justify-center gap-2 shadow-glow text-sm bg-gradient-to-r from-cyan-600 to-sky-600 text-white hover:from-cyan-500 hover:to-sky-500 transition-all ${className}`}
    {...props}
  >
    {children}
  </button>
);

const Input = ({ label, ...props }) => (
  <div className="mb-4">
    <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1 uppercase tracking-wider">
      {label}
    </label>
    <input
      className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-white text-slate-900 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 outline-none transition-all placeholder:text-slate-500"
      {...props}
    />
  </div>
);

const Card = ({ children, className = "" }) => (
  <div
    className={`bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden backdrop-blur-sm ${className}`}
  >
    {children}
  </div>
);

const ImageGallery = ({ imagesStr }) => {
  const imgs = parseImages(imagesStr);
  const [idx, setIdx] = useState(0);
  if (imgs.length === 0)
    return (
      <div className="aspect-square bg-sky-100 flex items-center justify-center border-b border-sky-100">
        <ImageIcon size={48} className="text-slate-700" />
      </div>
    );
  return (
    <div className="relative group bg-sky-50">
      <div className="aspect-square overflow-hidden">
        <SafeImage
          src={imgs[idx]}
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
        />
      </div>
      {imgs.length > 1 && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2 p-2 z-10">
          {imgs.map((_, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                setIdx(i);
              }}
              className={`w-2 h-2 rounded-full shadow-lg transition-all ${i === idx ? "bg-cyan-500 w-6" : "bg-white/50 hover:bg-white"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// --- VISTAS ---
// --- COMPONENTE DEL MANUAL ---
// Componente Manual - Alineado a la Izquierda
const ManualModal = ({ onClose, contact }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-sky-950/60 backdrop-blur-sm animate-fade-in">
    <div className="bg-white w-full max-w-2xl max-h-[85vh] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col ring-1 ring-slate-200">
      {/* Cabecera */}
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-sky-50">
        <h2 className="font-display text-xl font-bold text-slate-900 flex items-center gap-2">
          <BookOpen className="text-cyan-700" /> Manual de Vendedor
        </h2>
        <button
          onClick={onClose}
          className="p-2 bg-sky-50 rounded-full text-slate-500 hover:text-slate-800"
        >
          <X size={20} />
        </button>
      </div>

      {/* Contenido - Alineado a la Izquierda */}
      <div className="p-6 overflow-y-auto space-y-6 text-slate-600 leading-relaxed text-left">
        {" "}
        {/* <--- text-left */}
        <section>
          <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
            🔐 1. Registro
          </h3>
          <ul className="list-disc pl-5 space-y-1 text-sm marker:text-cyan-600">
            <li>
              Pide tu <strong>Código de Licencia</strong> al administrador.
            </li>
            <li>
              Toca en <strong>"Soy Vendedor"</strong> y luego en{" "}
              <strong>"Regístrate"</strong>.
            </li>
            <li>
              Usa tu número de WhatsApp real (sin el +), ahí te llegarán los
              pedidos.
            </li>
            <li className="text-amber-600 font-medium pt-1">
              Si no tienes código de licencia contacta al:{" "}
              {formatPhone(contact) || contact}
            </li>
          </ul>
        </section>
        <section>
          <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
            ⚙️ 2. Configuración Inicial
          </h3>
          <p className="text-sm mb-2 text-slate-500">
            Ve a la pestaña <strong>Ajustes</strong> (⚙️) abajo a la derecha:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-sm marker:text-cyan-600">
            <li>
              <strong>Ubicación:</strong> Selecciona tu Provincia (¡Vital para
              que te encuentren!).
            </li>
            <li>
              <strong>Logo:</strong> Sube una foto de tu marca.
            </li>
            <li>
              <strong>Mercado Global:</strong> Activa la casilla para aparecer
              en el buscador público.
            </li>
          </ul>
        </section>
        <section>
          <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
            📸 3. Subir Productos
          </h3>
          <p className="text-sm mb-2 text-slate-500">
            Ve a la pestaña <strong>Productos</strong> (Productos):
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm marker:text-cyan-600">
            <li>
              Toca el botón <strong>(+) Azul</strong>.
            </li>
            <li>Pon nombre, precio (CUP/USD) y fotos.</li>
            <li className="text-emerald-600 font-bold">
              ¡Listo! Ya está visible en la vista general.
            </li>
            <li>Recuerda que puedes editar o eliminar productos cuando quieras.</li>
            <li>También puedes publicar tú copiando el enlace de tu tienda y compartiéndolo en tus redes sociales o grupos de WhatsApp para atraer más clientes.</li>
          </ul>
        </section>
        <section>
          <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
            🚀 4. Recibir Pedidos
          </h3>
          <div className="bg-sky-50 p-4 rounded-l-md border-l-4 border-cyan-500 text-sm">
            <p>
              Cuando un cliente toca <strong>"PEDIR"</strong>, se abrirá tu
              WhatsApp automáticamente con el mensaje del producto. Tú cierras
              la venta por chat privado.
            </p>
          </div>
        </section>
      </div>

      {/* Pie del Manual */}
      <div className="p-4 border-t border-slate-200 bg-sky-50 flex flex-col gap-3">
        <p className="text-xs text-center text-slate-500">
          Soporte Técnico:{" "}
          <span className="text-slate-600 font-bold">
            {formatPhone(contact) || contact}
          </span>
        </p>
        <button
          onClick={onClose}
          className="bg-gradient-to-r from-cyan-600 to-sky-600 text-white px-8 py-3 rounded-2xl font-bold w-full hover:from-cyan-500 hover:to-sky-500 transition-colors shadow-glow"
        >
          ¡Entendido, quiero empezar!
        </button>
      </div>
    </div>
  </div>
);

const LandingPage = () => {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const { superAdminContact } = useContext(AppContext);
  const [showManual, setShowManual] = useState(false);
  const [stores, setStores] = useState([]);
  const [storesError, setStoresError] = useState(false);
  const [featured, setFeatured] = useState([]);
  const [productsTotal, setProductsTotal] = useState(null);
  const [detailProduct, setDetailProduct] = useState(null);
  const [covers, setCovers] = useState({});
  // Buscador y "Cargar más" de tiendas (12 por tanda).
  const [storeQuery, setStoreQuery] = useState("");
  const [storesVisible, setStoresVisible] = useState(12);

  const loadLandingData = async () => {
    setStoresError(false);
    try {
      // ?slim=1: sin logos en base64 (la portada no los usa).
      const res = await fetch(`${API_URL}/public/stores?slim=1`);
      if (!res.ok) throw new Error("No se pudieron cargar las tiendas");
      const data = await res.json();
      setStores(Array.isArray(data) ? data : []);
    } catch (e) {
      setStores([]);
      setStoresError(true);
    }
    try {
      // Vitrina ligera: conteos exactos, 6 destacados y portadas
      // (solo la primera foto de cada uno). Antes se descargaba
      // all-products entero (~4,9 MB) solo para esto.
      const res = await fetch(`${API_URL}/public/landing`);
      if (!res.ok) throw new Error("No se pudieron cargar los productos");
      const data = await res.json();
      setFeatured(Array.isArray(data.featured) ? data.featured : []);
      setProductsTotal(
        data.products === undefined || data.products === null
          ? null
          : String(data.products),
      );
      // Portada de cada tienda: la foto de su primer producto.
      setCovers(data.covers || {});
    } catch (e) {
      setFeatured([]);
      setProductsTotal(null);
    }
  };

  useEffect(() => {
    loadLandingData();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const val = input.trim().toLowerCase().replace(/\s+/g, "-");
    if (!val) return;
    // Si el slug exacto existe, entrar directo. Si no, filtrar la lista
    // de tiendas de esta misma página (antes iba a "Tienda no encontrada"
    // con solo escribir el nombre, p. ej. "Moda Las Tunas").
    const exact = stores.find((s) => storeSlug(s) === val);
    if (exact) {
      navigate(`/${storeSlug(exact)}`);
      return;
    }
    setStoreQuery(input.trim());
    setStoresVisible(12);
    document
      .getElementById("tiendas-en-el-mercado")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  const storeSlug = (s) =>
    s.slug || (s.name || "").toLowerCase().trim().replace(/\s+/g, "-");

  // Tiendas filtradas por el buscador (nombre, provincia o slug).
  const storeQueryNorm = storeQuery.trim().toLowerCase();
  const filteredStores = stores.filter(
    (s) =>
      !storeQueryNorm ||
      (s.name || "").toLowerCase().includes(storeQueryNorm) ||
      (s.province_name || "").toLowerCase().includes(storeQueryNorm) ||
      storeSlug(s).includes(storeQueryNorm),
  );
  const visibleStores = filteredStores.slice(0, storesVisible);

  const licenseUrl = superAdminContact
    ? waLink(superAdminContact, "Hola, solicito una licencia")
    : "";

  return (
    <div className="min-h-screen bg-[#F2FBFC]">
      {/* --- HERO con foto de La Habana --- */}
      <div className="relative overflow-hidden">
        <img
          src={CUBA_HERO}
          alt="La Habana desde el Malecón, Cuba"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-sky-950/75 via-sky-900/45 to-[#F2FBFC]" />
        <div className="relative w-full max-w-5xl mx-auto px-4 pt-9 pb-16 text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/15 px-4 py-1.5 text-xs font-bold text-white backdrop-blur">
            <Sparkles size={14} className="text-amber-300" /> El marketplace
            de Cuba
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-extrabold text-white tracking-tight leading-[1.05] mt-6">
            Mercado{" "}
            <span className="text-gradient-cuba animate-gradient-x">Cuba</span>
          </h1>
          <p className="text-xl sm:text-2xl text-white font-bold mt-3">
            Compra y vende en toda Cuba 🇨🇺
          </p>
          <p className="text-base text-sky-50 mt-4 leading-relaxed max-w-xl mx-auto">
            Todo en un solo lugar: precios en CUP y USD, y pides directo al
            vendedor por WhatsApp. Sin intermediarios, sin vueltas.
          </p>
          <p className="text-sm text-white font-bold mt-5">
            {stores.length > 0 || productsTotal !== null
              ? `${stores.length} tiendas · ${productsTotal ?? "…"} productos`
              : "Cargando el mercado..."}
          </p>
          {/* --- ACCIONES PRINCIPALES --- */}
          <div className="grid sm:grid-cols-2 gap-3 max-w-2xl mx-auto mt-7 text-left">
            <button
              onClick={() => navigate("/explorar")}
              className="sm:col-span-2 w-full bg-white text-sky-800 py-4 rounded-2xl text-base font-extrabold hover:bg-sky-50 transition-all flex items-center justify-center gap-2 shadow-xl active:scale-[0.98]"
            >
              <Grid size={20} /> Explorar Todo el Mercado
            </button>
            <button
              onClick={() => navigate("/login")}
              className="w-full bg-white/15 text-white py-3.5 rounded-2xl text-sm font-bold border border-white/50 hover:bg-white/25 transition-all flex items-center justify-center gap-2 backdrop-blur active:scale-[0.98]"
            >
              <User size={18} /> Soy Vendedor (Entrar)
            </button>
            <button
              onClick={() => setShowManual(true)}
              className="w-full bg-white/15 text-white py-3.5 rounded-2xl text-sm font-bold border border-white/50 hover:bg-white/25 transition-all flex items-center justify-center gap-2 backdrop-blur active:scale-[0.98]"
            >
              <FileText size={18} /> ¿Cómo funciona? (Guía)
            </button>
            {superAdminContact ? (
              <a
                href={licenseUrl}
                target="_blank"
                rel="noreferrer"
                className="sm:col-span-2 w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white py-4 rounded-2xl text-base font-extrabold hover:from-emerald-400 hover:to-green-500 transition-all flex items-center justify-center gap-2 text-center shadow-glow-green active:scale-[0.98]"
              >
                <MessageCircle size={20} /> Solicitar Licencia
              </a>
            ) : (
              <button
                disabled
                className="sm:col-span-2 w-full bg-white/10 text-white/60 py-4 rounded-2xl text-sm font-bold border border-white/20 flex items-center justify-center gap-2"
              >
                <MessageCircle size={18} /> Cargando contacto...
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="w-full max-w-5xl mx-auto px-4 py-10 space-y-10 sm:space-y-14">

        {/* --- ¿POR QUÉ USAR MERCADO CUBA? --- */}
        <div className="animate-fade-in-up">
          <div className="text-center mb-6">
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              ¿Por qué usar Mercado Cuba?
            </h2>
            <p className="text-sm text-slate-500 mt-2 max-w-lg mx-auto leading-relaxed">
              El mercado entero en tu bolsillo: para comprar sin vueltas y
              para vender en toda la isla.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Para comprar */}
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-600 to-sky-600 flex items-center justify-center shadow-glow shrink-0">
                  <ShoppingBag className="text-white" size={22} />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-900 leading-tight">
                    Para comprar
                  </h3>
                  <p className="text-xs text-slate-500">
                    Encuentra lo que buscas, sin salir de aquí
                  </p>
                </div>
              </div>
              <ul className="space-y-4">
                <li className="flex gap-3">
                  <span className="w-9 h-9 shrink-0 rounded-xl bg-cyan-600/15 border border-cyan-500/20 flex items-center justify-center">
                    <Search size={17} className="text-cyan-700" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      Todo en un solo lugar
                    </p>
                    <p className="text-sm text-slate-500">
                      Tiendas de todas las provincias en una sola pantalla.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="w-9 h-9 shrink-0 rounded-xl bg-cyan-600/15 border border-cyan-500/20 flex items-center justify-center">
                    <Wallet size={17} className="text-cyan-700" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      Precios claros en CUP y USD
                    </p>
                    <p className="text-sm text-slate-500">
                      Ves el precio en las dos monedas antes de escribir.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="w-9 h-9 shrink-0 rounded-xl bg-cyan-600/15 border border-cyan-500/20 flex items-center justify-center">
                    <MessageCircle size={17} className="text-cyan-700" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      Pides directo por WhatsApp
                    </p>
                    <p className="text-sm text-slate-500">
                      Hablas con el vendedor, sin intermediarios ni
                      comisiones.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="w-9 h-9 shrink-0 rounded-xl bg-cyan-600/15 border border-cyan-500/20 flex items-center justify-center">
                    <ShieldCheck size={17} className="text-cyan-700" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      Tú cuadras la entrega
                    </p>
                    <p className="text-sm text-slate-500">
                      Acuerdas entrega y pago directo con la tienda.
                    </p>
                  </div>
                </li>
              </ul>
              <button
                onClick={() => navigate("/explorar")}
                className="mt-6 w-full bg-sky-50 text-slate-900 py-3.5 rounded-2xl text-sm font-bold border border-slate-200 hover:bg-sky-100 transition-all flex items-center justify-center gap-2"
              >
                Explorar el mercado <ArrowRight size={16} />
              </button>
            </Card>
            {/* Para vender */}
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-glow-green shrink-0">
                  <Store className="text-white" size={22} />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-900 leading-tight">
                    Para vender
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tu negocio visible en toda Cuba
                  </p>
                </div>
              </div>
              <ul className="space-y-4">
                <li className="flex gap-3">
                  <span className="w-9 h-9 shrink-0 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                    <BadgeCheck size={17} className="text-emerald-600" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      Tu tienda con su propio enlace
                    </p>
                    <p className="text-sm text-slate-500">
                      Una página solo para ti, lista para compartir en
                      WhatsApp y redes.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="w-9 h-9 shrink-0 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                    <Globe size={17} className="text-emerald-600" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      Te ven en toda Cuba
                    </p>
                    <p className="text-sm text-slate-500">
                      Apareces en el mercado y por provincia, no solo en tu
                      barrio.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="w-9 h-9 shrink-0 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                    <Zap size={17} className="text-emerald-600" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      Pedidos directos a tu WhatsApp
                    </p>
                    <p className="text-sm text-slate-500">
                      El cliente te escribe con el producto ya elegido.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="w-9 h-9 shrink-0 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                    <CheckCircle size={17} className="text-emerald-600" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      Sin crear una web
                    </p>
                    <p className="text-sm text-slate-500">
                      Sin programar nada: subes fotos y precios, y a vender.
                      Solo pagas una licencia.
                    </p>
                  </div>
                </li>
              </ul>
              {superAdminContact ? (
                <a
                  href={licenseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white py-3.5 rounded-2xl text-sm font-bold hover:from-emerald-400 hover:to-green-500 transition-all flex items-center justify-center gap-2 text-center shadow-glow-green"
                >
                  <MessageCircle size={18} /> Solicitar licencia
                </a>
              ) : (
                <button
                  disabled
                  className="mt-6 w-full bg-emerald-100 text-emerald-700/60 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
                >
                  <MessageCircle size={18} /> Cargando contacto...
                </button>
              )}
            </Card>
          </div>
        </div>

        {/* --- CÓMO FUNCIONA --- */}
        <Card className="p-6 sm:p-8">
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-slate-900 mb-1 text-center tracking-tight">
            ¿Cómo funciona?
          </h2>
          <p className="text-sm text-slate-500 text-center mb-6">
            Comprar es así de simple
          </p>
          <ol className="grid sm:grid-cols-3 gap-4 text-sm text-slate-600">
            <li className="rounded-2xl bg-sky-50 border border-sky-100 p-4 text-center">
              <span className="w-10 h-10 mx-auto rounded-full bg-gradient-to-br from-cyan-600 to-sky-600 text-white text-sm font-black flex items-center justify-center shadow-glow">
                1
              </span>
              <p className="font-bold text-slate-900 mt-3">Busca</p>
              <p className="text-slate-500 mt-1">
                Lo que te hace falta, por tienda o por provincia.
              </p>
            </li>
            <li className="rounded-2xl bg-sky-50 border border-sky-100 p-4 text-center">
              <span className="w-10 h-10 mx-auto rounded-full bg-gradient-to-br from-cyan-600 to-sky-600 text-white text-sm font-black flex items-center justify-center shadow-glow">
                2
              </span>
              <p className="font-bold text-slate-900 mt-3">Pide</p>
              <p className="text-slate-500 mt-1">
                Toca “Pedir” y se abre WhatsApp con el mensaje ya listo.
              </p>
            </li>
            <li className="rounded-2xl bg-sky-50 border border-sky-100 p-4 text-center">
              <span className="w-10 h-10 mx-auto rounded-full bg-gradient-to-br from-cyan-600 to-sky-600 text-white text-sm font-black flex items-center justify-center shadow-glow">
                3
              </span>
              <p className="font-bold text-slate-900 mt-3">Cuadra</p>
              <p className="text-slate-500 mt-1">
                Acuerda con el vendedor la entrega y el pago, directo y sin
                vueltas.
              </p>
            </li>
          </ol>
        </Card>

        {/* --- PRODUCTOS DESTACADOS --- */}
        {featured.length > 0 && (
          <div className="animate-fade-in-up">
            <div className="flex items-end justify-between gap-3 mb-1">
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Destacados del mercado
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Lo que se está moviendo hoy en la isla
                </p>
              </div>
              <button
                onClick={() => navigate("/explorar")}
                className="text-xs font-bold text-cyan-700 hover:text-cyan-700 flex items-center gap-1 shrink-0"
              >
                Ver todo <ArrowRight size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mt-3">
              {featured.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setDetailProduct(p)}
                  className="group bg-white rounded-3xl overflow-hidden border border-slate-200 text-left shadow-xl transition-all hover:-translate-y-1 hover:shadow-2xl hover:border-cyan-300 active:scale-[0.98]"
                >
                  <div className="aspect-square bg-sky-50 overflow-hidden relative">
                    <SafeImage
                      src={parseImages(p.image_url)[0]}
                      alt={cleanName(p.name)}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {Number(p.stock) === 0 && (
                      <span className="absolute top-2 left-2 bg-rose-600 text-white text-[11px] font-bold px-2 py-1 rounded-full">
                        Agotado
                      </span>
                    )}
                  </div>
                  <div className="p-3 sm:p-4">
                    <p className="text-sm font-bold text-slate-900 line-clamp-2">
                      {cleanName(p.name)}
                    </p>
                    <p className="text-sm text-cyan-700 font-black mt-1">
                      {priceLabel(p)}
                    </p>
                    {p.store_name && (
                      <p className="text-[11px] text-slate-500 truncate mt-1 flex items-center gap-1">
                        <Store size={11} className="shrink-0" />{" "}
                        {p.store_name}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 items-start">
        {/* --- BUSCAR TIENDA --- */}
        <Card className="p-6 border-t-4 border-cyan-600">
          <h2 className="font-display font-bold text-slate-900 mb-4 flex gap-2 items-center text-lg tracking-tight">
            <Store className="text-cyan-700" size={20} /> Buscar Tienda
          </h2>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-900 rounded-2xl text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 transition-all placeholder:text-slate-500"
              placeholder="ej: modas-habana"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button className="bg-gradient-to-r from-cyan-600 to-sky-600 text-white p-3 rounded-2xl hover:from-cyan-500 hover:to-sky-500 transition-all shadow-glow">
              <ArrowRight size={20} />
            </button>
          </form>
          <p className="text-xs text-slate-500 mt-3">
            Escribe el nombre de la tienda y entra directo a ver sus
            productos.
          </p>
          {storesError && (
            <div className="mt-4 text-center">
              <p className="text-xs text-slate-500 mb-2">
                No se pudieron cargar las tiendas.
              </p>
              <button
                onClick={loadLandingData}
                className="text-xs text-cyan-700 font-bold underline"
              >
                Reintentar
              </button>
            </div>
          )}
        </Card>

        {/* --- VENDE TU TIENDA --- */}
        <Card className="p-6 border-t-4 border-emerald-600">
          <h2 className="font-display font-bold text-slate-900 mb-1 text-lg tracking-tight">
            Pon tu tienda en toda Cuba
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Tus productos frente a compradores de toda la isla.
          </p>
          <ul className="space-y-2 text-sm text-slate-600 mb-5">
            <li className="flex gap-2">
              <CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              Tu tienda con su propio enlace, lista para compartir
            </li>
            <li className="flex gap-2">
              <CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              Pedidos directos por WhatsApp, sin intermediarios
            </li>
            <li className="flex gap-2">
              <CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              Te ven en el mercado global y por provincia
            </li>
            <li className="flex gap-2">
              <CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              Sube tus productos con fotos y precios en CUP y USD
            </li>
          </ul>
          {superAdminContact ? (
            <a
              href={licenseUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white py-3.5 rounded-2xl text-sm font-bold hover:from-emerald-400 hover:to-green-500 transition-all flex items-center justify-center gap-2 text-center shadow-glow-green"
            >
              <MessageCircle size={18} /> Solicitar licencia
            </a>
          ) : (
            <button
              disabled
              className="w-full bg-emerald-100 text-emerald-700/60 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
            >
              <MessageCircle size={18} /> Cargando contacto...
            </button>
          )}
          <p className="text-xs text-slate-500 mt-3 text-center">
            Precio y duración: consúltalos por WhatsApp.
          </p>
        </Card>
        </div>

        {/* --- TIENDAS EN EL MERCADO (con foto de portada) --- */}
        {stores.length > 0 && (
          <div className="animate-fade-in-up" id="tiendas-en-el-mercado">
            <div className="flex items-end justify-between gap-3 mb-3">
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Tiendas en el mercado
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Toca una tienda para ver sus productos
                </p>
              </div>
            </div>
            <div className="relative mb-3">
              <Search
                size={17}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
              />
              <input
                type="text"
                placeholder="Buscar tienda por nombre o provincia..."
                value={storeQuery}
                onChange={(e) => {
                  setStoreQuery(e.target.value);
                  setStoresVisible(12);
                }}
                className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-900 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 outline-none transition-all placeholder:text-slate-500 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {visibleStores.map((s) => {
                const cover = covers[storeSlug(s)] || CUBA_HERO;
                return (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/${storeSlug(s)}`)}
                    className="group relative rounded-3xl overflow-hidden aspect-[4/3] text-left shadow-card active:scale-[0.98] transition-all"
                  >
                    <img
                      src={cover}
                      alt={cleanName(s.name)}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-sky-950/85 via-sky-950/25 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-sm font-bold text-white leading-tight line-clamp-2">
                        {cleanName(s.name)}
                      </p>
                      {s.province_name && (
                        <p className="text-[11px] text-sky-100 font-medium mt-0.5 flex items-center gap-1">
                          <MapPin size={11} /> {s.province_name}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            {filteredStores.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-8">
                No hay tiendas que coincidan con la búsqueda.
              </p>
            )}
            {filteredStores.length > 0 && (
              <div className="text-center mt-4 space-y-3">
                <p className="text-xs text-slate-500">
                  Mostrando {visibleStores.length} de {filteredStores.length}{" "}
                  tiendas
                </p>
                {storesVisible < filteredStores.length && (
                  <button
                    onClick={() => setStoresVisible((c) => c + 12)}
                    className="bg-white text-slate-700 px-6 py-3 rounded-2xl text-sm font-bold border border-slate-200 hover:bg-sky-100 transition-all"
                  >
                    Cargar más
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* --- PIE --- */}
        <footer className="text-center space-y-2 pt-6 pb-4 border-t border-sky-100">
          <p className="text-xs text-slate-500 font-bold">
            {APP_NAME} — de cubanos para cubanos 🇨🇺
          </p>
          {superAdminContact ? (
            <a
              href={licenseUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-emerald-600 hover:text-emerald-600 font-bold inline-flex items-center gap-1"
            >
              <MessageCircle size={12} /> Escríbenos por WhatsApp
            </a>
          ) : (
            <p className="text-xs text-slate-400">Cargando contacto...</p>
          )}
          <p>
            <Link
              to="/admin/login"
              className="text-xs text-slate-400 hover:text-slate-500"
            >
              Acceso administrador
            </Link>
          </p>
        </footer>
      </div>
      {showManual && (
        <ManualModal
          onClose={() => setShowManual(false)}
          contact={superAdminContact}
        />
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

const StoreFrontend = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loadingStore, setLoadingStore] = useState(true);
  const [storeError, setStoreError] = useState(false);
  const [filter, setFilter] = useState("");
  const [detailProduct, setDetailProduct] = useState(null);
  const [visibleCount, setVisibleCount] = useState(12);

  // Al cambiar de tienda o de búsqueda, se vuelve a mostrar desde arriba.
  useEffect(() => {
    setVisibleCount(12);
  }, [slug, filter]);

  useEffect(() => {
    setLoadingStore(true);
    setStoreError(false);
    fetch(`${API_URL}/store/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error("Tienda no encontrada");
        return res.json();
      })
      .then((d) => {
        setData(d);
        setLoadingStore(false);
      })
      .catch(() => {
        setStoreError(true);
        setLoadingStore(false);
      });
  }, [slug]);

  if (loadingStore) {
    return (
      <div className="min-h-screen bg-[#F2FBFC] flex flex-col items-center justify-center gap-4 p-4 animate-fade-in">
        <Loader2 className="animate-spin text-cyan-700" size={40} />
        <p className="text-slate-500 text-sm font-bold">Cargando tienda...</p>
        <div className="w-full max-w-md space-y-3 mt-4">
          <div className="h-10 bg-white rounded-2xl animate-pulse" />
          <div className="grid grid-cols-2 gap-3">
            <div className="aspect-square bg-white rounded-2xl animate-pulse" />
            <div className="aspect-square bg-white rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (storeError || !data || !data.store) {
    return (
      <div className="min-h-screen bg-[#F2FBFC] flex items-center justify-center p-4">
        <Card className="p-8 max-w-sm w-full text-center space-y-4">
          <Store className="text-slate-600 mx-auto" size={48} />
          <h2 className="font-display text-xl font-bold text-slate-900">
            Tienda no encontrada
          </h2>
          <p className="text-sm text-slate-500">
            Esta tienda no existe o ya no está disponible.
          </p>
          <Button onClick={() => navigate("/")} className="w-full">
            Volver al inicio
          </Button>
        </Card>
      </div>
    );
  }

  const { store, products } = data;
  const visibleProducts = (Array.isArray(products) ? products : []).filter(
    (p) => p.is_visible !== false,
  );
  const filtered = visibleProducts.filter((p) =>
    (p.name || "").toLowerCase().includes(filter.toLowerCase()),
  );
  const provinceName = store.province_name || store.province || "";
  const coverImage = firstProductImage(visibleProducts) || CUBA_HERO;

  const contact = (p) => {
    window.open(
      waLink(
        store.whatsapp,
        orderMessage({
          name: p.name,
          prices: priceLabel(p),
          storeName: store.name,
          province: provinceName,
          slug: store.slug,
        }),
      ),
      "_blank",
    );
  };

  return (
    <div className="min-h-screen bg-[#F2FBFC] pb-20">
      <div className="sticky top-0 bg-white/95 backdrop-blur-md z-30 px-4 py-3 border-b border-sky-100 flex items-center gap-3 shadow-sm">
        <button
          onClick={() => navigate("/")}
          className="p-2 -ml-2 rounded-full hover:bg-sky-50 text-slate-500"
        >
          <ChevronLeft />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-bold text-lg truncate text-slate-900">
            {cleanName(store.name)}
          </h1>
        </div>
        <button
          onClick={() => navigate("/explorar")}
          className="text-xs font-bold text-cyan-700 hover:text-cyan-600 shrink-0"
        >
          Mercado
        </button>
      </div>
      {/* Portada de la tienda: foto de su primer producto */}
      <div className="relative h-48 sm:h-60 overflow-hidden">
        <img
          src={coverImage}
          alt={cleanName(store.name)}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-sky-950/85 via-sky-950/25 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end gap-3">
          <div className="w-14 h-14 rounded-2xl ring-2 ring-white/70 bg-white overflow-hidden shrink-0 shadow-lg">
            <SafeImage
              src={store.logo_url}
              alt={cleanName(store.name)}
              className="w-full h-full object-cover"
              fallbackIcon={Store}
            />
          </div>
          <div className="min-w-0">
            <h2 className="font-display font-extrabold text-2xl text-white leading-tight truncate">
              {cleanName(store.name)}
            </h2>
            {provinceName && (
              <p className="text-xs text-sky-100 font-medium flex items-center gap-1 mt-0.5">
                <MapPin size={12} /> {provinceName}
              </p>
            )}
          </div>
        </div>
      </div>
      {(store.description || store.owner_name || provinceName) && (
        <div className="px-4 pt-4">
          <Card className="p-4 space-y-1">
            {store.description && (
              <p className="text-sm text-slate-600">{store.description}</p>
            )}
            {store.owner_name && (
              <p className="text-xs text-slate-500">
                Dueño: {store.owner_name}
              </p>
            )}
            {provinceName && (
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <MapPin size={12} /> {provinceName}
              </p>
            )}
            {store.whatsapp && (
              <p className="text-xs text-slate-500">
                WhatsApp: {formatPhone(store.whatsapp)}
              </p>
            )}
          </Card>
        </div>
      )}
      {store.whatsapp && (
        <div className="px-4 pt-3">
          <a
            href={waLink(
              store.whatsapp,
              `Hola, vi tu tienda ${store.name} en Mercado Cuba: https://mercado-cuba.pages.dev/${store.slug}`,
            )}
            target="_blank"
            rel="noreferrer"
            className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white py-3 rounded-2xl text-sm font-bold hover:from-emerald-400 hover:to-green-500 transition-all flex items-center justify-center gap-2 shadow-glow-green"
          >
            <MessageCircle size={18} /> Escribir a la tienda
          </a>
        </div>
      )}
      <div className="p-4">
        <input
          className="w-full pl-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 transition-all placeholder:text-slate-500"
          placeholder="Buscar productos..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      {filtered.length === 0 && (
        <div className="text-center py-16 px-6">
          <ShoppingBag size={48} className="mx-auto mb-4 text-slate-400" />
          <p className="text-sm text-slate-500">
            {filter
              ? "No encontramos eso por aquí, prueba con otra palabra."
              : "Esta tienda todavía no tiene productos a la venta."}
          </p>
        </div>
      )}
      <div className="px-4 pb-4 grid grid-cols-2 gap-3">
        {filtered.slice(0, visibleCount).map((p) => {
          const isOut = Number(p.stock) === 0;
          const hasPrice =
            Number(p.price_cup) > 0 || Number(p.price_usd) > 0;
          return (
          <div
            key={p.id}
            onClick={() => setDetailProduct(p)}
            className="group bg-white rounded-3xl overflow-hidden shadow-xl border border-slate-200 flex flex-col cursor-pointer transition-all hover:-translate-y-1 hover:shadow-2xl hover:border-cyan-300 active:scale-[0.98]"
          >
            <div className="relative">
              <ImageGallery imagesStr={p.image_url} />
              {isOut && (
                <span className="absolute top-2 left-2 bg-rose-600 text-white text-[11px] font-bold px-2 py-1 rounded-full z-10">
                  Agotado
                </span>
              )}
            </div>
            <div className="p-3 flex-1 flex flex-col">
              <h3 className="text-sm font-bold text-slate-900 line-clamp-2 mb-2">
                {cleanName(p.name)}
              </h3>
              <div className="mt-auto flex flex-col gap-1.5">
                <div className="flex flex-wrap gap-1 items-baseline">
                  {Number(p.price_cup) > 0 && (
                    <span className="font-black text-slate-900 text-sm">
                      {formatPrice(p.price_cup, "CUP")}
                    </span>
                  )}
                  {Number(p.price_usd) > 0 && (
                    <span className="font-bold text-emerald-600 text-xs bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-lg ml-auto">
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
                    className="w-full mt-1 bg-slate-100 border border-slate-200 text-slate-500 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    Agotado
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      contact(p);
                    }}
                    className="w-full mt-1 bg-gradient-to-r from-cyan-600 to-sky-600 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-glow"
                  >
                    <MessageCircle size={14} /> Pedir
                  </button>
                )}
              </div>
            </div>
          </div>
          );
        })}
      </div>
      {filtered.length > 0 && (
        <div className="px-4 pb-4 text-center space-y-3">
          <p className="text-xs text-slate-500">
            Mostrando {Math.min(visibleCount, filtered.length)} de{" "}
            {filtered.length} productos
          </p>
          {visibleCount < filtered.length && (
            <button
              onClick={() => setVisibleCount((c) => c + 12)}
              className="bg-white text-slate-700 px-6 py-3 rounded-2xl text-sm font-bold border border-slate-200 hover:bg-sky-100 transition-all"
            >
              Cargar más
            </button>
          )}
        </div>
      )}
      {detailProduct && (
        <ProductDetailModal
          product={detailProduct}
          store={store}
          onClose={() => setDetailProduct(null)}
        />
      )}
    </div>
  );
};

const AuthScreen = ({ mode }) => {
  const navigate = useNavigate();
  const {
    loginStore,
    registerStore,
    loginSuperAdmin,
    currentUser,
    superAdminContact,
  } = useContext(AppContext);
  const [currMode, setCurrMode] = useState(mode);
  const [form, setForm] = useState({
    whatsapp: "",
    password: "",
    code: "",
    name: "",
    owner: "",
  });

  useEffect(() => {
    if (currentUser?.role === "vendor") navigate("/dashboard");
    if (currentUser?.role === "superadmin") navigate("/admin/panel");
  }, [currentUser, navigate]);

  const submit = (e) => {
    e.preventDefault();
    if (currMode === "login") loginStore(form.whatsapp, form.password);
    else if (currMode === "register")
      registerStore(
        { name: form.name, whatsapp: form.whatsapp, ownerName: form.owner },
        form.code,
        form.password,
      );
    else loginSuperAdmin(form.password);
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <button
          onClick={() => navigate("/")}
          className="mb-6 flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ChevronLeft size={20} /> Volver
        </button>
        <Card className="p-8">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-6 uppercase tracking-widest">
            {currMode === "login"
              ? "Bienvenido"
              : currMode === "register"
                ? "Registro"
                : "Admin"}
          </h2>
          {currMode === "register" && (
            <div className="mb-5 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <h3 className="text-sm font-bold text-emerald-600 mb-2">
                ¿Qué incluye la licencia?
              </h3>
              <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
                <li>Tu tienda con su propio enlace, lista para compartir</li>
                <li>Pedidos directos por WhatsApp, sin intermediarios</li>
                <li>Te ven en el mercado global y por provincia</li>
              </ul>
              <p className="text-xs text-slate-500 mt-2">
                Precio y duración: consúltalos por WhatsApp. Necesitas el
                código de licencia para crear tu tienda.
              </p>
            </div>
          )}
          <form onSubmit={submit} className="space-y-4">
            {currMode !== "admin" && (
              <Input
                label="WhatsApp (Sin +)"
                type="number"
                required
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              />
            )}
            {currMode === "register" && (
              <>
                <Input
                  label="Código de Licencia"
                  required
                  value={form.code}
                  onChange={(e) =>
                    setForm({ ...form, code: e.target.value.toUpperCase() })
                  }
                />
                <Input
                  label="Nombre Tienda"
                  required
                  value={form.name || ""} // Si es undefined o null, usa ""
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <Input
                  label="Dueño"
                  required
                  value={form.owner || ""}
                  onChange={(e) => setForm({ ...form, owner: e.target.value })}
                />
              </>
            )}
            <Input
              label="Contraseña"
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <Button type="submit" className="w-full py-4 text-base uppercase">
              {currMode === "register" ? "Crear Mi Tienda" : "Entrar"}
            </Button>
          </form>
          <div className="mt-6 text-center space-y-3">
            {currMode === "login" && (
              <>
                <button
                  onClick={() => setCurrMode("register")}
                  className="text-cyan-700 text-sm block w-full hover:text-cyan-700"
                >
                  ¿Eres nuevo? Regístrate
                </button>
                {superAdminContact && (
                  <a
                    href={waLink(
                      superAdminContact,
                      `Olvidé la contraseña de mi tienda (WhatsApp: ${form.whatsapp || "sin indicar"})`,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-500 text-sm block w-full hover:text-slate-800"
                  >
                    ¿Olvidaste tu contraseña? Escríbele al administrador
                  </a>
                )}
              </>
            )}
            {currMode === "register" &&
              (superAdminContact ? (
                <a
                  href={waLink(superAdminContact, "Necesito código")}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-600 text-sm block w-full hover:text-emerald-600 flex justify-center gap-1 items-center"
                >
                  <MessageCircle size={14} /> Pedir licencia
                </a>
              ) : (
                <span className="text-emerald-600/50 text-sm block w-full flex justify-center gap-1 items-center">
                  <MessageCircle size={14} /> Cargando contacto...
                </span>
              ))}
            {currMode !== "login" && (
              <button
                onClick={() => setCurrMode("login")}
                className="text-slate-500 text-sm hover:text-slate-800"
              >
                Volver al Login
              </button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

const VendorDashboard = () => {
  const {
    myStore,
    myProducts,
    saveProduct,
    deleteProduct,
    updateStoreSettings,
    logout,
    provinces,
  } = useContext(AppContext);
  const { notify } = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState("prod");
  const [modal, setModal] = useState(false);
  const [editP, setEditP] = useState(null);
  const [formP, setFormP] = useState({});
  // Buscador y paginación de mis productos (10 por página).
  const [prodQuery, setProdQuery] = useState("");
  const [prodPage, setProdPage] = useState(1);

  const [formS, setFormS] = useState({
    name: myStore?.name || "",
    description: myStore?.description || "",
    logoUrl: myStore?.logo_url || "",
    whatsapp: myStore?.whatsapp || "",
    is_public_market: myStore?.is_public_market || false,
    province_id: myStore?.province_id || "",
  });

  // Sincroniza el formulario de Ajustes cuando la tienda llega
  // (p. ej. tras restaurar la sesión) o cambia al guardar.
  useEffect(() => {
    if (!myStore) return;
    setFormS({
      name: myStore.name || "",
      description: myStore.description || "",
      logoUrl: myStore.logo_url || "",
      whatsapp: myStore.whatsapp || "",
      is_public_market: !!myStore.is_public_market,
      province_id: myStore.province_id || "",
    });
  }, [myStore]);

  const openModal = (p) => {
    setEditP(p);
    setFormP(
      p
        ? {
            ...p,
            // El servidor guarda price_cup / price_usd; el formulario
            // usa priceCup / priceUsd. Sin este mapeo salían vacíos.
            priceCup: p.price_cup ?? p.priceCup ?? 0,
            priceUsd: p.price_usd ?? p.priceUsd ?? 0,
            category: p.category || "",
            stock: p.stock ?? 1,
            images: parseImages(p.image_url),
          }
        : {
            name: "",
            priceCup: 0,
            priceUsd: 0,
            category: "",
            images: [],
            stock: 1,
            is_visible: true,
          },
    );
    setModal(true);
  };

  const submitP = async (e) => {
    e.preventDefault();
    const cup = Number(formP.priceCup) || 0;
    const usd = Number(formP.priceUsd) || 0;
    if (cup <= 0 && usd <= 0) {
      notify("Pon al menos un precio (CUP o USD) para publicar el producto.");
      return;
    }
    // El cambio informal ronda ~400 CUP por USD: si la relación sale de
    // 100–1000, casi seguro un precio quedó mal escrito.
    if (cup > 0 && usd > 0) {
      const ratio = cup / usd;
      if (
        (ratio < 100 || ratio > 1000) &&
        !window.confirm(
          `Revisa los precios: ${cup} CUP por ${usd} USD suena raro (la tasa informal ronda 400 CUP por USD). ¿Guardar así de todas formas?`,
        )
      ) {
        return;
      }
    }
    await saveProduct(formP, !!editP);
    setModal(false);
  };

  // --- Buscador y paginación de mis productos ---
  const PRODUCTS_PER_PAGE = 10;
  const prodQueryNorm = prodQuery.trim().toLowerCase();
  const filteredProducts = (Array.isArray(myProducts)
    ? myProducts
    : []
  ).filter(
    (p) =>
      !prodQueryNorm ||
      (p.name || "").toLowerCase().includes(prodQueryNorm) ||
      (p.category || "").toLowerCase().includes(prodQueryNorm),
  );
  const prodTotalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE),
  );
  const prodPageSafe = Math.min(prodPage, prodTotalPages);
  const prodPageProducts = filteredProducts.slice(
    (prodPageSafe - 1) * PRODUCTS_PER_PAGE,
    prodPageSafe * PRODUCTS_PER_PAGE,
  );

  // Comprime una imagen con canvas: máx. 900 px en el lado mayor,
  // JPEG calidad 0.75. Una foto de teléfono de 2-4 MB queda en
  // ~100-200 KB, clave para datos lentos y caros en Cuba.
  const compressImage = (file) =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const maxSide = 900;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("No se pudo leer la imagen"));
      };
      img.src = url;
    });

  const handleImageUpload = async (e, target) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    const tooBig = files.filter((f) => f.size > 10 * 1024 * 1024);
    if (tooBig.length > 0) {
      notify("Foto muy grande", "error");
    }
    let okFiles = files.filter((f) => f.size <= 10 * 1024 * 1024);
    if (target === "product") {
      const slotsLeft = Math.max(0, 3 - (formP.images || []).length);
      if (okFiles.length > slotsLeft) {
        notify("Máximo 3 fotos por producto", "error");
        okFiles = okFiles.slice(0, slotsLeft);
      }
    } else {
      okFiles = okFiles.slice(0, 1);
    }
    if (okFiles.length === 0) return;
    try {
      const imgs = await Promise.all(okFiles.map(compressImage));
      if (target === "product")
        setFormP((prev) => ({
          ...prev,
          images: [...(prev.images || []), ...imgs],
        }));
      else setFormS((prev) => ({ ...prev, logoUrl: imgs[0] }));
    } catch (err) {
      notify("No se pudo procesar la foto", "error");
    }
  };

  return (
    <div className="min-h-screen bg-[#F2FBFC] pb-24">
      <div className="bg-white p-4 sticky top-0 z-20 border-b border-slate-200 flex justify-between items-center shadow-lg">
        <h2 className="font-bold text-slate-900 text-lg truncate">
          {myStore?.name}
        </h2>
        <button
          onClick={() => {
            logout();
            navigate("/");
          }}
          className="bg-rose-100 text-rose-600 p-3 rounded-xl hover:bg-rose-600 transition-all"
        >
          <LogOut size={20} />
        </button>
      </div>

      <div className="p-4">
        {tab === "prod" ? (
          <div className="space-y-4">
            {/* --- NUEVA TARJETA DE ENLACE COMPARTIBLE --- */}
            {myStore && (
              <div className="mb-8 p-6 bg-gradient-to-br from-white to-sky-50 rounded-2xl border border-cyan-500/30 shadow-2xl flex flex-col items-center text-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-cyan-600/10 rounded-xl">
                    <Store className="text-cyan-600" size={30} />
                  </div>
                  <h1 className="text-slate-900 font-bold text-sm" size={18}>
                    Tu tienda está lista
                  </h1>
                  <br></br>
                  <div>
                    <p className="text-slate-500 text-[11px] uppercase tracking-wider font-medium">
                      Comparte este enlace con tus clientes
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-sky-50 p-2 pl-4 rounded-xl border border-slate-200 w-full max-w-md">
                  <span className="text-sm font-mono text-cyan-700 truncate flex-1">
                    {`${window.location.origin}/${myStore.slug || myStore.name.toLowerCase().trim().replace(/\s+/g, "-")}`}
                  </span>
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/${myStore.slug || myStore.name.toLowerCase().trim().replace(/\s+/g, "-")}`;
                      navigator.clipboard.writeText(url);
                      notify("¡Enlace copiado!");
                    }}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white p-3 rounded-lg transition-all active:scale-90"
                  >
                    <Copy size={18} />
                  </button>
                </div>
              </div>
            )}
            {/* --- FIN DE TARJETA --- */}
            <div className="relative">
              <Search
                size={17}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
              />
              <input
                type="text"
                placeholder="Buscar mis productos por nombre o categoría..."
                value={prodQuery}
                onChange={(e) => {
                  setProdQuery(e.target.value);
                  setProdPage(1);
                }}
                className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-900 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 outline-none transition-all placeholder:text-slate-500 text-sm"
              />
            </div>
            <p className="text-xs text-slate-500">
              {filteredProducts.length} productos
              {filteredProducts.length > 0 &&
                ` · mostrando ${(prodPageSafe - 1) * PRODUCTS_PER_PAGE + 1}–${Math.min(prodPageSafe * PRODUCTS_PER_PAGE, filteredProducts.length)}`}
            </p>
            {prodPageProducts.map((p) => (
              <div
                key={p.id}
                className={`bg-white p-3 rounded-2xl border border-slate-200 flex gap-3 items-center ${!p.is_visible && "opacity-50"}`}
              >
                <div className="w-16 h-16 bg-white rounded-xl overflow-hidden shrink-0 border border-slate-200">
                  <SafeImage
                    src={parseImages(p.image_url)[0]}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-800 text-sm truncate">
                    {p.name}
                  </h4>
                  <p className="text-xs text-emerald-600 font-mono mt-1">
                    {priceLabel(p)}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => openModal(p)}
                    className="bg-slate-100 p-2 rounded-lg text-cyan-700"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() =>
                      saveProduct({ ...p, is_visible: !p.is_visible }, true)
                    }
                    className="bg-slate-100 p-2 rounded-lg text-slate-500"
                  >
                    {p.is_visible ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button
                    onClick={() => deleteProduct(p.id)}
                    className="bg-slate-100 p-2 rounded-lg text-rose-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {filteredProducts.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-8">
                {prodQuery
                  ? "No hay productos que coincidan con la búsqueda."
                  : "Todavía no tienes productos. Toca + para agregar el primero."}
              </p>
            )}
            {prodTotalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <button
                  disabled={prodPageSafe <= 1}
                  onClick={() => setProdPage(prodPageSafe - 1)}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold disabled:opacity-40"
                >
                  <ChevronLeft size={14} /> Anterior
                </button>
                <span className="text-xs text-slate-500 font-bold">
                  Página {prodPageSafe} de {prodTotalPages}
                </span>
                <button
                  disabled={prodPageSafe >= prodTotalPages}
                  onClick={() => setProdPage(prodPageSafe + 1)}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold disabled:opacity-40"
                >
                  Siguiente <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        ) : (
          <Card className="p-5 space-y-4">
            <Input
              label="Nombre Tienda"
              value={formS.name || ""}
              onChange={(e) => setFormS({ ...formS, name: e.target.value })}
            />
            <Input
              label="WhatsApp público"
              type="number"
              value={formS.whatsapp || ""}
              onChange={(e) => setFormS({ ...formS, whatsapp: e.target.value })}
            />
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1 uppercase tracking-wider">
                Descripción de la tienda
              </label>
              <textarea
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 outline-none focus:border-cyan-500"
                rows="3"
                value={formS.description || ""}
                onChange={(e) =>
                  setFormS({ ...formS, description: e.target.value })
                }
              />
            </div>
            <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200">
              <SafeImage
                src={formS.logoUrl}
                className="w-16 h-16 rounded-full overflow-hidden"
              />
              <label className="bg-cyan-600 text-white px-4 py-2 rounded-lg cursor-pointer text-xs font-bold uppercase">
                Subir Logo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageUpload(e, "logo")}
                />
              </label>
            </div>
            <div className="p-4 bg-sky-50 rounded-2xl border border-slate-200 flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Mercado Global</h4>
                <p className="text-[10px] text-slate-500">
                  Aparecer en la búsqueda general del sistema?
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={formS.is_public_market}
                  onChange={(e) =>
                    setFormS({ ...formS, is_public_market: e.target.checked })
                  }
                />
                <div className="w-11 h-6 bg-slate-100 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
              </label>
            </div>

            <select
              className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-900 outline-none appearance-none"
              value={formS.province_id || ""}
              onChange={(e) =>
                setFormS({ ...formS, province_id: e.target.value })
              }
            >
              <option value="" className="text-slate-500">
                Seleccionar Provincia...
              </option>

              {/* AHORA USAMOS LA VARIABLE DE ESTADO 'provinces' */}
              {provinces.map((prov) => (
                <option key={prov.id} value={prov.id}>
                  {prov.name}
                </option>
              ))}
            </select>

            <Button
              onClick={() => updateStoreSettings(formS)}
              className="w-full"
            >
              Guardar Ajustes
            </Button>
          </Card>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 pb-5 z-50">
        <button
          onClick={() => setTab("prod")}
          className={`flex flex-col items-center p-2 rounded-2xl w-24 transition-all ${tab === "prod" ? "text-cyan-700 bg-cyan-50" : "text-slate-500"}`}
        >
          <Grid size={24} />
          <span className="text-[10px] font-bold uppercase">Productos</span>
        </button>
        <button
          onClick={() => setTab("conf")}
          className={`flex flex-col items-center p-2 rounded-2xl w-24 transition-all ${tab === "conf" ? "text-cyan-700 bg-cyan-50" : "text-slate-500"}`}
        >
          <SettingsIcon size={24} />
          <span className="text-[10px] font-bold uppercase">Ajustes</span>
        </button>
      </div>

      {tab === "prod" && (
        <button
          onClick={() => openModal(null)}
          className="fixed bottom-24 right-4 bg-cyan-600 text-white p-4 rounded-full shadow-2xl z-40 hover:scale-110 transition-transform"
        >
          <Plus size={28} />
        </button>
      )}

      {modal && (
        <div className="fixed inset-0 bg-white z-[60] overflow-y-auto p-4 animate-fade-in">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-xl text-slate-900">
              {editP ? "Editar Producto" : "Nuevo Producto"}
            </h3>
            <button
              onClick={() => setModal(false)}
              className="bg-white p-2 rounded-full text-slate-500"
            >
              <X size={24} />
            </button>
          </div>
          <form onSubmit={submitP} className="space-y-4">
            <Input
              label="Nombre"
              required
              value={formP.name}
              onChange={(e) => setFormP({ ...formP, name: e.target.value })}
            />
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  label="CUP"
                  type="number"
                  value={formP.priceCup}
                  onChange={(e) =>
                    setFormP({ ...formP, priceCup: e.target.value })
                  }
                />
              </div>
              <div className="flex-1">
                <Input
                  label="USD"
                  type="number"
                  value={formP.priceUsd}
                  onChange={(e) =>
                    setFormP({ ...formP, priceUsd: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  label="Categoría"
                  value={formP.category || ""}
                  list="categorias-sugeridas"
                  placeholder="Ej.: Alimentos"
                  onChange={(e) =>
                    setFormP({ ...formP, category: e.target.value })
                  }
                />
                <datalist id="categorias-sugeridas">
                  <option value="Alimentos" />
                  <option value="Electrodomésticos" />
                  <option value="Celulares" />
                  <option value="Ropa y calzado" />
                  <option value="Hogar" />
                  <option value="Motos" />
                  <option value="Belleza" />
                  <option value="Salud" />
                  <option value="Ferretería" />
                  <option value="Juguetes" />
                </datalist>
              </div>
              <div className="flex-1">
                <Input
                  label="Stock"
                  type="number"
                  value={formP.stock ?? 1}
                  onChange={(e) =>
                    setFormP({ ...formP, stock: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <label className="bg-cyan-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer uppercase">
                Añadir Fotos{" "}
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageUpload(e, "product")}
                />
              </label>
              <div className="grid grid-cols-3 gap-2 mt-4">
                {formP.images?.map((url, i) => (
                  <div
                    key={i}
                    className="aspect-square bg-sky-50 rounded-xl overflow-hidden relative"
                  >
                    <SafeImage
                      src={url}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setFormP((p) => ({
                          ...p,
                          images: p.images.filter((_, idx) => idx !== i),
                        }))
                      }
                      className="absolute top-1 right-1 bg-rose-600 rounded-full p-1 text-white"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full py-4 text-lg">
              Guardar
            </Button>
          </form>
        </div>
      )}
    </div>
  );
};

const SuperAdminPanel = () => {
  const { notify } = useToast();
  const {
    adminData,
    logout,
    generateCode,
    toggleStore,
    deleteStore,
    updateAdminPass,
    deleteCode,
    adminResetStorePass,
    adminUpdateStoreContact,
    updateSuperAdminContact,
    superAdminContact,
  } = useContext(AppContext);
  const navigate = useNavigate();
  const [tab, setTab] = useState("stores");
  const [pass, setPass] = useState("");
  const [selStore, setSelStore] = useState(null);
  const [resetP, setResetP] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [adminContact, setAdminContact] = useState(superAdminContact);
  // Búsqueda y paginación del panel (Tiendas: 10/pág; Licencias: 15/pág).
  const [storeQuery, setStoreQuery] = useState("");
  const [storeStatus, setStoreStatus] = useState("all");
  const [storePage, setStorePage] = useState(1);
  const [codeQuery, setCodeQuery] = useState("");
  const [codePage, setCodePage] = useState(1);

  useEffect(() => {
    setAdminContact(superAdminContact);
  }, [superAdminContact]);

  if (!adminData) return null;
  const { stats, stores, codes } = adminData;

  // --- Filtrado y paginación de Tiendas (10 por página) ---
  const STORES_PER_PAGE = 10;
  const CODES_PER_PAGE = 15;
  const norm = (v) => String(v || "").toLowerCase();
  const storeQueryNorm = storeQuery.trim().toLowerCase();
  const filteredStores = stores.filter((s) => {
    if (storeStatus === "active" && s.is_suspended) return false;
    if (storeStatus === "suspended" && !s.is_suspended) return false;
    if (!storeQueryNorm) return true;
    const slug =
      s.slug || s.name.toLowerCase().trim().replace(/\s+/g, "-");
    return (
      norm(s.name).includes(storeQueryNorm) ||
      norm(s.owner_name).includes(storeQueryNorm) ||
      norm(s.whatsapp).includes(storeQueryNorm) ||
      norm(slug).includes(storeQueryNorm)
    );
  });
  const storeTotalPages = Math.max(
    1,
    Math.ceil(filteredStores.length / STORES_PER_PAGE),
  );
  const storePageSafe = Math.min(storePage, storeTotalPages);
  const storePageStores = filteredStores.slice(
    (storePageSafe - 1) * STORES_PER_PAGE,
    storePageSafe * STORES_PER_PAGE,
  );

  // --- Filtrado y paginación de Licencias (15 por página) ---
  const codeQueryNorm = codeQuery.trim().toLowerCase();
  const filteredCodes = codes.filter((c) =>
    !codeQueryNorm ? true : norm(c.code).includes(codeQueryNorm),
  );
  const codeTotalPages = Math.max(
    1,
    Math.ceil(filteredCodes.length / CODES_PER_PAGE),
  );
  const codePageSafe = Math.min(codePage, codeTotalPages);
  const codePageCodes = filteredCodes.slice(
    (codePageSafe - 1) * CODES_PER_PAGE,
    codePageSafe * CODES_PER_PAGE,
  );

  const handleStoreReset = (e) => {
    e.preventDefault();
    adminResetStorePass(selStore.id, resetP);
    setResetP("");
  };

  return (
    <div className="min-h-screen bg-[#F2FBFC] pb-20">
      <nav className="bg-white p-4 sticky top-0 z-20 flex justify-between shadow-lg border-b border-slate-200">
        <h2 className="font-bold text-slate-900 tracking-widest uppercase">
          Panel del Administrador
        </h2>
        <button
          onClick={() => {
            logout();
            navigate("/");
          }}
        >
          <LogOut className="text-rose-600" />
        </button>
      </nav>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 border-l-4 border-cyan-500">
            <div className="text-xs text-slate-500 font-bold uppercase">
              Tiendas
            </div>
            <div className="text-3xl text-slate-900 font-black">
              {stats.total_stores}
            </div>
          </Card>
          <Card className="p-4 border-l-4 border-emerald-500">
            <div className="text-xs text-slate-500 font-bold uppercase">
              Licencias
            </div>
            <div className="text-3xl text-slate-900 font-black">
              {stats.available_licenses}
            </div>
          </Card>
        </div>

        <div className="flex gap-2">
          {["stores", "codes", "sec"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-full text-xs font-bold uppercase transition-all ${tab === t ? "bg-cyan-600 text-white" : "bg-white text-slate-500 border border-slate-200"}`}
            >
              {t === "stores"
                ? "Tiendas"
                : t === "codes"
                  ? "Licencias"
                  : "Seguridad"}
            </button>
          ))}
        </div>

        {tab === "codes" && (
          <Card className="p-4">
            <Button onClick={generateCode} className="w-full mb-4">
              Generar Nueva Licencia
            </Button>
            <div className="relative mb-3">
              <Search
                size={17}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
              />
              <input
                type="text"
                placeholder="Buscar licencia por código..."
                value={codeQuery}
                onChange={(e) => {
                  setCodeQuery(e.target.value);
                  setCodePage(1);
                }}
                className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-900 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 outline-none transition-all placeholder:text-slate-500 text-sm"
              />
            </div>
            <p className="text-xs text-slate-500 mb-3">
              {filteredCodes.length} licencias
              {filteredCodes.length > 0 &&
                ` · mostrando ${(codePageSafe - 1) * CODES_PER_PAGE + 1}–${Math.min(codePageSafe * CODES_PER_PAGE, filteredCodes.length)}`}
            </p>
            <div className="space-y-2">
              {codePageCodes.map((c) => (
                <div
                  key={c.id}
                  className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-200"
                >
                  <span className="font-mono text-slate-600 font-bold">
                    {c.code}
                  </span>
                  <button
                    onClick={() => deleteCode(c.id)}
                    className="text-rose-600 hover:scale-110"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {filteredCodes.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-6">
                  No hay licencias que coincidan con la búsqueda.
                </p>
              )}
            </div>
            {codeTotalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <button
                  disabled={codePageSafe <= 1}
                  onClick={() => setCodePage(codePageSafe - 1)}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold disabled:opacity-40"
                >
                  <ChevronLeft size={14} /> Anterior
                </button>
                <span className="text-xs text-slate-500 font-bold">
                  Página {codePageSafe} de {codeTotalPages}
                </span>
                <button
                  disabled={codePageSafe >= codeTotalPages}
                  onClick={() => setCodePage(codePageSafe + 1)}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold disabled:opacity-40"
                >
                  Siguiente <ChevronRight size={14} />
                </button>
              </div>
            )}
          </Card>
        )}

        {tab === "stores" && (
          <div className="space-y-3">
            <Card className="p-4 space-y-3">
              <div className="relative">
                <Search
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                />
                <input
                  type="text"
                  placeholder="Buscar por tienda, dueño, WhatsApp o slug..."
                  value={storeQuery}
                  onChange={(e) => {
                    setStoreQuery(e.target.value);
                    setStorePage(1);
                  }}
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-900 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 outline-none transition-all placeholder:text-slate-500 text-sm"
                />
              </div>
              <div className="flex gap-2">
                {[
                  { id: "all", label: "Todas" },
                  { id: "active", label: "Activas" },
                  { id: "suspended", label: "Suspendidas" },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      setStoreStatus(f.id);
                      setStorePage(1);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${storeStatus === f.id ? "bg-cyan-600 text-white" : "bg-white text-slate-500 border border-slate-200"}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                {filteredStores.length} tiendas
                {filteredStores.length > 0 &&
                  ` · mostrando ${(storePageSafe - 1) * STORES_PER_PAGE + 1}–${Math.min(storePageSafe * STORES_PER_PAGE, filteredStores.length)}`}
              </p>
            </Card>
            {storePageStores.map((s) => {
              // Generamos el slug basado en el nombre (o usamos s.slug si tu backend ya lo trae)
              const storeSlug =
                s.slug || s.name.toLowerCase().trim().replace(/\s+/g, "-");
              // Construimos la URL dinámica usando el origen actual (localhost o dominio real)
              const storeUrl = `${window.location.origin}/${storeSlug}`;

              return (
                <Card
                  key={s.id}
                  className={`p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all ${
                    s.is_suspended
                      ? "border-l-4 border-rose-400 bg-rose-50"
                      : "border-l-4 border-cyan-500"
                  }`}
                >
                  <div className="flex-1 min-w-0 w-full">
                    <h4 className="font-bold text-slate-800 text-lg">
                      {s.name}
                    </h4>
                    <p className="text-xs text-slate-500 mb-2">
                      {s.owner_name} • {formatPhone(s.whatsapp)} •{" "}
                      {s.created_at.split("T")[0]}
                    </p>

                    {/* Contenedor de la URL y botón de copiar */}
                    <div className="flex items-center gap-2 bg-sky-50 p-2 rounded-xl border border-slate-200 w-full sm:w-fit group">
                      <span className="text-[11px] text-cyan-700 font-mono truncate max-w-[200px] sm:max-w-xs">
                        {storeUrl}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(storeUrl);
                          notify("¡Enlace copiado!");
                        }}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-all active:scale-90"
                        title="Copiar ruta de la tienda"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => {
                        setSelStore(s);
                        setEditWhatsapp(s.whatsapp);
                      }}
                      className="p-2.5 bg-cyan-600/10 text-cyan-700 rounded-xl hover:bg-cyan-600/20 transition-colors"
                    >
                      <Info size={18} />
                    </button>
                    <button
                      onClick={() => toggleStore(s.id, s.is_suspended)}
                      className="p-2.5 bg-white rounded-xl text-slate-500 hover:text-slate-800 transition-colors border border-slate-200"
                    >
                      {s.is_suspended ? (
                        <CheckCircle size={18} />
                      ) : (
                        <Ban size={18} />
                      )}
                    </button>
                    <button
                      onClick={() => deleteStore(s.id)}
                      className="p-2.5 bg-rose-100 text-rose-600 rounded-xl hover:bg-red-900/40 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </Card>
              );
            })}
            {filteredStores.length === 0 && (
              <Card className="p-6">
                <p className="text-sm text-slate-500 text-center">
                  No hay tiendas que coincidan con la búsqueda.
                </p>
              </Card>
            )}
            {storeTotalPages > 1 && (
              <div className="flex items-center justify-between">
                <button
                  disabled={storePageSafe <= 1}
                  onClick={() => setStorePage(storePageSafe - 1)}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold disabled:opacity-40"
                >
                  <ChevronLeft size={14} /> Anterior
                </button>
                <span className="text-xs text-slate-500 font-bold">
                  Página {storePageSafe} de {storeTotalPages}
                </span>
                <button
                  disabled={storePageSafe >= storeTotalPages}
                  onClick={() => setStorePage(storePageSafe + 1)}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold disabled:opacity-40"
                >
                  Siguiente <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "sec" && (
          <div className="space-y-4">
            <Card className="p-5">
              <h3 className="text-slate-900 font-bold mb-4 uppercase text-sm">
                Cambiar Clave Maestra
              </h3>
              <Input
                type="password"
                placeholder="Nueva Clave Admin"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
              />
              <Button
                onClick={() => {
                  updateAdminPass(pass);
                  setPass("");
                }}
                className="w-full"
              >
                Actualizar Clave
              </Button>
            </Card>
            <Card className="p-5">
              <h3 className="text-slate-900 font-bold mb-4 uppercase text-sm">
                WhatsApp de Soporte
              </h3>
              <Input
                value={adminContact}
                onChange={(e) => setAdminContact(e.target.value)}
              />
              <Button
                onClick={() => updateSuperAdminContact(adminContact)}
                className="w-full"
              >
                Guardar Contacto
              </Button>
            </Card>
          </div>
        )}
      </div>

      {selStore && (
        <div className="fixed inset-0 bg-sky-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md p-6 relative animate-zoom-in">
            <button
              onClick={() => setSelStore(null)}
              className="absolute top-4 right-4 text-slate-500"
            >
              <X />
            </button>
            <h3 className="text-xl font-black text-slate-900 mb-6 uppercase tracking-widest">
              {selStore.name}
            </h3>
            <Input
              label="Nuevo WhatsApp"
              value={editWhatsapp}
              onChange={(e) => setEditWhatsapp(e.target.value)}
            />
            <Button
              onClick={() => adminUpdateStoreContact(selStore.id, editWhatsapp)}
              className="w-full mb-6"
            >
              Guardar Contacto
            </Button>

            <div className="bg-rose-100 p-4 rounded-xl border border-rose-200">
              <h4 className="text-rose-600 font-bold text-xs mb-3 uppercase tracking-widest">
                Zona de Seguridad
              </h4>
              <Input
                label="Resetear Password"
                placeholder="Nueva clave..."
                value={resetP}
                onChange={(e) => setResetP(e.target.value)}
              />
              <Button onClick={handleStoreReset} className="w-full bg-rose-600">
                Cambiar Password
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

// Sube arriba al cambiar de ruta.
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const NotFoundPage = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <Card className="p-8 max-w-sm w-full text-center space-y-4">
        <h2 className="text-2xl font-black text-slate-900">
          Página no encontrada
        </h2>
        <p className="text-sm text-slate-500">
          Esa dirección no existe por aquí. Revisa el enlace o vuelve al
          inicio.
        </p>
        <Button onClick={() => navigate("/")} className="w-full">
          Volver al inicio
        </Button>
      </Card>
    </div>
  );
};

// --- CONFIGURACIÓN DE RUTAS ---
const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<AuthScreen mode="login" />} />
      <Route path="/register" element={<AuthScreen mode="register" />} />
      <Route path="/vendedor" element={<Navigate to="/login" replace />} />
      <Route path="/admin/login" element={<AuthScreen mode="admin" />} />
      <Route path="/dashboard" element={<VendorDashboard />} />
      <Route path="/admin/panel" element={<SuperAdminPanel />} />
      <Route path="/:slug" element={<StoreFrontend />} />
      <Route path="/explorar" element={<GlobalMarketplace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

// --- PUNTO DE ENTRADA PRINCIPAL ---
export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <ToastProvider>
        <AppProvider>
          {/* El TailwindInjector se asegura de que los estilos existan */}

          <AppRoutes />
        </AppProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
