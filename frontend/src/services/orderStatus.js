// Espelha backend/src/lib/orderStatus.js — mantidos em sincronia manualmente.

export const STATUS_FLOW = ["RECEBIDO", "EM_PREPARO", "SAIU_PARA_ENTREGA", "ENTREGUE"];

export const statusLabels = {
  RECEBIDO: "Recebido",
  EM_PREPARO: "Em preparo",
  SAIU_PARA_ENTREGA: "Saiu para entrega",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
};

export const statusColors = {
  RECEBIDO: "bg-yellow-100 text-yellow-700",
  EM_PREPARO: "bg-orange-100 text-orange-700",
  SAIU_PARA_ENTREGA: "bg-purple-100 text-purple-700",
  ENTREGUE: "bg-green-100 text-green-700",
  CANCELADO: "bg-red-100 text-red-700",
};

// Cor da faixa/topo de cada coluna do Kanban
export const columnAccent = {
  RECEBIDO: "border-yellow-400",
  EM_PREPARO: "border-orange-400",
  SAIU_PARA_ENTREGA: "border-purple-400",
  ENTREGUE: "border-green-400",
  CANCELADO: "border-red-400",
};

export function getNextStatus(current) {
  const idx = STATUS_FLOW.indexOf(current);
  if (idx === -1 || idx === STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[idx + 1];
}

export const TERMINAL_STATUSES = ["ENTREGUE", "CANCELADO"];
