/**
 * Laço de processamento da fila.
 *
 * Separado do `index.js` para poder ser exercitado sem abrir socket nem conectar em
 * impressora — é aqui que mora a regra "impressora sem papel não trava a fila inteira",
 * que é critério de aceite e não pode ser verificada só por leitura.
 *
 * `imprimir` e `api` entram por injeção pelo mesmo motivo.
 */

const config = require("./config");
const log = require("./log");
const fila = require("./fila");

/** Mensagem de erro legível para quem lê o log por telefone. */
function motivo(err) {
  if (err.response) {
    const detalhe = err.response.data && err.response.data.error;
    return `${err.response.status} ${detalhe || err.response.statusText || ""}`.trim();
  }
  if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") return "sem conexao com o sistema";
  return err.message;
}

function criarProcessador({ imprimir, api, maxTentativas = config.MAX_TENTATIVAS, intervaloRetryMs = config.INTERVALO_RETRY_MS }) {
  let processando = false;

  /**
   * Processa até a fila esvaziar ou até só sobrarem jobs esperando o retry vencer.
   * Serial de propósito: uma impressora só imprime uma coisa por vez.
   */
  async function processarFila() {
    if (processando) return;
    processando = true;

    try {
      for (;;) {
        const job = fila.proximo();
        if (!job) break;

        try {
          await imprimir(job.payload);
          fila.remover(job.id);
          await api.post(`/impressao/${job.id}/confirmar`).catch((err) => {
            // O papel já saiu. Não conseguir confirmar é problema de rede, não de impressão:
            // o job sai da fila local de qualquer jeito para não imprimir duas vezes.
            log.aviso(`Impresso, mas nao foi possivel confirmar no sistema (job ${job.id}): ${motivo(err)}`);
          });
        } catch (err) {
          const texto = motivo(err);
          const atualizado = fila.adiarTentativa(job.id, intervaloRetryMs);
          const tentativas = atualizado ? atualizado.tentativas : maxTentativas;

          log.erro(`Falha ao imprimir (job ${job.id}, tentativa ${tentativas}): ${texto}`);
          await api.post(`/impressao/${job.id}/erro`, { erro: texto }).catch(() => {});

          if (tentativas >= maxTentativas) {
            // Desiste DESTE job e segue para o próximo: uma impressora sem papel não pode
            // travar a fila inteira. O backend já marcou ERRO e a tela permite reimprimir.
            log.erro(
              `Desistindo do job ${job.id} apos ${tentativas} tentativas. Reimprima pela tela quando resolver a impressora.`
            );
            fila.remover(job.id);
            continue;
          }
          // Job segue na fila com a espera agendada: para de girar agora.
          break;
        }
      }
    } finally {
      processando = false;
    }
  }

  return { processarFila };
}

module.exports = { criarProcessador, motivo };
