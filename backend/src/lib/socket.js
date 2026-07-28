/**
 * Servidor Socket.io — acompanhamento de pedidos em tempo real.
 *
 * Autenticação do handshake reaproveita o mesmo JWT do HTTP (Bearer via
 * socket.handshake.auth.token OU cookie httpOnly `token`) + blacklist.
 * Rooms por loja (`loja:{lojaId}`) para preparar terreno p/ múltiplas lojas.
 */

const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const cookie = require("cookie");
const prisma = require("./prisma");
const { isBlacklisted } = require("./tokenBlacklist");

let io = null;

// Mesma lista de origens permitidas do CORS HTTP (corsIpWhitelist.js)
function getAllowedOrigins() {
  return [
    process.env.FRONTEND_URL || "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:5173",
  ];
}

/**
 * Extrai o token JWT do handshake: primeiro `auth.token` (Bearer do
 * localStorage enviado pelo client), depois o cookie httpOnly `token`.
 */
function getTokenFromHandshake(socket) {
  const authToken = socket.handshake.auth && socket.handshake.auth.token;
  if (authToken) return authToken;

  const rawCookie = socket.handshake.headers.cookie;
  if (rawCookie) {
    const parsed = cookie.parse(rawCookie);
    if (parsed.token) return parsed.token;
  }
  return null;
}

/**
 * Middleware de autenticação do socket (espelha middleware/auth.js).
 */
async function authenticateSocket(socket, next) {
  try {
    const token = getTokenFromHandshake(socket);
    if (!token) return next(new Error("UNAUTHORIZED"));

    if (await isBlacklisted(token)) return next(new Error("TOKEN_REVOKED"));

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.data.admin = payload;
    next();
  } catch (err) {
    next(new Error("UNAUTHORIZED"));
  }
}

/**
 * Inicializa o Socket.io anexado ao servidor HTTP do Express.
 */
function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: getAllowedOrigins(),
      credentials: true,
    },
  });

  io.use(authenticateSocket);

  io.on("connection", async (socket) => {
    // Entra apenas na room da loja do admin (isolamento multi-tenant).
    // Operador vinculado → sua loja. SUPER_ADMIN global (lojaId null) → todas as lojas.
    const admin = socket.data.admin || {};

    // O agente local de impressão se declara no handshake. Só vale para operador vinculado
    // a uma loja: um agente é físico, roda no PC de UMA pizzaria.
    socket.data.agenteImpressao = Boolean(socket.handshake.auth && socket.handshake.auth.agente) && admin.lojaId != null;

    if (admin.lojaId != null) {
      socket.join(`loja:${admin.lojaId}`);
      if (socket.data.agenteImpressao) {
        emitAgenteStatus(admin.lojaId, true);
        socket.on("disconnect", async () => {
          // Só apaga o indicador se não sobrou nenhum outro agente da loja conectado
          // (o próprio socket já saiu da room neste ponto).
          emitAgenteStatus(admin.lojaId, await agenteConectado(admin.lojaId));
        });
      }
      return;
    }

    // SUPER_ADMIN sem loja: acompanha todas as lojas existentes.
    try {
      const lojas = await prisma.loja.findMany({ select: { id: true } });
      lojas.forEach((l) => socket.join(`loja:${l.id}`));
    } catch {
      socket.join("loja:1");
    }
  });

  return io;
}

function getIo() {
  return io;
}

/** Emite evento de novo pedido para a room da loja. */
function emitPedidoNovo(lojaId, order) {
  if (io) io.to(`loja:${lojaId}`).emit("pedido:novo", order);
}

/** Emite evento de status atualizado para a room da loja. */
function emitPedidoStatus(lojaId, order) {
  if (io) io.to(`loja:${lojaId}`).emit("pedido:status_atualizado", order);
}

/** Emite evento de pedido despachado a um motoboy (tela de despacho ao vivo). */
function emitDespachoAtribuido(lojaId, order) {
  if (io) io.to(`loja:${lojaId}`).emit("despacho:atribuido", order);
}

/** Emite evento de pedido entregue pelo motoboy (tela de despacho ao vivo). */
function emitDespachoEntregue(lojaId, order) {
  if (io) io.to(`loja:${lojaId}`).emit("despacho:entregue", order);
}

/** Novo job de impressão para o agente local da loja consumir. */
function emitImpressaoJob(lojaId, job) {
  if (io) io.to(`loja:${lojaId}`).emit("impressao:job", job);
}

/** Avisa o painel que o agente de impressão da loja conectou/desconectou. */
function emitAgenteStatus(lojaId, conectado) {
  if (io) io.to(`loja:${lojaId}`).emit("impressao:agente_status", { conectado });
}

/**
 * O agente de impressão está online nesta loja?
 *
 * Conta sockets na room que se declararam agente (`handshake.auth.agente`). Serve ao
 * indicador do painel: se a impressora cair no meio do movimento, o atendente precisa
 * descobrir na hora, não quando a cozinha reclamar.
 */
async function agenteConectado(lojaId) {
  if (!io) return false;
  const sockets = await io.in(`loja:${lojaId}`).fetchSockets();
  return sockets.some((s) => s.data && s.data.agenteImpressao);
}

module.exports = {
  initSocket,
  getIo,
  emitPedidoNovo,
  emitPedidoStatus,
  emitDespachoAtribuido,
  emitDespachoEntregue,
  emitImpressaoJob,
  emitAgenteStatus,
  agenteConectado,
};
