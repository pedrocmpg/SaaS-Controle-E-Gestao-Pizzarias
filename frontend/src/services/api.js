import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3333/api";

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Permite enviar cookies automaticamente
});

// Estado para armazenar CSRF token
let csrfToken = null;

// Função para buscar CSRF token
export async function fetchCsrfToken() {
  try {
    const response = await api.get("/auth/csrf");
    csrfToken = response.data.csrfToken;
    return csrfToken;
  } catch (err) {
    console.error("Erro ao buscar CSRF token:", err);
    throw err;
  }
}

// Anexa o token do admin (se existir) em todas as requisições
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("etd_admin_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Anexa CSRF token se disponível
  if (csrfToken) {
    config.headers["X-CSRF-Token"] = csrfToken;
  }
  return config;
});

export const catalogService = {
  getAll: () => api.get("/catalog").then((r) => r.data),
  getSizes: () => api.get("/catalog/sizes").then((r) => r.data),
  getFlavors: (type) => api.get("/catalog/flavors", { params: { type } }).then((r) => r.data),
  getBorders: () => api.get("/catalog/borders").then((r) => r.data),
  getProducts: (category) => api.get("/catalog/products", { params: { category } }).then((r) => r.data),
};

export const settingsService = {
  get: () => api.get("/settings").then((r) => r.data),
  update: (data) => api.put("/settings", data).then((r) => r.data),
};

export const ordersService = {
  create: (data) => api.post("/orders", data).then((r) => r.data),
  list: (params) => api.get("/orders", { params }).then((r) => r.data),
  getById: (id) => api.get(`/orders/${id}`).then((r) => r.data),
  updateStatus: (id, status) => api.patch(`/orders/${id}/status`, { status }).then((r) => r.data),
};

export const authService = {
  login: (email, password) => api.post("/auth/login", { email, password }).then((r) => r.data),
  me: () => api.get("/auth/me").then((r) => r.data),
};

export const adminUsersService = {
  create: (data) => api.post("/admin/users", data).then((r) => r.data),
};
