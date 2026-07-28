/**
 * Fila de impressão em disco.
 *
 * Um JSON simples, de propósito: banco embarcado seria mais robusto e impossível de
 * diagnosticar por telefone. Com `fila.json` o suporte pede pro dono abrir o arquivo no
 * Bloco de Notas e diz o que fazer.
 *
 * Persistir em disco é o que garante que um job recebido não se perde se o PC do caixa
 * for desligado no meio do movimento.
 */

const fs = require("fs");
const { ARQUIVO_FILA } = require("./config");
const log = require("./log");

/** Jobs em memória, espelhados no disco a cada mudança. */
let jobs = [];

function carregar() {
  try {
    const bruto = fs.readFileSync(ARQUIVO_FILA, "utf8");
    const dados = JSON.parse(bruto);
    jobs = Array.isArray(dados) ? dados : [];
    if (jobs.length > 0) log.info(`${jobs.length} impressao(oes) pendente(s) recuperada(s) do disco.`);
  } catch (err) {
    if (err.code !== "ENOENT") {
      // Arquivo corrompido: começar limpo é melhor do que o agente não subir. O que estava
      // pendente será recuperado do backend no connect (GET /pendentes).
      log.aviso("O arquivo fila.json estava ilegivel e foi reiniciado. Os pendentes serao rebuscados do sistema.");
    }
    jobs = [];
  }
  return jobs;
}

function salvar() {
  try {
    fs.writeFileSync(ARQUIVO_FILA, JSON.stringify(jobs, null, 2), "utf8");
  } catch (err) {
    log.erro(`Nao foi possivel gravar a fila em disco: ${err.message}`);
  }
}

/** Adiciona um job se ele ainda não estiver na fila (o mesmo job pode chegar pelo socket e pelo GET /pendentes). */
function adicionar(job) {
  if (jobs.some((j) => j.id === job.id)) return false;
  jobs.push({ id: job.id, tipo: job.tipo, payload: job.payload, tentativas: 0, proximaTentativaEm: 0 });
  salvar();
  return true;
}

function adicionarVarios(lista) {
  let novos = 0;
  for (const job of lista) if (adicionar(job)) novos++;
  return novos;
}

/** Próximo job elegível: o primeiro cuja espera de retry já venceu. */
function proximo() {
  const agora = Date.now();
  return jobs.find((j) => j.proximaTentativaEm <= agora) || null;
}

function remover(id) {
  jobs = jobs.filter((j) => j.id !== id);
  salvar();
}

/** Marca uma tentativa falha e agenda a próxima. */
function adiarTentativa(id, intervaloMs) {
  const job = jobs.find((j) => j.id === id);
  if (!job) return null;
  job.tentativas += 1;
  job.proximaTentativaEm = Date.now() + intervaloMs;
  salvar();
  return job;
}

const tamanho = () => jobs.length;
/** Há algum job esperando o retry vencer? Usado para o loop não dormir demais. */
const temAgendado = () => jobs.length > 0;

module.exports = { carregar, adicionar, adicionarVarios, proximo, remover, adiarTentativa, tamanho, temAgendado };
