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
  patchSize: (id, data) => api.patch(`/catalog/sizes/${id}`, data).then((r) => r.data),
  patchFlavor: (id, data) => api.patch(`/catalog/flavors/${id}`, data).then((r) => r.data),
  patchBorder: (id, data) => api.patch(`/catalog/borders/${id}`, data).then((r) => r.data),
  patchProduct: (id, data) => api.patch(`/catalog/products/${id}`, data).then((r) => r.data),
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
  getTodayReport: () => api.get("/orders/reports/today").then((r) => r.data),
  lookupCliente: (phone) => api.get("/orders/cliente/lookup", { params: { phone } }).then((r) => r.data),
};

export const salaoService = {
  getMesas: () => api.get("/salao/mesas").then((r) => r.data),
  abrirMesa: (numero) => api.post(`/salao/mesas/${numero}/abrir`).then((r) => r.data),
  getComanda: (id) => api.get(`/salao/comandas/${id}`).then((r) => r.data),
  addItem: (comandaId, item) => api.post(`/salao/comandas/${comandaId}/itens`, item).then((r) => r.data),
  removeItem: (comandaId, itemId) => api.delete(`/salao/comandas/${comandaId}/itens/${itemId}`).then((r) => r.data),
  fecharComanda: (id, paymentMethod) => api.post(`/salao/comandas/${id}/fechar`, { paymentMethod }).then((r) => r.data),
  getRodizioPrecos: () => api.get("/salao/rodizio/precos").then((r) => r.data),
  patchRodizioPreco: (faixa, data) => api.put(`/salao/rodizio/precos/${faixa}`, data).then((r) => r.data),
};

export const caixaService = {
  getAtual: (tipo = "SALAO") => api.get("/caixa/atual", { params: { tipo } }).then((r) => r.data),
  abrir: (data) => api.post("/caixa/abrir", data).then((r) => r.data),
  sangria: (id, data) => api.post(`/caixa/${id}/sangria`, data).then((r) => r.data),
  suprimento: (id, data) => api.post(`/caixa/${id}/suprimento`, data).then((r) => r.data),
  fechar: (id) => api.post(`/caixa/${id}/fechar`).then((r) => r.data),
  conferir: (id, data) => api.post(`/caixa/${id}/conferir`, data).then((r) => r.data),
  getHistorico: () => api.get("/caixa/historico").then((r) => r.data),
};

export const motoboyService = {
  getLista: () => api.get("/motoboy/lista").then((r) => r.data),
  getDespacho: () => api.get("/motoboy/despacho").then((r) => r.data),
  getTurnoAtual: (motoboyId) => api.get("/motoboy/turnos/atual", { params: motoboyId ? { motoboyId } : {} }).then((r) => r.data),
  getHistorico: () => api.get("/motoboy/turnos/historico").then((r) => r.data),
  abrirTurno: (data) => api.post("/motoboy/turnos/abrir", data).then((r) => r.data),
  lancarExtra: (turnoId, data) => api.post(`/motoboy/turnos/${turnoId}/extras`, data).then((r) => r.data),
  fecharTurno: (turnoId, data) => api.post(`/motoboy/turnos/${turnoId}/fechar`, data).then((r) => r.data),
  conferirTurno: (turnoId) => api.post(`/motoboy/turnos/${turnoId}/conferir`).then((r) => r.data),
  despachar: (orderId, motoboyId) => api.patch(`/orders/${orderId}/status`, { status: "SAIU_PARA_ENTREGA", motoboyId }).then((r) => r.data),
  marcarEntregue: (orderId) => api.patch(`/orders/${orderId}/status`, { status: "ENTREGUE" }).then((r) => r.data),
};

export const authService = {
  login: (email, password) => api.post("/auth/login", { email, password }).then((r) => r.data),
  me: () => api.get("/auth/me").then((r) => r.data),
};

export const adminUsersService = {
  create: (data) => api.post("/admin/users", data).then((r) => r.data),
};
