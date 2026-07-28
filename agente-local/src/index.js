/**
 * Agente local de impressão térmica.
 *
 * Roda no PC do caixa da pizzaria. O backend está na nuvem e não alcança uma impressora
 * USB na cozinha — este processo é a ponte.
 *
 * NÃO abre portas e NÃO recebe conexões de entrada: conecta como CLIENTE ao WebSocket do
 * backend, autenticando com o mesmo JWT do sistema. Isso evita configuração de
 * firewall/NAT na pizzaria.
 *
 * Fluxo:
 *   1. conecta ao WebSocket (retry com backoff exponencial até 30s);
 *   2. no connect e a cada reconnect, busca GET /impressao/pendentes — nada gerado durante
 *      uma queda de internet se perde;
 *   3. recebe `impressao:job` e enfileira;
 *   4. processa a fila SERIALMENTE (duas impressões concorrentes embaralham o papel).
 */

const axios = require("axios");
const { io } = require("socket.io-client");
const config = require("./config");
const log = require("./log");
const fila = require("./fila");
const { imprimir } = require("./impressora");
const { criarProcessador, motivo } = require("./processador");

const api = axios.create({
  baseURL: config.API_URL,
  headers: { Authorization: `Bearer ${config.AGENTE_TOKEN}` },
  timeout: 15_000,
});

const { processarFila } = criarProcessador({ imprimir, api });

/** Busca no backend os jobs que ficaram pendentes enquanto o agente estava offline. */
async function buscarPendentes() {
  try {
    const { data } = await api.get("/impressao/pendentes");
    const novos = fila.adicionarVarios(data || []);
    if (novos > 0) log.info(`${novos} impressao(oes) pendente(s) recuperada(s) do sistema.`);
    processarFila();
  } catch (err) {
    log.erro(`Nao foi possivel buscar as impressoes pendentes: ${motivo(err)}`);
  }
}

function conectar() {
  const socket = io(config.BACKEND_URL, {
    // `agente: true` identifica este socket como o agente de impressão da loja — é o que
    // acende o indicador verde no painel do atendente.
    auth: { token: config.AGENTE_TOKEN, agente: true },
    reconnection: true,
    reconnectionDelay: config.BACKOFF_INICIAL_MS,
    reconnectionDelayMax: config.BACKOFF_MAX_MS,
    // Sem limite de tentativas: se a internet da pizzaria cair à noite, o agente tem que
    // estar conectado de novo quando ela voltar, sem ninguém reiniciar nada.
    reconnectionAttempts: Infinity,
  });

  socket.on("connect", () => {
    log.info("Conectado ao sistema. Aguardando pedidos para imprimir.");
    buscarPendentes();
  });

  socket.on("impressao:job", (job) => {
    log.info(`Chegou para imprimir: ${(job.payload && job.payload.titulo) || job.tipo}`);
    fila.adicionar(job);
    processarFila();
  });

  socket.on("disconnect", (razao) => {
    log.aviso(`Conexao com o sistema caiu (${razao}). Tentando reconectar...`);
  });

  socket.on("connect_error", (err) => {
    const texto = String(err.message || "");
    if (texto.includes("UNAUTHORIZED") || texto.includes("TOKEN_REVOKED")) {
      // Configuração errada, não instabilidade: insistir não resolve e enche o log.
      log.erro("O AGENTE_TOKEN do arquivo .env foi recusado pelo sistema. Peça um token novo ao suporte.");
      return;
    }
    log.erro(`Nao foi possivel conectar ao sistema: ${texto}`);
  });

  return socket;
}

function iniciar() {
  log.info("=======================================");
  log.info("Agente de impressao iniciando...");
  log.info(`Sistema:    ${config.BACKEND_URL}`);
  log.info(`Impressora: ${config.IMPRESSORA_TIPO} em ${config.IMPRESSORA_INTERFACE}`);

  fila.carregar();
  conectar();

  // Rede de segurança: se um job ficou esperando retry e nenhum evento novo chegar, este
  // tique garante que ele volte a ser tentado assim que a espera vencer.
  setInterval(() => {
    if (fila.temAgendado()) processarFila();
  }, config.INTERVALO_RETRY_MS);

  log.info("Agente no ar. Pode deixar esta janela aberta e minimizada.");
  log.info("=======================================");
}

process.on("uncaughtException", (err) => {
  log.erro(`Erro inesperado no agente: ${err.message}`);
});
process.on("unhandledRejection", (err) => {
  log.erro(`Erro inesperado no agente: ${(err && err.message) || err}`);
});

iniciar();
