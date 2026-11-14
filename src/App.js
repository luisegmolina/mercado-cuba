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
  timeAgo,
  RatesBanner,
  orderMessage,
  ProductDetailModal,
  PhotoUploader,
  CUBA_HERO,
  firstProductImage,
  cleanName,
  useGoBack,
  useCloseDetail,
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
  useSearchParams,
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
  UserPlus,
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
  Save,
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

// WhatsApp de soporte/licencias. Es el mismo número que devuelve
// GET /api/public/config. Se usa como valor inicial para que el botón
// "Solicitar licencia" funcione desde el primer render y nunca se quede
// en "Cargando contacto..." mientras el backend despierta (el plan
// gratis de Render tarda ~50 s en arrancar en frío); el fetch de abajo
// solo lo actualiza si el backend devuelve otro número.
const FALLBACK_ADMIN_CONTACT = "18063168743";

const APP_NAME = "Mercado Cuba";

// Copiar texto al portapapeles. navigator.clipboard falla fuera de HTTPS,
// sin permiso o en algunos WebView (APK): en ese caso se usa el método
// clásico con un textarea temporal. Devuelve true si se copió.
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
};

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
                : t.type === "warning"
                  ? "bg-white border-amber-400 text-amber-600"
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
  const [adminUsers, setAdminUsers] = useState([]);
  const [superAdminContact, setSuperAdminContact] = useState(
    FALLBACK_ADMIN_CONTACT
  );
  // Cuenta migrada sin clave que debe crearla en el primer login.
  const [needsPassword, setNeedsPassword] = useState(null);
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

  // Obtener configuración pública (como WhatsApp de soporte).
  // Reintenta solo con pausas crecientes: el backend gratis se duerme
  // y el primer intento casi siempre cae en el arranque en frío (~50 s).
  // Si todos los intentos fallan, el contacto de respaldo ya está puesto
  // y el botón de licencia sigue funcionando.
  useEffect(() => {
    let cancelled = false;
    const delays = [2000, 5000, 10000, 20000, 30000, 30000, 30000];
    const fetchConfig = async () => {
      for (let attempt = 0; attempt <= delays.length; attempt++) {
        try {
          const res = await fetch(`${API_URL}/public/config`);
          if (!res.ok) throw new Error("Backend no disponible");
          const data = await res.json();
          if (!cancelled && data.whatsapp) {
            setSuperAdminContact(data.whatsapp);
          }
          return;
        } catch (e) {
          if (attempt === delays.length) {
            console.warn("Usando configuración local por defecto.");
            return;
          }
          await new Promise((resolve) =>
            setTimeout(resolve, delays[attempt])
          );
        }
      }
    };
    fetchConfig();
    return () => {
      cancelled = true;
    };
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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // Cuenta migrada sin clave: hay que crearla en el primer login.
        if (data.must_reset_password) {
          setNeedsPassword({ whatsapp: normalizePhone(whatsapp) });
          notify("Tu cuenta no tiene contraseña. Pídele al administrador que te ponga una.", "error");
          return;
        }
        throw new Error(data.error || "Error en el servidor");
      }
      const data = await res.json();
      setToken(data.token);
      setCurrentUser({
        role: "vendor",
        storeId: data.store ? data.store.id : null,
        name: data.user ? data.user.owner_name : data.store?.owner_name,
      });
      setMyStore(data.store || null);
      setMyProducts(Array.isArray(data.products) ? data.products : []);
      notify(`Bienvenido, ${data.store ? data.store.name : "vendedor"}`);
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
      // Las fotos viajan como array de URLs (el backend las guarda en
      // product_images; data: en base64 ya no se acepta).
      const payload = { ...prod, images: prod.images || [] };
      delete payload.image_url;
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

  // Edición rápida: solo precio CUP/USD y stock, sin abrir el modal.
  // El PUT parcial del backend conserva lo demás y refresca updated_at.
  const quickSaveProduct = async (
    id,
    patch,
    okMessage = "Precio actualizado",
  ) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/products/${id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Error al guardar");
      const saved = await res.json();
      setMyProducts((prev) => prev.map((p) => (p.id === id ? saved : p)));
      notify(okMessage);
      return saved;
    } catch (err) {
      notify(err.message, "error");
      return null;
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

  // Auditoría: lee el registro de eventos (solo superadmin). Devuelve
  // { items, total, actions } o null si falla.
  const fetchAudit = async ({
    limit = 20,
    offset = 0,
    action = null,
    actorType = null,
    q = null,
  } = {}) => {
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
      });
      if (action) params.set("action", action);
      if (actorType) params.set("actor_type", actorType);
      if (q) params.set("q", q);
      const res = await fetch(`${API_URL}/admin/audit?${params.toString()}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      return await res.json();
    } catch (e) {
      notify(e.message || "Error al cargar la auditoría", "error");
      return null;
    }
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

  // Ubicación: el superadmin agrega y quita provincias y municipios.
  // El servidor rechaza borrar lo que tenga tiendas o municipios
  // (409 con el motivo); aquí solo mostramos su mensaje.
  const createProvince = async (name) => {
    try {
      const res = await fetch(`${API_URL}/admin/provinces`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      await loadProvinces();
      notify("Provincia agregada");
      return true;
    } catch (e) {
      notify(e.message || "Error al agregar la provincia", "error");
      return false;
    }
  };

  const deleteProvince = async (id, name) => {
    if (!window.confirm(`¿Eliminar la provincia ${name}?`)) return false;
    try {
      const res = await fetch(`${API_URL}/admin/provinces/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      await loadProvinces();
      notify("Provincia eliminada");
      return true;
    } catch (e) {
      notify(e.message || "Error al eliminar la provincia", "error");
      return false;
    }
  };

  const createMunicipality = async (provinceId, name) => {
    try {
      const res = await fetch(`${API_URL}/admin/municipalities`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ province_id: provinceId, name }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      notify("Municipio agregado");
      return true;
    } catch (e) {
      notify(e.message || "Error al agregar el municipio", "error");
      return false;
    }
  };

  const deleteMunicipality = async (id, name) => {
    if (!window.confirm(`¿Eliminar el municipio ${name}?`)) return false;
    try {
      const res = await fetch(`${API_URL}/admin/municipalities/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      notify("Municipio eliminado");
      return true;
    } catch (e) {
      notify(e.message || "Error al eliminar el municipio", "error");
      return false;
    }
  };

  const extendCode = async (id, days = 365) => {
    try {
      const res = await fetch(`${API_URL}/admin/codes/${id}/extend`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ days }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      fetchAdminData();
      notify("Licencia extendida");
    } catch (e) {
      notify(friendlyError(e), "error");
    }
  };

  const revokeCode = async (id) => {
    if (!window.confirm("¿Revocar esta licencia? La tienda pierde la vigencia."))
      return;
    try {
      const res = await fetch(`${API_URL}/admin/codes/${id}/revoke`, {
        method: "PUT",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      fetchAdminData();
      notify("Licencia revocada");
    } catch (e) {
      notify(friendlyError(e), "error");
    }
  };

  // Conceder una licencia disponible a una tienda existente (p. ej. las
  // tiendas migradas, que no tienen ninguna concesión).
  const grantLicense = async (storeId, licenseId) => {
    try {
      const res = await fetch(`${API_URL}/admin/store/${storeId}/grant`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ license_id: licenseId }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      fetchAdminData();
      notify("Licencia concedida");
      return true;
    } catch (e) {
      notify(friendlyError(e), "error");
      return false;
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
    if (
      !window.confirm(
        "¿ELIMINAR TIENDA? También se eliminará su usuario dueño si no tiene otra tienda.",
      )
    )
      return;
    await fetch(`${API_URL}/admin/store/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    fetchAdminData();
    notify("Tienda eliminada");
  };

  // Usuarios (panel Super Admin): lista, borrado y reset de clave.
  const fetchAdminUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/users`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setAdminUsers(data.users || []);
      }
    } catch (e) {}
  };

  const deleteAdminUser = async (id) => {
    try {
      const res = await fetch(`${API_URL}/admin/users/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      const data = await res.json();
      notify(
        data.stores_deleted > 0
          ? `Usuario eliminado (${data.stores_deleted} tienda(s) borrada(s))`
          : "Usuario eliminado",
      );
      fetchAdminUsers();
      fetchAdminData();
    } catch (e) {
      notify(e.message || "Error al eliminar el usuario", "error");
    }
  };

  const adminResetUserPass = async (userId, newPassword) => {
    try {
      const res = await fetch(`${API_URL}/admin/users/${userId}/password`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ newPassword }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      notify("Clave de usuario restablecida");
    } catch (e) {
      notify(e.message || "Error", "error");
    }
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

  // Tasas de cambio (elTOQUE): el admin las actualiza a mano desde el
  // panel; el banner público las lee de /api/public/rates.
  const updateRates = async (rates) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/rates`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ rates }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      notify("Tasas actualizadas");
      return true;
    } catch (err) {
      notify(friendlyError(err), "error");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateAdminPass = async (password, currentPassword) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/password`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ password, currentPassword }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      notify("Contraseña actualizada");
      return true;
    } catch (err) {
      notify(friendlyError(err), "error");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setToken(null);
    setMyStore(null);
    setMyProducts([]);
    setAdminData(null);
    setNeedsPassword(null);
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
        needsPassword,
        saveProduct,
        quickSaveProduct,
        deleteProduct,
        updateStoreSettings,
        loginSuperAdmin,
        fetchAdminData,
        fetchAudit,
        adminUsers,
        fetchAdminUsers,
        deleteAdminUser,
        adminResetUserPass,
        generateCode,
        toggleStore,
        deleteStore,
        updateAdminPass,
        adminResetStorePass,
        adminUpdateStoreContact,
        updateSuperAdminContact,
        updateRates,
        getStoreById,
        deleteCode,
        extendCode,
        revokeCode,
        grantLicense,
        createProvince,
        deleteProvince,
        createMunicipality,
        deleteMunicipality,
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
  // El detalle destacado vive en la URL (?producto=<id>): abrirlo es un
  // paso del historial y atrás lo cierra.
  const [searchParams, setSearchParams] = useSearchParams();
  const productoId = searchParams.get("producto");
  const detailProduct = productoId
    ? featured.find((p) => p.id === productoId) || null
    : null;
  const closeDetail = useCloseDetail();
  const openDetail = (p) => {
    const next = new URLSearchParams(searchParams);
    next.set("producto", p.id);
    setSearchParams(next);
  };
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

  // Parámetro de producto que no está entre los destacados (enlace
  // directo): quítalo sin añadir historial.
  useEffect(() => {
    if (
      productoId &&
      (featured.length > 0 || productsTotal !== null) &&
      !detailProduct
    ) {
      const next = new URLSearchParams(searchParams);
      next.delete("producto");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoId, featured, productsTotal]);

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

  // El backend ya devuelve el slug real de cada tienda (antes se
  // derivaba del nombre y enlazaba a 404 cuando no coincidía).
  const storeSlug = (s) => s.slug || "";

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
              onClick={() => navigate("/register")}
              className="sm:col-span-2 w-full bg-cyan-600 text-white py-4 rounded-2xl text-base font-extrabold hover:bg-cyan-500 transition-all flex items-center justify-center gap-2 shadow-xl active:scale-[0.98]"
            >
              <UserPlus size={20} /> Crear Mi Tienda
            </button>
            <button
              onClick={() => navigate("/login")}
              className="w-full bg-sky-900 text-white py-3.5 rounded-2xl text-sm font-bold hover:bg-sky-800 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <User size={18} /> Soy Vendedor (Entrar)
            </button>
            <button
              onClick={() => setShowManual(true)}
              className="w-full bg-sky-900 text-white py-3.5 rounded-2xl text-sm font-bold hover:bg-sky-800 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <FileText size={18} /> ¿Cómo funciona? (Guía)
            </button>
            {superAdminContact ? (
              <a
                href={licenseUrl}
                target="_blank"
                rel="noreferrer"
                className="sm:col-span-2 w-full bg-emerald-600 text-white py-4 rounded-2xl text-base font-extrabold hover:bg-emerald-500 transition-all flex items-center justify-center gap-2 text-center shadow-glow-green active:scale-[0.98]"
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
                  onClick={() => openDetail(p)}
                  className="group bg-white rounded-3xl overflow-hidden border border-slate-200 text-left shadow-xl transition-all hover:-translate-y-1 hover:shadow-2xl hover:border-cyan-300 active:scale-[0.98]"
                >
                  <div className="aspect-square bg-sky-50 overflow-hidden relative">
                    <SafeImage
                      src={parseImages(p.images ?? p.image_url)[0]}
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
          onClose={closeDetail}
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
  const [visibleCount, setVisibleCount] = useState(12);
  const goBack = useGoBack("/explorar");
  const closeDetail = useCloseDetail();
  const [searchParams, setSearchParams] = useSearchParams();
  const productoId = searchParams.get("producto");

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

  // Parámetro de producto que no está en la tienda (enlace directo
  // obsoleto): quítalo sin añadir historial.
  useEffect(() => {
    if (productoId && !loadingStore && data) {
      const found = (data.products || []).some((p) => p.id === productoId);
      if (!found) {
        const next = new URLSearchParams(searchParams);
        next.delete("producto");
        setSearchParams(next, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoId, loadingStore, data]);

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
  // El detalle vive en la URL (?producto=<id>): abrirlo es un paso del
  // historial y atrás lo cierra.
  const detailProduct = productoId
    ? visibleProducts.find((p) => p.id === productoId) || null
    : null;
  const openDetail = (p) => {
    const next = new URLSearchParams(searchParams);
    next.set("producto", p.id);
    setSearchParams(next);
  };
  const filtered = visibleProducts.filter((p) =>
    (p.name || "").toLowerCase().includes(filter.toLowerCase()),
  );
  const provinceName = store.province_name || store.province || "";
  // Ubicación completa: "Municipio, Provincia" cuando hay municipio.
  const locationName = [store.municipality_name, provinceName]
    .filter(Boolean)
    .join(", ");
  const coverImage = firstProductImage(visibleProducts) || CUBA_HERO;

  const contact = (p) => {
    window.open(
      waLink(
        store.whatsapp,
        orderMessage({
          name: p.name,
          prices: priceLabel(p),
          storeName: store.name,
          province: locationName,
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
          onClick={goBack}
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
            {locationName && (
              <p className="text-xs text-sky-100 font-medium flex items-center gap-1 mt-0.5">
                <MapPin size={12} /> {locationName}
              </p>
            )}
          </div>
        </div>
      </div>
      {(store.description || store.owner_name || locationName) && (
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
            {locationName && (
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <MapPin size={12} /> {locationName}
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
            onClick={() => openDetail(p)}
            className="group bg-white rounded-3xl overflow-hidden shadow-xl border border-slate-200 flex flex-col cursor-pointer transition-all hover:-translate-y-1 hover:shadow-2xl hover:border-cyan-300 active:scale-[0.98]"
          >
            <div className="relative">
              <ImageGallery imagesStr={p.images ?? p.image_url} />
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
          onClose={closeDetail}
        />
      )}
    </div>
  );
};

const AuthScreen = ({ mode }) => {
  const navigate = useNavigate();
  const goBack = useGoBack("/");
  const {
    loginStore,
    registerStore,
    loginSuperAdmin,
    currentUser,
    superAdminContact,
    needsPassword,
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
          onClick={goBack}
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
          {/* Cuenta sin contraseña: solo el administrador puede ponerla. */}
          {currMode === "login" && needsPassword && (
            <div className="mt-5 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-xs text-amber-700">
                Tu cuenta aún no tiene contraseña. Pídele al administrador
                que te ponga una para poder entrar.
              </p>
            </div>
          )}
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
    quickSaveProduct,
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
  // Confirmación en dos toques para el diálogo de producto: el primer
  // Guardar con proporción rara solo avisa, el segundo confirma.
  const [confirmP, setConfirmP] = useState(null);
  // Buscador y paginación de mis productos (10 por página).
  const [prodQuery, setProdQuery] = useState("");
  const [prodPage, setProdPage] = useState(1);
  // Edición rápida por producto: { [id]: { priceCup, priceUsd, stock } }.
  // Solo se guarda lo que el vendedor cambió; al guardar se limpia.
  const [quickEdits, setQuickEdits] = useState({});
  const [quickBusy, setQuickBusy] = useState({});
  // Confirmación en dos toques para la edición rápida: el primer
  // Guardar con proporción rara solo avisa (guarda {id, cup, usd}),
  // el segundo confirma. Nada de diálogos nativos (window.confirm):
  // en el navegador automático se descartan solos y el guardado
  // moría en silencio, sin ningún aviso.
  const [confirmQuick, setConfirmQuick] = useState(null);

  const quickValues = (p) => ({
    priceCup: quickEdits[p.id]?.priceCup ?? p.price_cup ?? 0,
    priceUsd: quickEdits[p.id]?.priceUsd ?? p.price_usd ?? 0,
    stock: quickEdits[p.id]?.stock ?? p.stock ?? 0,
  });
  const isQuickDirty = (p) => {
    const q = quickEdits[p.id];
    if (!q) return false;
    return (
      Number(q.priceCup) !== Number(p.price_cup ?? 0) ||
      Number(q.priceUsd) !== Number(p.price_usd ?? 0) ||
      Number(q.stock) !== Number(p.stock ?? 0)
    );
  };
  const clearQuickEdit = (id) => {
    setConfirmQuick(null);
    setQuickEdits((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };
  const setQuickBusyId = (id, busy) =>
    setQuickBusy((prev) => ({ ...prev, [id]: busy }));

  const saveQuick = async (p) => {
    const q = quickValues(p);
    const cup = Number(q.priceCup) || 0;
    const usd = Number(q.priceUsd) || 0;
    if (cup <= 0 && usd <= 0) {
      notify("Pon al menos un precio (CUP o USD).", "error");
      return;
    }
    // Misma cordura que en el formulario completo: la tasa informal
    // hoy ronda ~910 CUP por USD; fuera de 100–1000 casi seguro hay
    // un error. Primer toque solo avisa; el segundo confirma.
    if (cup > 0 && usd > 0) {
      const ratio = cup / usd;
      if (ratio < 100 || ratio > 1000) {
        const confirmed =
          confirmQuick &&
          confirmQuick.id === p.id &&
          confirmQuick.cup === cup &&
          confirmQuick.usd === usd;
        if (!confirmed) {
          setConfirmQuick({ id: p.id, cup, usd });
          notify(
            `Revisa los precios: ${cup} CUP por ${usd} USD está muy lejos de la tasa informal. Pulsa Guardar de nuevo para confirmar.`,
            "warning",
          );
          return;
        }
        setConfirmQuick(null);
      }
    }
    setQuickBusyId(p.id, true);
    const saved = await quickSaveProduct(p.id, {
      priceCup: cup,
      priceUsd: usd,
      stock: Math.max(0, Math.floor(Number(q.stock) || 0)),
    });
    setQuickBusyId(p.id, false);
    if (saved) clearQuickEdit(p.id);
  };

  // Agotado = stock 0; Disponible lo vuelve a 1 (luego se ajusta la
  // cantidad exacta en el campo de stock si hace falta).
  const toggleOutOfStock = async (p) => {
    const out = Number(p.stock) > 0;
    setQuickBusyId(p.id, true);
    const saved = await quickSaveProduct(
      p.id,
      { stock: out ? 0 : 1 },
      out ? "Marcado como agotado" : "Marcado como disponible",
    );
    setQuickBusyId(p.id, false);
    if (saved) clearQuickEdit(p.id);
  };

  const [formS, setFormS] = useState({
    name: myStore?.name || "",
    description: myStore?.description || "",
    logoUrl: myStore?.logo_url || "",
    whatsapp: myStore?.whatsapp || "",
    is_public: myStore?.is_public ?? true,
    province_id: myStore?.province_id || "",
    municipality_id: myStore?.municipality_id || "",
  });
  // Enlace de foto nueva (opción secundaria: el flujo principal es
  // subir desde el celular/cámara con PhotoUploader; el enlace solo
  // es para quien ya tiene la foto publicada en internet).
  const [photoUrl, setPhotoUrl] = useState("");

  // Sincroniza el formulario de Ajustes cuando la tienda llega
  // (p. ej. tras restaurar la sesión) o cambia al guardar.
  useEffect(() => {
    if (!myStore) return;
    setFormS({
      name: myStore.name || "",
      description: myStore.description || "",
      logoUrl: myStore.logo_url || "",
      whatsapp: myStore.whatsapp || "",
      is_public: !!myStore.is_public,
      province_id: myStore.province_id || "",
      municipality_id: myStore.municipality_id || "",
    });
  }, [myStore]);

  // Municipios de la provincia elegida (el campo es opcional: la tienda
  // puede quedar sin municipio). Se recargan cada vez que cambia la
  // provincia; si la tienda ya tiene provincia, cargan al abrir Ajustes.
  const [municipalities, setMunicipalities] = useState([]);
  useEffect(() => {
    const provinceId = formS.province_id;
    if (!provinceId) {
      setMunicipalities([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${API_URL}/public/municipalities?province_id=${provinceId}`,
        );
        if (!res.ok) throw new Error("No se pudieron cargar los municipios");
        const data = await res.json();
        if (!cancelled) setMunicipalities(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        if (!cancelled) setMunicipalities([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [formS.province_id]);

  const openModal = (p) => {
    setEditP(p);
    setConfirmP(null);
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
            images: parseImages(p.images ?? p.image_url),
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
    // La tasa informal hoy ronda ~910 CUP por USD: si la relación
    // sale de 100–1000, casi seguro un precio quedó mal escrito.
    // Primer Guardar solo avisa; el segundo confirma.
    if (cup > 0 && usd > 0) {
      const ratio = cup / usd;
      if (ratio < 100 || ratio > 1000) {
        const confirmed =
          confirmP && confirmP.cup === cup && confirmP.usd === usd;
        if (!confirmed) {
          setConfirmP({ cup, usd });
          notify(
            `Revisa los precios: ${cup} CUP por ${usd} USD está muy lejos de la tasa informal. Pulsa Guardar de nuevo para confirmar.`,
            "warning",
          );
          return;
        }
        setConfirmP(null);
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

  // Añade una foto por su enlace (opción secundaria; máx. 3 por
  // producto). Solo URLs https: el backend rechaza base64 (data:)
  // con error 400.
  const addPhotoUrl = () => {
    const url = (photoUrl || "").trim();
    if (!url) return;
    if (!/^https:\/\//i.test(url) || /^data:/i.test(url)) {
      notify("Pega un enlace https válido", "error");
      return;
    }
    if ((formP.images || []).length >= 3) {
      notify("Máximo 3 fotos por producto", "error");
      return;
    }
    setFormP((prev) => ({ ...prev, images: [...(prev.images || []), url] }));
    setPhotoUrl("");
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
                    {`${window.location.origin}/${myStore.slug}`}
                  </span>
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/${myStore.slug}`;
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
            {prodPageProducts.map((p) => {
              const q = quickValues(p);
              const dirty = isQuickDirty(p);
              const busy = !!quickBusy[p.id];
              const out = Number(p.stock) === 0;
              return (
                <div
                  key={p.id}
                  className={`bg-white p-3 rounded-2xl border border-slate-200 ${!p.is_visible && "opacity-50"}`}
                >
                  <div className="flex gap-3 items-center">
                    <div className="w-16 h-16 bg-white rounded-xl overflow-hidden shrink-0 border border-slate-200">
                      <SafeImage
                        src={parseImages(p.images ?? p.image_url)[0]}
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
                      {p.updated_at && (
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Actualizado {timeAgo(p.updated_at)}
                        </p>
                      )}
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
                          saveProduct(
                            { ...p, is_visible: !p.is_visible },
                            true,
                          )
                        }
                        className="bg-slate-100 p-2 rounded-lg text-slate-500"
                      >
                        {p.is_visible ? (
                          <Eye size={16} />
                        ) : (
                          <EyeOff size={16} />
                        )}
                      </button>
                      <button
                        onClick={() => deleteProduct(p.id)}
                        className="bg-slate-100 p-2 rounded-lg text-rose-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  {/* --- Edición rápida: precio y stock sin abrir el formulario --- */}
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-end gap-2">
                      <label className="flex-1 min-w-0">
                        <span className="block text-[10px] font-bold uppercase text-slate-400">
                          CUP
                        </span>
                        <input
                          type="number"
                          min="0"
                          inputMode="decimal"
                          value={q.priceCup}
                          disabled={busy}
                          onChange={(e) =>
                            setQuickEdits((prev) => ({
                              ...prev,
                              [p.id]: { ...q, priceCup: e.target.value },
                            }))
                          }
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-900 outline-none focus:border-cyan-500"
                        />
                      </label>
                      <label className="flex-1 min-w-0">
                        <span className="block text-[10px] font-bold uppercase text-slate-400">
                          USD
                        </span>
                        <input
                          type="number"
                          min="0"
                          inputMode="decimal"
                          value={q.priceUsd}
                          disabled={busy}
                          onChange={(e) =>
                            setQuickEdits((prev) => ({
                              ...prev,
                              [p.id]: { ...q, priceUsd: e.target.value },
                            }))
                          }
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-900 outline-none focus:border-cyan-500"
                        />
                      </label>
                      <label className="w-16 shrink-0">
                        <span className="block text-[10px] font-bold uppercase text-slate-400">
                          Stock
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          inputMode="numeric"
                          value={q.stock}
                          disabled={busy}
                          onChange={(e) =>
                            setQuickEdits((prev) => ({
                              ...prev,
                              [p.id]: { ...q, stock: e.target.value },
                            }))
                          }
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-900 outline-none focus:border-cyan-500"
                        />
                      </label>
                      <button
                        onClick={() => saveQuick(p)}
                        disabled={!dirty || busy}
                        className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl bg-cyan-600 text-white text-xs font-bold disabled:opacity-40"
                      >
                        <Save size={14} />{" "}
                        {confirmQuick && confirmQuick.id === p.id
                          ? "Confirmar"
                          : "Guardar"}
                      </button>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => toggleOutOfStock(p)}
                        disabled={busy}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold disabled:opacity-40 ${
                          out
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "bg-rose-50 border-rose-200 text-rose-600"
                        }`}
                      >
                        <Ban size={13} />
                        {out ? "Volver a disponible" : "Marcar agotado"}
                      </button>
                      {out && (
                        <span className="inline-flex items-center text-[11px] font-bold px-2 py-1 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20">
                          Agotado
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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
            <div className="p-4 bg-white rounded-xl border border-slate-200">
              <PhotoUploader
                images={formS.logoUrl ? [formS.logoUrl] : []}
                onChange={(imgs) =>
                  setFormS((prev) => ({ ...prev, logoUrl: imgs[0] || "" }))
                }
                max={1}
                single
                label="Logo de la tienda"
              />
              <div className="mt-3 pt-3 border-t border-slate-100">
                <label className="block text-[11px] text-slate-500 mb-1.5">
                  ¿Prefieres pegar un enlace? (opcional)
                </label>
                <input
                  type="url"
                  placeholder="https://... (enlace de la imagen)"
                  value={formS.logoUrl || ""}
                  onChange={(e) =>
                    setFormS({ ...formS, logoUrl: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm outline-none focus:border-cyan-500"
                />
              </div>
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
                  checked={formS.is_public}
                  onChange={(e) =>
                    setFormS({ ...formS, is_public: e.target.checked })
                  }
                />
                <div className="w-11 h-6 bg-slate-100 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
              </label>
            </div>

            <select
              className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-900 outline-none appearance-none"
              value={formS.province_id || ""}
              onChange={(e) =>
                // Cambiar de provincia limpia el municipio: los
                // municipios pertenecen a una sola provincia.
                setFormS({
                  ...formS,
                  province_id: e.target.value,
                  municipality_id: "",
                })
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

            <select
              className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-900 outline-none appearance-none disabled:opacity-50"
              value={formS.municipality_id || ""}
              disabled={!formS.province_id}
              onChange={(e) =>
                setFormS({ ...formS, municipality_id: e.target.value })
              }
            >
              <option value="" className="text-slate-500">
                {formS.province_id
                  ? "Municipio (opcional)..."
                  : "Primero elige la provincia..."}
              </option>
              {municipalities.map((mun) => (
                <option key={mun.id} value={mun.id}>
                  {mun.name}
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
              <PhotoUploader
                images={formP.images || []}
                onChange={(imgs) =>
                  setFormP((prev) => ({ ...prev, images: imgs }))
                }
                max={3}
                label="Fotos"
              />
              <div className="mt-4 pt-3 border-t border-slate-100">
                <p className="text-[11px] text-slate-500 mb-2">
                  ¿Prefieres pegar un enlace? También puedes añadir una
                  foto por su enlace de internet.
                </p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://... (enlace de la foto)"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addPhotoUrl();
                      }
                    }}
                    className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm outline-none focus:border-cyan-500 placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={addPhotoUrl}
                    className="bg-cyan-600 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase shrink-0"
                  >
                    Añadir
                  </button>
                </div>
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

// Etiquetas legibles para las acciones de auditoría (si aparece una
// acción nueva sin etiqueta, se muestra el nombre tal cual).
const AUDIT_ACTION_LABELS = {
  login: "Inicio de sesión",
  login_failed: "Inicio de sesión fallido",
  store_register: "Tienda registrada",
  product_create: "Producto creado",
  product_update: "Producto editado",
  product_delete: "Producto borrado",
  store_settings: "Ajustes de tienda guardados",
  province_create: "Provincia agregada",
  province_delete: "Provincia eliminada",
  municipality_create: "Municipio agregado",
  municipality_delete: "Municipio eliminado",
  license_create: "Licencia creada",
  license_delete: "Licencia borrada",
  license_revoke: "Licencia revocada",
  license_extend: "Licencia extendida",
  license_grant: "Licencia concedida",
  store_suspend: "Tienda suspendida",
  store_unsuspend: "Tienda reactivada",
  store_delete: "Tienda eliminada",
  user_delete: "Usuario eliminado",
  user_password_reset: "Clave de vendedor reseteada",
  store_contact_change: "Contacto de tienda cambiado",
  admin_password_change: "Clave del admin cambiada",
  admin_contact_change: "Contacto del admin cambiado",
  admin_rates_update: "Tasas actualizadas",
  db_migration: "Migración de base de datos",
};

// Formatea un valor del detalle de un evento de auditoría para mostrarlo.
// Sin esto, los objetos se veían como "[object Object]" (le pasó a las tasas).
const formatAuditDetail = (k, v) => {
  if (k === "valid_until") return new Date(v).toLocaleDateString();
  if (k === "rates" && Array.isArray(v))
    return v.map((r) => `${r.currency} ${r.rate_cup}`).join(" · ");
  if (v !== null && typeof v === "object") return JSON.stringify(v);
  return String(v);
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
    extendCode,
    revokeCode,
    grantLicense,
    adminResetStorePass,
    adminUpdateStoreContact,
    updateSuperAdminContact,
    updateRates,
    fetchAudit,
    adminUsers,
    fetchAdminUsers,
    deleteAdminUser,
    adminResetUserPass,
    provinces,
    createProvince,
    deleteProvince,
    createMunicipality,
    deleteMunicipality,
    superAdminContact,
  } = useContext(AppContext);
  const navigate = useNavigate();
  const [tab, setTab] = useState("stores");
  const [pass, setPass] = useState("");
  const [currentPass, setCurrentPass] = useState("");
  const [selStore, setSelStore] = useState(null);
  const [resetP, setResetP] = useState("");
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState(null);
  const [userPassDraft, setUserPassDraft] = useState({});

  // Al abrir la pestaña Usuarios, carga la lista desde el backend.
  useEffect(() => {
    if (tab === "users") fetchAdminUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [grantLicenseId, setGrantLicenseId] = useState("");
  const [adminContact, setAdminContact] = useState(superAdminContact);
  // Búsqueda y paginación del panel (Tiendas: 10/pág; Licencias: 15/pág).
  const [storeQuery, setStoreQuery] = useState("");
  const [storeStatus, setStoreStatus] = useState("all");
  const [storePage, setStorePage] = useState(1);
  const [codeQuery, setCodeQuery] = useState("");
  const [codePage, setCodePage] = useState(1);
  // Ubicación: provincia elegida para gestionar sus municipios y los
  // nombres nuevos que el admin está escribiendo.
  const [locProvinceId, setLocProvinceId] = useState("");
  const [locMunicipalities, setLocMunicipalities] = useState([]);
  const [newProvinceName, setNewProvinceName] = useState("");
  const [newMunicipalityName, setNewMunicipalityName] = useState("");
  // Auditoría: eventos del registro, con filtros y paginación.
  const AUDIT_PER_PAGE = 20;
  const [auditItems, setAuditItems] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditActions, setAuditActions] = useState([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditAction, setAuditAction] = useState("");
  const [auditActor, setAuditActor] = useState("");
  const [auditQuery, setAuditQuery] = useState("");
  const [auditAppliedQuery, setAuditAppliedQuery] = useState("");
  const [auditLoading, setAuditLoading] = useState(false);
  // Tasas de cambio (elTOQUE): se cargan del endpoint público y se
  // guardan con PUT /api/admin/rates al pulsar Guardar.
  const [ratesForm, setRatesForm] = useState({
    USD: "",
    EUR: "",
    MLC: "",
    CAD: "",
    MXN: "",
    ZELLE: "",
    CLA: "",
  });
  const [ratesLoaded, setRatesLoaded] = useState(false);
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState(null);

  useEffect(() => {
    if (tab !== "rates" || ratesLoaded) return;
    fetch(`${API_URL}/public/rates`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || !Array.isArray(d.rates)) return;
        const next = { USD: "", EUR: "", MLC: "", CAD: "", MXN: "", ZELLE: "", CLA: "" };
        let latest = null;
        for (const row of d.rates) {
          if (row.currency in next)
            next[row.currency] = String(row.rate_cup ?? "");
          if (row.updated_at && (!latest || row.updated_at > latest))
            latest = row.updated_at;
        }
        setRatesForm(next);
        setRatesUpdatedAt(latest);
        setRatesLoaded(true);
      })
      .catch(() => {});
  }, [tab, ratesLoaded]);

  const saveRates = async (e) => {
    e.preventDefault();
    const rates = ["USD", "EUR", "MLC", "CAD", "MXN", "ZELLE", "CLA"]
      .map((currency) => ({
        currency,
        rate_cup: Number(String(ratesForm[currency]).replace(",", ".")),
      }))
      .filter((r) => Number.isFinite(r.rate_cup) && r.rate_cup > 0);
    if (rates.length === 0) {
      notify("Pon al menos una tasa mayor que 0.", "error");
      return;
    }
    const ok = await updateRates(rates);
    if (ok) {
      setRatesUpdatedAt(new Date().toISOString());
      setRatesLoaded(true);
    }
  };

  useEffect(() => {
    setAdminContact(superAdminContact);
  }, [superAdminContact]);

  // Ubicación: municipios de la provincia elegida en esta pestaña.
  // (La función y el efecto van ANTES del return de abajo: los hooks
  // no pueden llamarse después de un return condicional.)
  const loadLocMunicipalities = async (provinceId) => {
    if (!provinceId) {
      setLocMunicipalities([]);
      return;
    }
    try {
      const res = await fetch(
        `${API_URL}/public/municipalities?province_id=${provinceId}`,
      );
      if (!res.ok) throw new Error("No se pudieron cargar los municipios");
      const data = await res.json();
      setLocMunicipalities(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setLocMunicipalities([]);
    }
  };
  useEffect(() => {
    loadLocMunicipalities(locProvinceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locProvinceId]);

  // Auditoría: carga los eventos cuando se abre la pestaña o cambian
  // los filtros o la página.
  const loadAudit = async () => {
    setAuditLoading(true);
    const data = await fetchAudit({
      limit: AUDIT_PER_PAGE,
      offset: (auditPage - 1) * AUDIT_PER_PAGE,
      action: auditAction || null,
      actorType: auditActor || null,
      q: auditAppliedQuery || null,
    });
    if (data) {
      setAuditItems(data.items || []);
      setAuditTotal(data.total || 0);
      setAuditActions(data.actions || []);
    }
    setAuditLoading(false);
  };
  useEffect(() => {
    if (tab !== "audit") return;
    loadAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, auditPage, auditAction, auditActor, auditAppliedQuery]);

  if (!adminData) return null;
  const { stats, stores, codes } = adminData;
  // Licencias disponibles para conceder a una tienda (sin canjear).
  const availableLicenses = codes.filter((c) => c.status === "active");

  // --- Filtrado y paginación de Tiendas (10 por página) ---
  const STORES_PER_PAGE = 10;
  const CODES_PER_PAGE = 15;
  const norm = (v) => String(v || "").toLowerCase();
  const storeQueryNorm = storeQuery.trim().toLowerCase();
  const filteredStores = stores.filter((s) => {
    if (storeStatus === "active" && s.is_suspended) return false;
    if (storeStatus === "suspended" && !s.is_suspended) return false;
    if (!storeQueryNorm) return true;
    const slug = s.slug || "";
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

  const handleCreateProvince = async (e) => {
    e.preventDefault();
    const name = newProvinceName.trim();
    if (!name) return;
    if (await createProvince(name)) setNewProvinceName("");
  };

  const handleCreateMunicipality = async (e) => {
    e.preventDefault();
    const name = newMunicipalityName.trim();
    if (!name || !locProvinceId) return;
    if (await createMunicipality(locProvinceId, name)) {
      setNewMunicipalityName("");
      loadLocMunicipalities(locProvinceId);
    }
  };

  const handleDeleteMunicipality = async (mun) => {
    if (await deleteMunicipality(mun.id, mun.name)) {
      loadLocMunicipalities(locProvinceId);
    }
  };

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
          <Card className="p-4 border-l-4 border-sky-500">
            <div className="text-xs text-slate-500 font-bold uppercase">
              Usuarios
            </div>
            <div className="text-3xl text-slate-900 font-black">
              {stats.total_users}
            </div>
          </Card>
          <Card className="p-4 border-l-4 border-emerald-500">
            <div className="text-xs text-slate-500 font-bold uppercase">
              Licencias disp.
            </div>
            <div className="text-3xl text-slate-900 font-black">
              {stats.available_licenses}
            </div>
          </Card>
          <Card className="p-4 border-l-4 border-amber-500">
            <div className="text-xs text-slate-500 font-bold uppercase">
              Concesiones activas
            </div>
            <div className="text-3xl text-slate-900 font-black">
              {stats.active_grants}
            </div>
            {stats.expiring_soon > 0 && (
              <div className="text-[11px] text-amber-600 font-bold mt-1">
                {stats.expiring_soon} vencen en 30 días
              </div>
            )}
          </Card>
        </div>

        <div className="flex flex-wrap gap-2">
          {["stores", "users", "codes", "rates", "loc", "audit", "sec"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-full text-xs font-bold uppercase transition-all ${tab === t ? "bg-cyan-600 text-white" : "bg-white text-slate-500 border border-slate-200"}`}
            >
              {t === "stores"
                ? "Tiendas"
                : t === "users"
                  ? "Usuarios"
                  : t === "codes"
                  ? "Licencias"
                  : t === "rates"
                    ? "Tasas"
                    : t === "loc"
                      ? "Ubicación"
                      : t === "audit"
                        ? "Auditoría"
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
                  className="p-3 bg-white rounded-lg border border-slate-200 space-y-2"
                >
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-mono text-slate-600 font-bold">
                      {c.code}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        c.status === "active"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : c.status === "used"
                            ? "bg-cyan-500/10 text-cyan-700"
                            : c.status === "expired"
                              ? "bg-amber-500/10 text-amber-600"
                              : "bg-rose-500/10 text-rose-600"
                      }`}
                    >
                      {c.status === "active"
                        ? "Disponible"
                        : c.status === "used"
                          ? "En uso"
                          : c.status === "expired"
                            ? "Caducada"
                            : "Revocada"}
                    </span>
                  </div>
                  {c.store_name && (
                    <p className="text-xs text-slate-500">
                      {c.store_name}
                      {c.valid_until &&
                        ` · vence ${c.valid_until.split("T")[0]}`}
                    </p>
                  )}
                  {c.status === "active" && !c.store_name && (
                    <p className="text-xs text-slate-500">
                      Vigencia al canjear: {c.duration_days || 365} días
                      {c.expires_at &&
                        ` · el código caduca ${c.expires_at.split("T")[0]}`}
                    </p>
                  )}
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={async () => {
                        const ok = await copyToClipboard(c.code);
                        notify(
                          ok
                            ? "Código copiado"
                            : "No se pudo copiar el código",
                          ok ? "success" : "error",
                        );
                      }}
                      className="flex items-center gap-1 text-xs font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 px-3 py-1.5 rounded-lg hover:bg-cyan-100"
                      title="Copiar código de licencia"
                    >
                      <Copy size={14} /> Copiar
                    </button>
                    {c.status === "used" && (
                      <>
                        <button
                          onClick={() => extendCode(c.id, 365)}
                          className="text-xs font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 px-3 py-1.5 rounded-lg hover:bg-cyan-100"
                        >
                          Extender +365 días
                        </button>
                        <button
                          onClick={() => revokeCode(c.id)}
                          className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-100"
                        >
                          Revocar
                        </button>
                      </>
                    )}
                    {c.status !== "used" && (
                      <button
                        onClick={() => deleteCode(c.id)}
                        className="text-rose-600 hover:scale-110 p-1.5"
                        title="Borrar licencia"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
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
              const storeSlug = s.slug || "";
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
                      {!s.is_public && (
                        <span className="ml-2 text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full align-middle">
                          oculta
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-slate-500 mb-2">
                      {s.owner_name} • {formatPhone(s.whatsapp)} •{" "}
                      {s.created_at.split("T")[0]}
                      {s.license_valid_until
                        ? ` • licencia hasta ${s.license_valid_until.split("T")[0]}`
                        : " • sin licencia vigente"}
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

        {tab === "users" && (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">
              {adminUsers.length} usuario(s). Borrar un usuario borra también
              sus tiendas. La clave se cambia aquí mismo, mínimo 10 caracteres.
            </p>
            {adminUsers.map((u) => (
              <Card key={u.id} className="p-4 space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="font-bold text-slate-900">
                      {u.owner_name}
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      {u.whatsapp}
                    </div>
                    <div className="text-xs text-slate-500">
                      {u.store_count > 0
                        ? `Tienda: ${u.store_name}${u.store_count > 1 ? ` (+${u.store_count - 1} más)` : ""}`
                        : "Sin tienda"}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (confirmDeleteUserId === u.id) {
                        setConfirmDeleteUserId(null);
                        deleteAdminUser(u.id);
                      } else {
                        setConfirmDeleteUserId(u.id);
                        notify(
                          "Toca Confirmar para borrar este usuario y sus tiendas",
                          "warning",
                        );
                      }
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                      confirmDeleteUserId === u.id
                        ? "bg-amber-500 text-white"
                        : "bg-rose-100 text-rose-600"
                    }`}
                  >
                    {confirmDeleteUserId === u.id ? "Confirmar" : "Eliminar"}
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="Nueva clave (mín. 10)"
                    value={userPassDraft[u.id] || ""}
                    onChange={(e) =>
                      setUserPassDraft({
                        ...userPassDraft,
                        [u.id]: e.target.value,
                      })
                    }
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm outline-none focus:border-cyan-500"
                  />
                  <button
                    onClick={() => {
                      if ((userPassDraft[u.id] || "").length < 10) {
                        notify(
                          "La contraseña debe tener al menos 10 caracteres",
                          "error",
                        );
                        return;
                      }
                      adminResetUserPass(u.id, userPassDraft[u.id]);
                      setUserPassDraft({ ...userPassDraft, [u.id]: "" });
                    }}
                    className="px-3 py-2 rounded-xl bg-cyan-600 text-white text-xs font-bold"
                  >
                    Cambiar clave
                  </button>
                </div>
              </Card>
            ))}
            {adminUsers.length === 0 && (
              <Card className="p-6">
                <p className="text-sm text-slate-500 text-center">
                  No hay usuarios.
                </p>
              </Card>
            )}
          </div>
        )}

        {tab === "rates" && (
          <Card className="p-5">
            <h3 className="text-slate-900 font-bold mb-1 uppercase text-sm">
              Tasa de cambio informal
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Es la tasa que ven todos en el banner de arriba, con fuente
              elTOQUE. Cópiala de{" "}
              <a
                href="https://eltoque.com/tasas-de-cambio-cuba"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-700 underline"
              >
                eltoque.com/tasas-de-cambio-cuba
              </a>{" "}
              y actualízala cada mañana. Si la dejas vacía, esa moneda no
              se muestra.
              {ratesUpdatedAt && (
                <> Última actualización: {timeAgo(ratesUpdatedAt)}.</>
              )}
            </p>
            <form onSubmit={saveRates} className="space-y-3">
              {["USD", "EUR", "MLC", "CAD", "MXN", "ZELLE", "CLA"].map((currency) => (
                <label key={currency} className="block">
                  <span className="block text-[11px] font-bold uppercase text-slate-400">
                    1 {currency} en CUP
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="Ej. 910"
                    value={ratesForm[currency]}
                    onChange={(e) =>
                      setRatesForm((prev) => ({
                        ...prev,
                        [currency]: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 outline-none focus:border-cyan-500"
                  />
                </label>
              ))}
              <Button type="submit" className="w-full">
                Guardar tasas
              </Button>
            </form>
          </Card>
        )}

        {tab === "loc" && (
          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="font-bold text-slate-900 mb-1">Provincias</h3>
              <p className="text-xs text-slate-500 mb-3">
                Agregar o quitar provincias. No se puede borrar una provincia
                que tenga municipios o tiendas.
              </p>
              <form onSubmit={handleCreateProvince} className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Nombre de la provincia..."
                  value={newProvinceName}
                  onChange={(e) => setNewProvinceName(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-900 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 outline-none transition-all placeholder:text-slate-500 text-sm"
                />
                <Button type="submit">Agregar</Button>
              </form>
              <div className="space-y-2">
                {provinces.map((prov) => (
                  <div
                    key={prov.id}
                    className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2"
                  >
                    <span className="text-sm font-bold text-slate-800">
                      {prov.name}
                    </span>
                    <button
                      onClick={() => deleteProvince(prov.id, prov.name)}
                      className="text-rose-600 p-1"
                      title="Eliminar provincia"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-bold text-slate-900 mb-1">Municipios</h3>
              <p className="text-xs text-slate-500 mb-3">
                Elige la provincia para ver sus municipios. No se puede
                borrar un municipio que tenga tiendas.
              </p>
              <select
                className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-900 outline-none appearance-none mb-3"
                value={locProvinceId}
                onChange={(e) => setLocProvinceId(e.target.value)}
              >
                <option value="" className="text-slate-500">
                  Seleccionar provincia...
                </option>
                {provinces.map((prov) => (
                  <option key={prov.id} value={prov.id}>
                    {prov.name}
                  </option>
                ))}
              </select>
              {locProvinceId && (
                <>
                  <form
                    onSubmit={handleCreateMunicipality}
                    className="flex gap-2 mb-3"
                  >
                    <input
                      type="text"
                      placeholder="Nombre del municipio..."
                      value={newMunicipalityName}
                      onChange={(e) => setNewMunicipalityName(e.target.value)}
                      className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-900 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 outline-none transition-all placeholder:text-slate-500 text-sm"
                    />
                    <Button type="submit">Agregar</Button>
                  </form>
                  <div className="space-y-2">
                    {locMunicipalities.map((mun) => (
                      <div
                        key={mun.id}
                        className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2"
                      >
                        <span className="text-sm font-bold text-slate-800">
                          {mun.name}
                        </span>
                        <button
                          onClick={() => handleDeleteMunicipality(mun)}
                          className="text-rose-600 p-1"
                          title="Eliminar municipio"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    {locMunicipalities.length === 0 && (
                      <p className="text-xs text-slate-500">
                        Sin municipios en esta provincia.
                      </p>
                    )}
                  </div>
                </>
              )}
            </Card>
          </div>
        )}

        {tab === "audit" && (
          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="font-bold text-slate-900 mb-1">Auditoría</h3>
              <p className="text-xs text-slate-500 mb-3">
                Registro automático de todo lo que se hace en la web: inicios
                de sesión, registros, productos, ajustes, licencias, tasas y
                cambios del admin. Solo tú puedes verlo.
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                <select
                  className="flex-1 min-w-0 px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-900 outline-none appearance-none text-sm"
                  value={auditAction}
                  onChange={(e) => {
                    setAuditAction(e.target.value);
                    setAuditPage(1);
                  }}
                >
                  <option value="">Todas las acciones</option>
                  {auditActions.map((a) => (
                    <option key={a} value={a}>
                      {AUDIT_ACTION_LABELS[a] || a}
                    </option>
                  ))}
                </select>
                <select
                  className="flex-1 min-w-0 px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-900 outline-none appearance-none text-sm"
                  value={auditActor}
                  onChange={(e) => {
                    setAuditActor(e.target.value);
                    setAuditPage(1);
                  }}
                >
                  <option value="">Todos los actores</option>
                  <option value="admin">SuperAdmin</option>
                  <option value="vendor">Vendedores</option>
                </select>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setAuditAppliedQuery(auditQuery);
                  setAuditPage(1);
                }}
                className="flex gap-2 mb-3"
              >
                <input
                  type="text"
                  placeholder="Buscar (tienda, código, WhatsApp...)"
                  value={auditQuery}
                  onChange={(e) => setAuditQuery(e.target.value)}
                  className="flex-1 min-w-0 px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-900 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 outline-none transition-all placeholder:text-slate-500 text-sm"
                />
                <Button type="submit">Buscar</Button>
              </form>
              <p className="text-xs text-slate-500 mb-3">
                {auditTotal} eventos
              </p>
              {auditLoading ? (
                <div className="flex items-center justify-center py-10 gap-2">
                  <Loader2
                    className="animate-spin text-cyan-700"
                    size={24}
                  />
                  <p className="text-slate-500 text-sm font-bold">
                    Cargando eventos...
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {auditItems.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-3 bg-white rounded-lg border border-slate-200 space-y-1"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {AUDIT_ACTION_LABELS[ev.action] || ev.action}
                        </span>
                        <span className="text-[11px] text-slate-500 shrink-0">
                          {new Date(ev.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {ev.actor_type === "admin"
                          ? "SuperAdmin"
                          : ev.actor_name
                            ? `${ev.actor_name}${ev.actor_whatsapp ? ` (${ev.actor_whatsapp})` : ""}`
                            : "Desconocido"}
                        {ev.target_type ? ` · ${ev.target_type}` : ""}
                      </p>
                      {ev.details && Object.keys(ev.details).length > 0 && (
                        <div className="text-xs text-slate-600 space-y-0.5">
                          {Object.entries(ev.details)
                            .filter(([k]) => !k.endsWith("_id"))
                            .map(([k, v]) => (
                              <p key={k}>
                                <span className="font-bold">{k}:</span>{" "}
                                {formatAuditDetail(k, v)}
                              </p>
                            ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {auditItems.length === 0 && (
                    <p className="text-xs text-slate-500 text-center py-6">
                      Sin eventos para estos filtros.
                    </p>
                  )}
                </div>
              )}
              {auditTotal > AUDIT_PER_PAGE && (
                <div className="flex items-center justify-between mt-4">
                  <button
                    onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                    disabled={auditPage <= 1}
                    className="px-4 py-2 rounded-full text-xs font-bold bg-white border border-slate-200 text-slate-500 disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <span className="text-xs text-slate-500">
                    Página {auditPage} de{" "}
                    {Math.max(1, Math.ceil(auditTotal / AUDIT_PER_PAGE))}
                  </span>
                  <button
                    onClick={() =>
                      setAuditPage((p) =>
                        Math.min(
                          Math.ceil(auditTotal / AUDIT_PER_PAGE),
                          p + 1,
                        ),
                      )
                    }
                    disabled={
                      auditPage >= Math.ceil(auditTotal / AUDIT_PER_PAGE)
                    }
                    className="px-4 py-2 rounded-full text-xs font-bold bg-white border border-slate-200 text-slate-500 disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </Card>
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
                placeholder="Clave actual"
                value={currentPass}
                onChange={(e) => setCurrentPass(e.target.value)}
              />
              <Input
                type="password"
                placeholder="Nueva Clave Admin (mín. 10 caracteres)"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
              />
              <Button
                onClick={async () => {
                  const ok = await updateAdminPass(pass, currentPass);
                  if (ok) {
                    setPass("");
                    setCurrentPass("");
                  }
                }}
                className="w-full"
              >
                Actualizar Clave
              </Button>
              <p className="text-xs text-slate-500 mt-3">
                Último cambio de clave:{" "}
                {adminData.password_changed_at
                  ? new Date(adminData.password_changed_at).toLocaleDateString(
                      "es-ES",
                      { day: "2-digit", month: "2-digit", year: "numeric" },
                    )
                  : "sin registro"}
              </p>
              <p className="text-xs text-slate-500">
                El recordatorio de cambio se activa cuando elijas el
                intervalo (30, 60 o 90 días).
              </p>
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

            <div className="bg-sky-50 p-4 rounded-xl border border-slate-200 mb-6">
              <h4 className="text-slate-900 font-bold text-xs mb-2 uppercase tracking-widest">
                Licencia
              </h4>
              {selStore.license_valid_until &&
              selStore.license_status === "active" &&
              new Date(selStore.license_valid_until) > new Date() ? (
                <p className="text-sm text-slate-600">
                  Vigente hasta{" "}
                  <strong>
                    {selStore.license_valid_until.split("T")[0]}
                  </strong>
                </p>
              ) : (
                <>
                  <p className="text-sm text-slate-600 mb-3">
                    Sin licencia vigente. Concede una disponible:
                  </p>
                  <select
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm outline-none mb-2"
                    value={grantLicenseId}
                    onChange={(e) => setGrantLicenseId(e.target.value)}
                  >
                    <option value="">Elegir licencia...</option>
                    {availableLicenses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} ({c.duration_days || 365} días)
                      </option>
                    ))}
                  </select>
                  <Button
                    className="w-full"
                    onClick={async () => {
                      if (!grantLicenseId) return;
                      const ok = await grantLicense(
                        selStore.id,
                        grantLicenseId,
                      );
                      if (ok) {
                        setGrantLicenseId("");
                        setSelStore(null);
                      }
                    }}
                  >
                    Conceder licencia
                  </Button>
                </>
              )}
            </div>

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
    <>
      <RatesBanner />
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
    </>
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
