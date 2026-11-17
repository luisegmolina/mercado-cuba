// Pruebas reales de los helpers de src/shared.js (teléfono y precios).
// El test de plantilla de Create React App ("learn react") no servía:
// la app no contiene ese texto y el test fallaba siempre.
//
// Los mocks de abajo existen porque shared.js también importa el router,
// los iconos y Capacitor: el jest de CRA no resuelve react-router-dom
// 7.13.0 (su "main" apunta a un dist/main.js que el paquete no trae;
// el build de webpack sí lo resuelve bien por "exports"). Los helpers
// que se prueban aquí no usan ninguno de esos módulos.
jest.mock("react-router-dom", () => ({}), { virtual: true });
jest.mock("lucide-react", () => ({}), { virtual: true });
jest.mock(
  "@capacitor/core",
  () => ({
    Capacitor: { isNativePlatform: () => false },
  }),
  { virtual: true },
);
jest.mock(
  "@capacitor/camera",
  () => ({
    Camera: {},
    CameraResultType: {},
    CameraSource: {},
  }),
  { virtual: true },
);

import {
  normalizePhone,
  formatPhone,
  waLink,
  formatPrice,
  plural,
  cleanName,
} from "./shared";

describe("normalizePhone", () => {
  test("Cuba: 8 dígitos -> 53 + número", () => {
    expect(normalizePhone("59150911")).toBe("5359150911");
  });

  test("Cuba: con código 53 se deja tal cual", () => {
    expect(normalizePhone("5359150911")).toBe("5359150911");
  });

  test("EEUU: 10 dígitos -> 1 + número", () => {
    expect(normalizePhone("8063168743")).toBe("18063168743");
  });

  test("EEUU: con código 1 se deja tal cual", () => {
    expect(normalizePhone("18063168743")).toBe("18063168743");
  });

  test("quita espacios y guiones", () => {
    expect(normalizePhone("591 509 11")).toBe("5359150911");
    expect(normalizePhone("806-316-8743")).toBe("18063168743");
  });

  test("vacío o sin dígitos -> vacío", () => {
    expect(normalizePhone("")).toBe("");
    expect(normalizePhone(null)).toBe("");
    expect(normalizePhone("abc")).toBe("");
  });
});

describe("formatPhone", () => {
  test("Cuba: +53 5915 0911", () => {
    expect(formatPhone("59150911")).toBe("+53 5915 0911");
  });

  test("EEUU: +1 (806) 316-8743", () => {
    expect(formatPhone("18063168743")).toBe("+1 (806) 316-8743");
  });

  test("vacío -> vacío", () => {
    expect(formatPhone("")).toBe("");
  });
});

describe("waLink", () => {
  test("sin texto", () => {
    expect(waLink("59150911")).toBe("https://wa.me/5359150911");
  });

  test("con texto codificado", () => {
    expect(waLink("59150911", "Hola, me interesa")).toBe(
      "https://wa.me/5359150911?text=Hola%2C%20me%20interesa",
    );
  });
});

describe("formatPrice", () => {
  test("entero: sin decimales; el separador de miles depende del CLDR", () => {
    // es-ES agrupa solo a partir de 7 dígitos en el CLDR actual
    // (1100 -> "1100", 1000000 -> "1.000.000"), así que se aceptan
    // ambas formas: lo que se fija aquí es que no hay decimales.
    expect(formatPrice(1100, "CUP")).toMatch(/^1[.]?100 CUP$/);
    expect(formatPrice(5, "USD")).toBe("5 USD");
  });

  test("con decimales: coma decimal, 2 decimales", () => {
    expect(formatPrice(5.5, "USD")).toBe("5,50 USD");
  });

  test("cero, negativo o no numérico -> vacío", () => {
    expect(formatPrice(0, "CUP")).toBe("");
    expect(formatPrice(-10, "CUP")).toBe("");
    expect(formatPrice("abc", "CUP")).toBe("");
  });
});

describe("plural", () => {
  test("1 -> singular, resto -> plural", () => {
    expect(plural(1, "tienda", "tiendas")).toBe("1 tienda");
    expect(plural(2, "tienda", "tiendas")).toBe("2 tiendas");
    expect(plural(0, "tienda", "tiendas")).toBe("0 tiendas");
  });
});

describe("cleanName", () => {
  test("recorta espacios", () => {
    expect(cleanName("  Las 40  ")).toBe("Las 40");
  });

  test("null -> vacío", () => {
    expect(cleanName(null)).toBe("");
  });
});
