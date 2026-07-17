// Papéis de admin existentes no backend (Admin.role).
export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  GERENTE: "GERENTE",
  ATENDENTE: "ATENDENTE",
  MOTOBOY: "MOTOBOY",
};

// Grupos de papéis reaproveitados em rotas/menu — evita repetir os mesmos
// arrays em AdminRoute, Sidebar, etc.
export const OPERACAO_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.GERENTE, ROLES.ATENDENTE];
export const OPERACAO_COM_MOTOBOY_ROLES = [...OPERACAO_ROLES, ROLES.MOTOBOY];
export const GERENCIA_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.GERENTE];
export const CADASTRO_ROLES = GERENCIA_ROLES;
export const SUPER_ADMIN_ONLY = [ROLES.SUPER_ADMIN];
