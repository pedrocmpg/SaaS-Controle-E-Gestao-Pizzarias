/**
 * Configuração do agente, lida do .env do diretório do agente.
 *
 * Falha ruidosamente no que é obrigatório: um agente que sobe "meio configurado" e não
 * imprime é pior do que um que não sobe — a pizzaria descobriria só quando a cozinha
 * reclamasse.
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const RAIZ = path.join(__dirname, "..");

function obrigatorio(nome) {
  const valor = process.env[nome];
  if (!valor || !valor.trim()) {
    console.error(`\n[ERRO] A configuracao ${nome} nao esta preenchida no arquivo .env`);
    console.error("Abra o arquivo .env na pasta do agente e preencha essa linha.\n");
    process.exit(1);
  }
  return valor.trim();
}

const BACKEND_URL = obrigatorio("BACKEND_URL").replace(/\/+$/, "");

const config = {
  BACKEND_URL,
  // O socket conecta na origem; a API fica sob /api.
  API_URL: `${BACKEND_URL}/api`,
  AGENTE_TOKEN: obrigatorio("AGENTE_TOKEN"),

  IMPRESSORA_TIPO: (process.env.IMPRESSORA_TIPO || "epson").trim().toLowerCase(),
  IMPRESSORA_INTERFACE: obrigatorio("IMPRESSORA_INTERFACE"),
  LARGURA_COLUNAS: parseInt(process.env.LARGURA_COLUNAS || "48", 10),

  ARQUIVO_FILA: path.join(RAIZ, "fila.json"),
  ARQUIVO_LOG: path.join(RAIZ, "agente.log"),

  // Retry do job: 5 tentativas espaçadas de 10s. Depois disso o backend marca ERRO e o
  // agente segue para o próximo — impressora sem papel não trava a fila inteira.
  MAX_TENTATIVAS: 5,
  INTERVALO_RETRY_MS: 10_000,
  // Reconexão ao backend: backoff exponencial até 30s.
  BACKOFF_INICIAL_MS: 1_000,
  BACKOFF_MAX_MS: 30_000,
};

module.exports = config;
