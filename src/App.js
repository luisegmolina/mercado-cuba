import React, {
  useState,
  useEffect,
  createContext,
  useContext,
  //use,
} from "react";
import GlobalMarketplace from "./Marketplace"; // Asegúrate de que el nombre coincida
import "./index.css";
// Importamos los componentes de navegación para crear una Single Page Application (SPA)
import {
  BrowserRouter,
  Routes,
  Route,
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
 */

// Normaliza las imágenes que vienen del servidor para que siempre sean un Array manejable por React.
const parseImages = (imgStr) => {
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
                ? "bg-gray-800 border-green-500 text-green-400"
                : "bg-gray-800 border-red-500 text-red-400"
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
              className="ml-auto text-gray-500 hover:text-white"
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
  <div className="fixed inset-0 bg-gray-900/90 z-[999] flex flex-col items-center justify-center backdrop-blur-sm">
    <Loader2 className="animate-spin text-blue-500" size={40} />
    <p className="text-blue-500 mt-4 font-bold animate-pulse uppercase tracking-widest text-xs">
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
        body: JSON.stringify({ whatsapp, password }),
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
        body: JSON.stringify({ ...data, code, password: pwd }),
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

const SafeImage = ({ src, className, fallbackIcon: Icon = ImageIcon }) => {
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

const Button = ({ children, onClick, className = "", ...props }) => (
  <button
    onClick={onClick}
    className={`px-4 py-3.5 rounded-xl font-bold active:scale-95 flex items-center justify-center gap-2 shadow-lg text-sm bg-blue-600 text-white hover:bg-blue-500 transition-all ${className}`}
    {...props}
  >
    {children}
  </button>
);

const Input = ({ label, ...props }) => (
  <div className="mb-4">
    <label className="block text-xs font-bold text-gray-400 mb-1.5 ml-1 uppercase tracking-wider">
      {label}
    </label>
    <input
      className="w-full px-4 py-3.5 rounded-xl border border-gray-700 bg-gray-800 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-gray-600"
      {...props}
    />
  </div>
);

const Card = ({ children, className = "" }) => (
  <div
    className={`bg-gray-800 rounded-2xl shadow-xl border border-gray-700 overflow-hidden ${className}`}
  >
    {children}
  </div>
);

const ImageGallery = ({ imagesStr }) => {
  const imgs = parseImages(imagesStr);
  const [idx, setIdx] = useState(0);
  if (imgs.length === 0)
    return (
      <div className="aspect-square bg-gray-800 flex items-center justify-center border-b border-gray-700">
        <ImageIcon size={48} className="text-gray-700" />
      </div>
    );
  return (
    <div className="relative group bg-gray-900">
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
              className={`w-2 h-2 rounded-full shadow-lg transition-all ${i === idx ? "bg-blue-500 w-6" : "bg-white/50 hover:bg-white"}`}
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
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
    <div className="bg-gray-800 w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-700">
      {/* Cabecera */}
      <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <BookOpen className="text-blue-500" /> Manual de Vendedor
        </h2>
        <button
          onClick={onClose}
          className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>

      {/* Contenido - Alineado a la Izquierda */}
      <div className="p-6 overflow-y-auto space-y-6 text-gray-300 leading-relaxed text-left">
        {" "}
        {/* <--- text-left */}
        <section>
          <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            🔐 1. Registro
          </h3>
          <ul className="list-disc pl-5 space-y-1 text-sm marker:text-blue-500">
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
            <li className="text-yellow-500/90 font-medium pt-1">
              Si no tienes código de licencia contacta al: {contact}
            </li>
          </ul>
        </section>
        <section>
          <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            ⚙️ 2. Configuración Inicial
          </h3>
          <p className="text-sm mb-2 text-gray-400">
            Ve a la pestaña <strong>Ajustes</strong> (⚙️) abajo a la derecha:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-sm marker:text-blue-500">
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
          <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            📸 3. Subir Productos
          </h3>
          <p className="text-sm mb-2 text-gray-400">
            Ve a la pestaña <strong>Productos</strong> (田):
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm marker:text-blue-500">
            <li>
              Toca el botón <strong>(+) Azul</strong>.
            </li>
            <li>Pon nombre, precio (CUP/USD) y fotos.</li>
            <li className="text-green-400 font-bold">
              ¡Listo! Ya está visible en la vista general.
            </li>
            <li>Recuerda que puedes editar o eliminar productos cuando quieras.</li>
            <li>También puedes publicar tú copiando el enlace de tu tienda y compartiéndolo en tus redes sociales o grupos de WhatsApp para atraer más clientes.</li>
          </ul>
        </section>
        <section>
          <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            🚀 4. Recibir Pedidos
          </h3>
          <div className="bg-blue-900/10 p-4 rounded-l-md border-l-4 border-blue-500 text-sm">
            <p>
              Cuando un cliente toca <strong>"PEDIR"</strong>, se abrirá tu
              WhatsApp automáticamente con el mensaje del producto. Tú cierras
              la venta por chat privado.
            </p>
          </div>
        </section>
      </div>

      {/* Pie del Manual */}
      <div className="p-4 border-t border-gray-700 bg-gray-900 flex flex-col gap-3">
        <p className="text-xs text-center text-gray-500">
          Soporte Técnico:{" "}
          <span className="text-gray-300 font-bold">{contact}</span>
        </p>
        <button
          onClick={onClose}
          className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold w-full hover:bg-blue-500 transition-colors shadow-lg"
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

  const loadLandingData = async () => {
    setStoresError(false);
    try {
      const res = await fetch(`${API_URL}/public/stores`);
      if (!res.ok) throw new Error("No se pudieron cargar las tiendas");
      const data = await res.json();
      setStores(Array.isArray(data) ? data : []);
    } catch (e) {
      setStores([]);
      setStoresError(true);
    }
    try {
      const res = await fetch(`${API_URL}/public/all-products?limit=100`);
      if (!res.ok) throw new Error("No se pudieron cargar los productos");
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setFeatured(list.slice(0, 6));
      setProductsTotal(list.length >= 100 ? "100+" : String(list.length));
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
    navigate(`/${val}`);
  };

  const storeSlug = (s) =>
    s.slug || (s.name || "").toLowerCase().trim().replace(/\s+/g, "-");

  const licenseUrl = superAdminContact
    ? `https://wa.me/${superAdminContact}?text=${encodeURIComponent("Hola, solicito una licencia")}`
    : "";

  const priceLabel = (p) => {
    const cup = Number(p.price_cup) > 0 ? `${p.price_cup} CUP` : "";
    const usd = Number(p.price_usd) > 0 ? `${p.price_usd} USD` : "";
    return [cup, usd].filter(Boolean).join(" · ");
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="w-full max-w-md mx-auto px-4 pt-10 pb-8 space-y-8">
        {/* --- HERO --- */}
        <div className="text-center animate-fade-in">
          <div className="w-24 h-24 bg-gray-800 rounded-3xl mx-auto flex items-center justify-center mb-6 border border-gray-700 shadow-2xl">
            <ShoppingBag className="text-blue-500" size={48} />
          </div>
          <h1 className="text-4xl font-black text-white">{APP_NAME}</h1>
          <p className="text-lg text-blue-400 font-bold mt-2">
            Compra y vende en toda Cuba
          </p>
          <p className="text-sm text-gray-400 mt-3 leading-relaxed">
            Tiendas de toda la isla en un solo lugar. Busca lo que necesitas,
            pide por WhatsApp y acuerda la entrega y el pago directo con el
            vendedor.
          </p>
          <p className="text-sm text-gray-200 font-bold mt-4">
            {stores.length > 0 || productsTotal !== null
              ? `${stores.length} tiendas · ${productsTotal ?? "…"} productos`
              : "Cargando el mercado..."}
          </p>
        </div>

        {/* --- ACCIONES PRINCIPALES --- */}
        <div className="space-y-3">
          <button
            onClick={() => navigate("/explorar")}
            className="w-full bg-blue-600 text-white py-3.5 rounded-xl text-sm font-bold hover:bg-blue-500 transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            <Grid size={18} /> Explorar Todo el Mercado
          </button>
          <button
            onClick={() => navigate("/login")}
            className="w-full bg-gray-800 text-gray-200 py-3.5 rounded-xl text-sm font-bold border border-gray-700 hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
          >
            <User size={18} /> Soy Vendedor (Entrar)
          </button>
          <button
            onClick={() => setShowManual(true)}
            className="w-full bg-white/5 text-gray-300 py-3.5 rounded-xl text-sm font-bold border border-gray-600/50 hover:bg-white/10 transition-all flex items-center justify-center gap-2"
          >
            <FileText size={18} /> ¿Cómo funciona? (Guía)
          </button>
          {superAdminContact ? (
            <a
              href={licenseUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full bg-green-600/10 text-green-500 py-3.5 rounded-xl text-sm font-bold border border-green-600/20 hover:bg-green-600/20 transition-all flex items-center justify-center gap-2 text-center"
            >
              <MessageCircle size={18} /> Solicitar Licencia
            </a>
          ) : (
            <button
              disabled
              className="w-full bg-green-600/10 text-green-500/50 py-3.5 rounded-xl text-sm font-bold border border-green-600/20 flex items-center justify-center gap-2"
            >
              <MessageCircle size={18} /> Cargando contacto...
            </button>
          )}
        </div>

        {/* --- CÓMO SE COMPRA --- */}
        <Card className="p-5">
          <h2 className="font-bold text-white mb-4 text-base">
            ¿Cómo se compra?
          </h2>
          <ol className="space-y-3 text-sm text-gray-300">
            <li className="flex gap-3">
              <span className="w-6 h-6 shrink-0 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center">
                1
              </span>
              Busca el producto o la tienda que te interesa.
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 shrink-0 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center">
                2
              </span>
              Toca “Pedir” y se abre WhatsApp con el mensaje listo.
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 shrink-0 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center">
                3
              </span>
              Acuerda con el vendedor la entrega y el pago.
            </li>
          </ol>
        </Card>

        {/* --- PRODUCTOS DESTACADOS --- */}
        {featured.length > 0 && (
          <div className="animate-fade-in-up">
            <h2 className="font-bold text-white mb-3 text-base">
              Destacados del mercado
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {featured.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/${p.store_slug}`)}
                  className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700 text-left shadow-lg active:scale-95 transition-transform"
                >
                  <div className="aspect-square bg-gray-900">
                    <SafeImage
                      src={parseImages(p.image_url)[0]}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-bold text-gray-200 line-clamp-2">
                      {p.name}
                    </p>
                    <p className="text-xs text-blue-400 font-black mt-1">
                      {priceLabel(p)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* --- BUSCAR TIENDA --- */}
        <Card className="p-6 border-t-4 border-blue-600">
          <h2 className="font-bold text-gray-200 mb-4 flex gap-2 items-center text-lg">
            <Store className="text-blue-500" size={20} /> Buscar Tienda
          </h2>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 text-white rounded-xl text-sm outline-none"
              placeholder="ej: modas-habana"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-500 transition-colors">
              <ArrowRight size={20} />
            </button>
          </form>
          {storesError ? (
            <div className="mt-4 text-center">
              <p className="text-xs text-gray-400 mb-2">
                No se pudieron cargar las tiendas.
              </p>
              <button
                onClick={loadLandingData}
                className="text-xs text-blue-400 font-bold underline"
              >
                Reintentar
              </button>
            </div>
          ) : (
            stores.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Tiendas en el mercado
                </p>
                <ul className="space-y-1">
                  {stores.slice(0, 12).map((s) => (
                    <li key={s.id}>
                      <button
                        onClick={() => navigate(`/${storeSlug(s)}`)}
                        className="w-full text-left text-sm text-blue-400 hover:text-blue-300 font-bold py-1.5 flex items-center justify-between gap-2"
                      >
                        <span className="truncate">{s.name}</span>
                        {s.province_name && (
                          <span className="text-[11px] text-gray-500 font-normal shrink-0">
                            {s.province_name}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}
        </Card>

        {/* --- VENDE TU TIENDA --- */}
        <Card className="p-6 border-t-4 border-emerald-600">
          <h2 className="font-bold text-white mb-1 text-lg">
            Vende tu tienda
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            Pon tus productos frente a compradores de toda Cuba.
          </p>
          <ul className="space-y-2 text-sm text-gray-300 mb-5">
            <li className="flex gap-2">
              <CheckCircle size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              Tu tienda con enlace propio para compartir
            </li>
            <li className="flex gap-2">
              <CheckCircle size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              Pedidos directos por WhatsApp, sin intermediarios
            </li>
            <li className="flex gap-2">
              <CheckCircle size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              Aparece en el mercado global y por provincia
            </li>
            <li className="flex gap-2">
              <CheckCircle size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              Sube tus productos con fotos y precios en CUP y USD
            </li>
          </ul>
          {superAdminContact ? (
            <a
              href={licenseUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full bg-emerald-600 text-white py-3.5 rounded-xl text-sm font-bold hover:bg-emerald-500 transition-all flex items-center justify-center gap-2 text-center"
            >
              <MessageCircle size={18} /> Solicitar licencia
            </a>
          ) : (
            <button
              disabled
              className="w-full bg-emerald-600/40 text-white/60 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
            >
              <MessageCircle size={18} /> Cargando contacto...
            </button>
          )}
          <p className="text-xs text-gray-500 mt-3 text-center">
            Precio y duración: consúltalos por WhatsApp.
          </p>
        </Card>

        {/* --- PIE --- */}
        <footer className="text-center space-y-2 pt-2 pb-4">
          <p className="text-xs text-gray-500 font-bold">{APP_NAME}</p>
          {superAdminContact ? (
            <a
              href={licenseUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-green-500 hover:text-green-400 font-bold inline-flex items-center gap-1"
            >
              <MessageCircle size={12} /> Contacto por WhatsApp
            </a>
          ) : (
            <p className="text-xs text-gray-600">Cargando contacto...</p>
          )}
        </footer>
      </div>
      {showManual && (
        <ManualModal
          onClose={() => setShowManual(false)}
          contact={superAdminContact}
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
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center gap-4 p-4 animate-fade-in">
        <Loader2 className="animate-spin text-blue-500" size={40} />
        <p className="text-gray-400 text-sm font-bold">Cargando tienda...</p>
        <div className="w-full max-w-md space-y-3 mt-4">
          <div className="h-10 bg-gray-800 rounded-xl animate-pulse" />
          <div className="grid grid-cols-2 gap-3">
            <div className="aspect-square bg-gray-800 rounded-xl animate-pulse" />
            <div className="aspect-square bg-gray-800 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (storeError || !data || !data.store) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <Card className="p-8 max-w-sm w-full text-center space-y-4">
          <Store className="text-gray-600 mx-auto" size={48} />
          <h2 className="text-xl font-bold text-white">
            Tienda no encontrada
          </h2>
          <p className="text-sm text-gray-400">
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

  const contact = (p) => {
    const prices = `${p.price_cup > 0 ? p.price_cup + " CUP" : ""} ${p.price_usd > 0 ? p.price_usd + " USD" : ""}`;
    window.open(
      `https://wa.me/${store.whatsapp}?text=${encodeURIComponent(`Hola, me interesa: ${p.name} (${prices})`)}`,
      "_blank",
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 pb-20">
      <div className="sticky top-0 bg-gray-900/95 backdrop-blur-md z-30 px-4 py-3 border-b border-gray-800 flex items-center gap-3 shadow-lg">
        <button
          onClick={() => navigate("/")}
          className="p-2 -ml-2 rounded-full hover:bg-gray-800 text-gray-400"
        >
          <ChevronLeft />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-lg truncate text-white">
            {store.name}
          </h1>
        </div>
        <div className="w-10 h-10 rounded-full border-2 border-gray-700 bg-gray-800 overflow-hidden">
          <SafeImage
            src={store.logo_url}
            className="w-full h-full object-cover"
            fallbackIcon={Store}
          />
        </div>
      </div>
      {(store.description || store.owner_name || provinceName) && (
        <div className="px-4 pt-4">
          <Card className="p-4 space-y-1">
            {store.description && (
              <p className="text-sm text-gray-300">{store.description}</p>
            )}
            {store.owner_name && (
              <p className="text-xs text-gray-500">
                Dueño: {store.owner_name}
              </p>
            )}
            {provinceName && (
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <MapPin size={12} /> {provinceName}
              </p>
            )}
          </Card>
        </div>
      )}
      {store.whatsapp && (
        <div className="px-4 pt-3">
          <a
            href={`https://wa.me/${store.whatsapp}?text=${encodeURIComponent(`Hola, vi tu tienda ${store.name} en Mercado Cuba`)}`}
            target="_blank"
            rel="noreferrer"
            className="w-full bg-green-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-green-500 transition-all flex items-center justify-center gap-2"
          >
            <MessageCircle size={18} /> Escribir a la tienda
          </a>
        </div>
      )}
      <div className="p-4">
        <input
          className="w-full pl-4 py-3 rounded-xl border border-gray-700 bg-gray-800 text-white outline-none"
          placeholder="Buscar productos..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      {filtered.length === 0 && (
        <div className="text-center py-16 px-6">
          <ShoppingBag size={48} className="mx-auto mb-4 text-gray-600" />
          <p className="text-sm text-gray-400">
            {filter
              ? "Ningún producto coincide con tu búsqueda."
              : "Esta tienda aún no tiene productos visibles."}
          </p>
        </div>
      )}
      <div className="px-4 pb-4 grid grid-cols-2 gap-3">
        {filtered.map((p) => (
          <div
            key={p.id}
            className="bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-700 flex flex-col"
          >
            <ImageGallery imagesStr={p.image_url} />
            <div className="p-3 flex-1 flex flex-col">
              <h3 className="text-sm font-medium text-gray-200 line-clamp-2 mb-2">
                {p.name}
              </h3>
              <div className="mt-auto flex flex-col gap-1.5">
                <div className="flex flex-wrap gap-1 items-baseline">
                  {Number(p.price_cup) > 0 && (
                    <span className="font-black text-white text-sm">
                      {p.price_cup} CUP
                    </span>
                  )}
                  {Number(p.price_usd) > 0 && (
                    <span className="font-bold text-emerald-400 text-xs bg-emerald-900/30 px-1.5 py-0.5 rounded ml-auto">
                      {p.price_usd} USD
                    </span>
                  )}
                </div>
                <button
                  onClick={() => contact(p)}
                  className="w-full mt-1 bg-blue-600 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <MessageCircle size={14} /> Pedir
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
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
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <button
          onClick={() => navigate("/")}
          className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ChevronLeft size={20} /> Volver
        </button>
        <Card className="p-8">
          <h2 className="text-2xl font-bold text-white text-center mb-6 uppercase tracking-widest">
            {currMode === "login"
              ? "Bienvenido"
              : currMode === "register"
                ? "Registro"
                : "Admin"}
          </h2>
          {currMode === "register" && (
            <div className="mb-5 p-4 bg-emerald-900/20 border border-emerald-600/30 rounded-xl">
              <h3 className="text-sm font-bold text-emerald-400 mb-2">
                ¿Qué incluye la licencia?
              </h3>
              <ul className="text-xs text-gray-300 space-y-1 list-disc pl-4">
                <li>Tu tienda con enlace propio para compartir</li>
                <li>Pedidos directos por WhatsApp</li>
                <li>Aparece en el mercado global y por provincia</li>
              </ul>
              <p className="text-xs text-gray-400 mt-2">
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
              <button
                onClick={() => setCurrMode("register")}
                className="text-blue-400 text-sm block w-full hover:text-blue-300"
              >
                ¿Eres nuevo? Regístrate
              </button>
            )}
            {currMode === "register" &&
              (superAdminContact ? (
                <a
                  href={`https://wa.me/${superAdminContact}?text=${encodeURIComponent("Necesito código")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-green-500 text-sm block w-full hover:text-green-400 flex justify-center gap-1 items-center"
                >
                  <MessageCircle size={14} /> Pedir licencia
                </a>
              ) : (
                <span className="text-green-500/50 text-sm block w-full flex justify-center gap-1 items-center">
                  <MessageCircle size={14} /> Cargando contacto...
                </span>
              ))}
            {currMode !== "login" && (
              <button
                onClick={() => setCurrMode("login")}
                className="text-gray-400 text-sm hover:text-white"
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
    await saveProduct(formP, !!editP);
    setModal(false);
  };

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
    <div className="min-h-screen bg-gray-900 pb-24">
      <div className="bg-gray-800 p-4 sticky top-0 z-20 border-b border-gray-700 flex justify-between items-center shadow-lg">
        <h2 className="font-bold text-white text-lg truncate">
          {myStore?.name}
        </h2>
        <button
          onClick={() => {
            logout();
            navigate("/");
          }}
          className="bg-red-900/20 text-red-400 p-3 rounded-xl hover:bg-red-600 transition-all"
        >
          <LogOut size={20} />
        </button>
      </div>

      <div className="p-4">
        {tab === "prod" ? (
          <div className="space-y-4">
            {/* --- NUEVA TARJETA DE ENLACE COMPARTIBLE --- */}
            {myStore && (
              <div className="mb-8 p-6 bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border border-blue-500/30 shadow-2xl flex flex-col items-center text-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-600/10 rounded-xl">
                    <Store className="text-blue-500" size={30} />
                  </div>
                  <h1 className="text-white font-bold text-sm" size={18}>
                    Tu tienda está lista
                  </h1>
                  <br></br>
                  <div>
                    <p className="text-gray-400 text-[11px] uppercase tracking-wider font-medium">
                      Comparte este enlace con tus clientes
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-black/40 p-2 pl-4 rounded-xl border border-gray-700 w-full max-w-md">
                  <span className="text-sm font-mono text-blue-400 truncate flex-1">
                    {`${window.location.origin}/${myStore.slug || myStore.name.toLowerCase().trim().replace(/\s+/g, "-")}`}
                  </span>
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/${myStore.slug || myStore.name.toLowerCase().trim().replace(/\s+/g, "-")}`;
                      navigator.clipboard.writeText(url);
                      notify("¡Enlace copiado!");
                    }}
                    className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-lg transition-all active:scale-90"
                  >
                    <Copy size={18} />
                  </button>
                </div>
              </div>
            )}
            {/* --- FIN DE TARJETA --- */}
            {myProducts.map((p) => (
              <div
                key={p.id}
                className={`bg-gray-800 p-3 rounded-2xl border border-gray-700 flex gap-3 items-center ${!p.is_visible && "opacity-50"}`}
              >
                <div className="w-16 h-16 bg-gray-900 rounded-xl overflow-hidden shrink-0 border border-gray-700">
                  <SafeImage
                    src={parseImages(p.image_url)[0]}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-gray-200 text-sm truncate">
                    {p.name}
                  </h4>
                  <p className="text-xs text-emerald-400 font-mono mt-1">
                    {p.price_cup} CUP / {p.price_usd} USD
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => openModal(p)}
                    className="bg-gray-700 p-2 rounded-lg text-blue-400"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() =>
                      saveProduct({ ...p, is_visible: !p.is_visible }, true)
                    }
                    className="bg-gray-700 p-2 rounded-lg text-gray-400"
                  >
                    {p.is_visible ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button
                    onClick={() => deleteProduct(p.id)}
                    className="bg-gray-700 p-2 rounded-lg text-red-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
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
              <label className="block text-xs font-bold text-gray-400 mb-1.5 ml-1 uppercase tracking-wider">
                Descripción de la tienda
              </label>
              <textarea
                className="w-full px-4 py-3 rounded-xl border border-gray-700 bg-gray-800 text-white outline-none focus:border-blue-500"
                rows="3"
                value={formS.description || ""}
                onChange={(e) =>
                  setFormS({ ...formS, description: e.target.value })
                }
              />
            </div>
            <div className="flex items-center gap-4 p-4 bg-gray-900 rounded-xl border border-gray-700">
              <SafeImage
                src={formS.logoUrl}
                className="w-16 h-16 rounded-full overflow-hidden"
              />
              <label className="bg-blue-600 text-white px-4 py-2 rounded-lg cursor-pointer text-xs font-bold uppercase">
                Subir Logo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageUpload(e, "logo")}
                />
              </label>
            </div>
            <div className="p-4 bg-gray-900/50 rounded-2xl border border-gray-700 flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-bold text-white">Mercado Global</h4>
                <p className="text-[10px] text-gray-500">
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
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <select
              className="w-full px-4 py-3.5 rounded-xl border border-gray-700 bg-gray-800 text-white outline-none appearance-none"
              value={formS.province_id || ""}
              onChange={(e) =>
                setFormS({ ...formS, province_id: e.target.value })
              }
            >
              <option value="" className="text-gray-500">
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

      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 flex justify-around p-2 pb-5 z-50">
        <button
          onClick={() => setTab("prod")}
          className={`flex flex-col items-center p-2 rounded-2xl w-24 transition-all ${tab === "prod" ? "text-blue-400 bg-gray-700/50" : "text-gray-500"}`}
        >
          <Grid size={24} />
          <span className="text-[10px] font-bold uppercase">Productos</span>
        </button>
        <button
          onClick={() => setTab("conf")}
          className={`flex flex-col items-center p-2 rounded-2xl w-24 transition-all ${tab === "conf" ? "text-blue-400 bg-gray-700/50" : "text-gray-500"}`}
        >
          <SettingsIcon size={24} />
          <span className="text-[10px] font-bold uppercase">Ajustes</span>
        </button>
      </div>

      {tab === "prod" && (
        <button
          onClick={() => openModal(null)}
          className="fixed bottom-24 right-4 bg-blue-600 text-white p-4 rounded-full shadow-2xl z-40 hover:scale-110 transition-transform"
        >
          <Plus size={28} />
        </button>
      )}

      {modal && (
        <div className="fixed inset-0 bg-gray-900 z-[60] overflow-y-auto p-4 animate-fade-in">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-xl text-white">
              {editP ? "Editar Producto" : "Nuevo Producto"}
            </h3>
            <button
              onClick={() => setModal(false)}
              className="bg-gray-800 p-2 rounded-full text-gray-400"
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
                  onChange={(e) =>
                    setFormP({ ...formP, category: e.target.value })
                  }
                />
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
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
              <label className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer uppercase">
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
                    className="aspect-square bg-black rounded-xl overflow-hidden relative"
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
                      className="absolute top-1 right-1 bg-red-600 rounded-full p-1 text-white"
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

  useEffect(() => {
    setAdminContact(superAdminContact);
  }, [superAdminContact]);

  if (!adminData) return null;
  const { stats, stores, codes } = adminData;

  const handleStoreReset = (e) => {
    e.preventDefault();
    adminResetStorePass(selStore.id, resetP);
    setResetP("");
  };

  return (
    <div className="min-h-screen bg-gray-900 pb-20">
      <nav className="bg-gray-800 p-4 sticky top-0 z-20 flex justify-between shadow-lg border-b border-gray-700">
        <h2 className="font-bold text-white tracking-widest uppercase">
          Master Panel
        </h2>
        <button
          onClick={() => {
            logout();
            navigate("/");
          }}
        >
          <LogOut className="text-red-400" />
        </button>
      </nav>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 border-l-4 border-blue-500">
            <div className="text-xs text-gray-400 font-bold uppercase">
              Tiendas
            </div>
            <div className="text-3xl text-white font-black">
              {stats.total_stores}
            </div>
          </Card>
          <Card className="p-4 border-l-4 border-emerald-500">
            <div className="text-xs text-gray-400 font-bold uppercase">
              Licencias
            </div>
            <div className="text-3xl text-white font-black">
              {stats.available_licenses}
            </div>
          </Card>
        </div>

        <div className="flex gap-2">
          {["stores", "codes", "sec"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-full text-xs font-bold uppercase transition-all ${tab === t ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 border border-gray-700"}`}
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
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {codes.map((c) => (
                <div
                  key={c.id}
                  className="flex justify-between items-center p-3 bg-gray-900 rounded-lg border border-gray-700"
                >
                  <span className="font-mono text-gray-300 font-bold">
                    {c.code}
                  </span>
                  <button
                    onClick={() => deleteCode(c.id)}
                    className="text-red-400 hover:scale-110"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {tab === "stores" && (
          <div className="space-y-3">
            {stores.map((s) => {
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
                      ? "border-l-4 border-red-500 bg-red-900/5"
                      : "border-l-4 border-blue-500"
                  }`}
                >
                  <div className="flex-1 min-w-0 w-full">
                    <h4 className="font-bold text-gray-200 text-lg">
                      {s.name}
                    </h4>
                    <p className="text-xs text-gray-500 mb-2">
                      {s.owner_name} • {s.whatsapp} •{" "}
                      {s.created_at.split("T")[0]}
                    </p>

                    {/* Contenedor de la URL y botón de copiar */}
                    <div className="flex items-center gap-2 bg-gray-900/80 p-2 rounded-xl border border-gray-700 w-full sm:w-fit group">
                      <span className="text-[11px] text-blue-400 font-mono truncate max-w-[200px] sm:max-w-xs">
                        {storeUrl}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(storeUrl);
                          notify("¡Enlace copiado!");
                        }}
                        className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-all active:scale-90"
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
                      className="p-2.5 bg-blue-900/20 text-blue-400 rounded-xl hover:bg-blue-900/40 transition-colors"
                    >
                      <Info size={18} />
                    </button>
                    <button
                      onClick={() => toggleStore(s.id, s.is_suspended)}
                      className="p-2.5 bg-gray-800 rounded-xl text-gray-400 hover:text-white transition-colors border border-gray-700"
                    >
                      {s.is_suspended ? (
                        <CheckCircle size={18} />
                      ) : (
                        <Ban size={18} />
                      )}
                    </button>
                    <button
                      onClick={() => deleteStore(s.id)}
                      className="p-2.5 bg-red-900/20 text-red-400 rounded-xl hover:bg-red-900/40 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {tab === "sec" && (
          <div className="space-y-4">
            <Card className="p-5">
              <h3 className="text-white font-bold mb-4 uppercase text-sm">
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
              <h3 className="text-white font-bold mb-4 uppercase text-sm">
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
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md p-6 relative animate-zoom-in">
            <button
              onClick={() => setSelStore(null)}
              className="absolute top-4 right-4 text-gray-400"
            >
              <X />
            </button>
            <h3 className="text-xl font-black text-white mb-6 uppercase tracking-widest">
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

            <div className="bg-red-900/20 p-4 rounded-xl border border-red-900/40">
              <h4 className="text-red-400 font-bold text-xs mb-3 uppercase tracking-widest">
                Zona de Seguridad
              </h4>
              <Input
                label="Resetear Password"
                placeholder="Nueva clave..."
                value={resetP}
                onChange={(e) => setResetP(e.target.value)}
              />
              <Button onClick={handleStoreReset} className="w-full bg-red-600">
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
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <Card className="p-8 max-w-sm w-full text-center space-y-4">
        <h2 className="text-2xl font-black text-white">
          Página no encontrada
        </h2>
        <p className="text-sm text-gray-400">
          La dirección que buscaste no existe.
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
