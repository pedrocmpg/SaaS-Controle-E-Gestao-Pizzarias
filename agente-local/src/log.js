/**
 * Log do agente — escrito para quem NÃO é dev.
 *
 * O suporte vai ser por telefone ("me lê a última linha do agente.log"), então cada linha
 * é uma frase em português com data e hora. Sem JSON, sem stack trace por padrão.
 * Rotação simples por tamanho: mantém o arquivo atual e um anterior.
 */

const fs = require("fs");
const { ARQUIVO_LOG } = require("./config");

const TAMANHO_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

function carimbo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Renomeia o log atual para .anterior quando ele fica grande. */
function rotacionarSePreciso() {
  try {
    const info = fs.statSync(ARQUIVO_LOG);
    if (info.size < TAMANHO_MAX_BYTES) return;
    fs.renameSync(ARQUIVO_LOG, `${ARQUIVO_LOG}.anterior`);
  } catch {
    // Arquivo ainda não existe: nada a rotacionar.
  }
}

function escrever(nivel, mensagem) {
  const linha = `[${carimbo()}] ${nivel} ${mensagem}`;
  console.log(linha);
  try {
    rotacionarSePreciso();
    fs.appendFileSync(ARQUIVO_LOG, `${linha}\n`, "utf8");
  } catch (err) {
    // Não conseguir gravar o log nunca pode derrubar a impressão.
    console.error("Nao foi possivel gravar no agente.log:", err.message);
  }
}

module.exports = {
  info: (msg) => escrever("INFO ", msg),
  erro: (msg) => escrever("ERRO ", msg),
  aviso: (msg) => escrever("AVISO", msg),
};
