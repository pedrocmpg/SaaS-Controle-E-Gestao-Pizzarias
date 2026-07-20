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
  createSize: (data) => api.post("/catalog/sizes", data).then((r) => r.data),
  updateSize: (id, data) => api.put(`/catalog/sizes/${id}`, data).then((r) => r.data),
  deleteSize: (id) => api.delete(`/catalog/sizes/${id}`).then((r) => r.data),
  createFlavor: (data) => api.post("/catalog/flavors", data).then((r) => r.data),
  updateFlavor: (id, data) => api.put(`/catalog/flavors/${id}`, data).then((r) => r.data),
  deleteFlavor: (id) => api.delete(`/catalog/flavors/${id}`).then((r) => r.data),
  createBorder: (data) => api.post("/catalog/borders", data).then((r) => r.data),
  updateBorder: (id, data) => api.put(`/catalog/borders/${id}`, data).then((r) => r.data),
  deleteBorder: (id) => api.delete(`/catalog/borders/${id}`).then((r) => r.data),
  createProduct: (data) => api.post("/catalog/products", data).then((r) => r.data),
  updateProduct: (id, data) => api.put(`/catalog/products/${id}`, data).then((r) => r.data),
  deleteProduct: (id) => api.delete(`/catalog/products/${id}`).then((r) => r.data),
};

export const ofertasService = {
  list: () => api.get("/ofertas").then((r) => r.data),
  getProdutosDisponiveis: () => api.get("/ofertas/produtos-disponiveis").then((r) => r.data),
  create: (data) => api.post("/ofertas", data).then((r) => r.data),
  update: (id, data) => api.put(`/ofertas/${id}`, data).then((r) => r.data),
  patch: (id, data) => api.patch(`/ofertas/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/ofertas/${id}`).then((r) => r.data),
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
  getReportSummary: (params) => api.get("/orders/reports/summary", { params }).then((r) => r.data),
  lookupCliente: (phone) => api.get("/orders/cliente/lookup", { params: { phone } }).then((r) => r.data),
};

export const salaoService = {
  listComandas: (params) => api.get("/salao/comandas", { params }).then((r) => r.data),
  abrirComanda: (numeroMesa) => api.post("/salao/comandas/abrir", numeroMesa != null ? { numeroMesa } : {}).then((r) => r.data),
  getComanda: (id) => api.get(`/salao/comandas/${id}`).then((r) => r.data),
  addItemProduto: (comandaId, data) => api.post(`/salao/comandas/${comandaId}/itens/produto`, data).then((r) => r.data),
  addItemPizza: (comandaId, data) => api.post(`/salao/comandas/${comandaId}/itens/pizza`, data).then((r) => r.data),
  updateItemQuantidade: (comandaId, itemId, quantidade) =>
    api.patch(`/salao/comandas/${comandaId}/itens/${itemId}`, { quantidade }).then((r) => r.data),
  removeItem: (comandaId, itemId) => api.delete(`/salao/comandas/${comandaId}/itens/${itemId}`).then((r) => r.data),
  fecharComanda: (id, paymentMethod) => api.post(`/salao/comandas/${id}/fechar`, { paymentMethod }).then((r) => r.data),
};

export const pdvConfigService = {
  getLojaConfig: () => api.get("/pdv-config/loja-config").then((r) => r.data),
  updateLojaConfig: (data) => api.put("/pdv-config/loja-config", data).then((r) => r.data),
  getGrupos: () => api.get("/pdv-config/grupos").then((r) => r.data),
  createGrupo: (data) => api.post("/pdv-config/grupos", data).then((r) => r.data),
  updateGrupo: (id, data) => api.put(`/pdv-config/grupos/${id}`, data).then((r) => r.data),
  deleteGrupo: (id) => api.delete(`/pdv-config/grupos/${id}`).then((r) => r.data),
  reordenarGrupos: (items) => api.put("/pdv-config/grupos/reordenar", { items }).then((r) => r.data),
  getBotoes: (grupoId) => api.get("/pdv-config/botoes", { params: grupoId ? { grupoId } : {} }).then((r) => r.data),
  createBotao: (data) => api.post("/pdv-config/botoes", data).then((r) => r.data),
  updateBotao: (id, data) => api.put(`/pdv-config/botoes/${id}`, data).then((r) => r.data),
  deleteBotao: (id) => api.delete(`/pdv-config/botoes/${id}`).then((r) => r.data),
  reordenarBotoes: (items) => api.put("/pdv-config/botoes/reordenar", { items }).then((r) => r.data),
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
  list: (role) => api.get("/admin/users", { params: role ? { role } : {} }).then((r) => r.data.admins),
  get: (id) => api.get(`/admin/users/${id}`).then((r) => r.data.admin),
  create: (data) => api.post("/admin/users", data).then((r) => r.data.admin),
  update: (id, data) => api.put(`/admin/users/${id}`, data).then((r) => r.data.admin),
  // Hard delete — não usado no fluxo de "excluir" das telas de cadastro (ver
  // update com { active: false }), pois falha com FK se o admin tiver
  // histórico de turno/pedido. Mantido só por paridade com o endpoint.
  remove: (id) => api.delete(`/admin/users/${id}`).then((r) => r.data),
};
