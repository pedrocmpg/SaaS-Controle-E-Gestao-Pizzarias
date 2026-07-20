import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { caixaService } from "../../services/api";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { StatusBadge } from "../../components/ui/Badge";

const inputClass =
  "w-full border border-flour-2 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-char";

const TABS = [
  { key: "turno", to: "/operacao/caixa", label: "Turno" },
  { key: "sangrias", to: "/operacao/caixa/sangrias", label: "Sangrias" },
];

function money(v) {
  return `R$ ${Number(v || 0).toFixed(2)}`;
}

export default function OperacaoCaixa() {
  const { admin } = useAdminAuth();
  const location = useLocation();
  const tab = location.pathname.endsWith("/sangrias") ? "sangrias" : "turno";
  const podeConferir = ["SUPER_ADMIN", "ADMIN", "GERENTE"].includes(admin?.role);

  const [sessao, setSessao] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [fundoTroco, setFundoTroco] = useState("");
  const [movValor, setMovValor] = useState("");
  const [movMotivo, setMovMotivo] = useState("");
  const [movTipo, setMovTipo] = useState(null); // "sangria" | "suprimento" | null
  const [conferindoId, setConferindoId] = useState(null);
  const [saldoContado, setSaldoContado] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([caixaService.getAtual("SALAO"), caixaService.getHistorico()])
      .then(([atual, hist]) => {
        setSessao(atual);
        setHistorico(hist);
      })
      .catch(() => setError("Não foi possível carregar o caixa."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function abrirCaixa() {
    setBusy(true);
    setError(null);
    try {
      await caixaService.abrir({ tipo: "SALAO", fundoTroco: Number(fundoTroco) || 0 });
      setFundoTroco("");
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível abrir o caixa.");
    } finally {
      setBusy(false);
    }
  }

  async function registrarMovimento() {
    setBusy(true);
    setError(null);
    try {
      const data = { valor: Number(movValor) || 0, motivo: movMotivo.trim() };
      if (movTipo === "sangria") await caixaService.sangria(sessao.id, data);
      else await caixaService.suprimento(sessao.id, data);
      setMovValor("");
      setMovMotivo("");
      setMovTipo(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível registrar o movimento.");
    } finally {
      setBusy(false);
    }
  }

  async function fecharCaixa() {
    setBusy(true);
    setError(null);
    try {
      await caixaService.fechar(sessao.id);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível fechar o caixa.");
    } finally {
      setBusy(false);
    }
  }

  async function conferir(id) {
    setBusy(true);
    setError(null);
    try {
      await caixaService.conferir(id, { saldoFinalContado: Number(saldoContado) || 0 });
      setConferindoId(null);
      setSaldoContado("");
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível confirmar a conferência.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-ink-soft text-sm">Carregando caixa...</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-display font-semibold text-char mb-4">Caixa do salão</h1>

      <div className="flex items-center gap-1 mb-6 border-b border-flour-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            to={t.to}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition ${
              tab === t.key
                ? "border-ember-500 text-ember-600"
                : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {error && (
        <p className="text-red-500 mb-4 cursor-pointer text-sm" onClick={() => setError(null)}>
          {error} (clique para dispensar)
        </p>
      )}

      {tab === "turno" ? (
        <>
          {!sessao ? (
            <div className="card p-6 max-w-md">
              <p className="text-sm text-ink-soft mb-3">Nenhum caixa aberto no momento.</p>
              <label className="block text-xs font-semibold text-ink-soft mb-1">Fundo de troco (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={fundoTroco}
                onChange={(e) => setFundoTroco(e.target.value)}
                placeholder="0,00"
              />
              <button onClick={abrirCaixa} disabled={busy} className="btn-primary text-sm mt-3 disabled:opacity-50">
                Abrir caixa
              </button>
            </div>
          ) : (
            <div className="card p-6 max-w-md mb-8">
              <p className="text-xs text-ink-soft mb-1">Caixa aberto desde</p>
              <p className="text-sm font-semibold text-char mb-3">{new Date(sessao.abertoEm).toLocaleString("pt-BR")}</p>
              <p className="text-sm text-ink-soft mb-4">
                Fundo de troco: <span className="font-price text-char">{money(sessao.fundoTroco)}</span>
              </p>

              <button onClick={fecharCaixa} disabled={busy} className="btn-primary text-sm disabled:opacity-50">
                Fechar caixa
              </button>
            </div>
          )}

          <h2 className="text-lg font-display font-semibold text-char mb-4">Fechamentos anteriores</h2>
          {historico.length === 0 ? (
            <p className="text-ink-soft text-sm">Nenhum fechamento registrado ainda.</p>
          ) : (
            <div className="space-y-3">
              {historico.map((h) => (
                <div key={h.id} className="card p-5">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <p className="text-sm font-semibold text-char flex items-center gap-2">
                      {new Date(h.abertoEm).toLocaleDateString("pt-BR")}
                      <StatusBadge domain="turno" value={h.status} />
                    </p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-2">
                    <p>
                      <span className="text-ink-soft">Dinheiro: </span>
                      <span className="font-price">{money(h.totalVendasDinheiro)}</span>
                    </p>
                    <p>
                      <span className="text-ink-soft">Cartão: </span>
                      <span className="font-price">{money(h.totalVendasCartao)}</span>
                    </p>
                    <p>
                      <span className="text-ink-soft">PIX: </span>
                      <span className="font-price">{money(h.totalVendasPix)}</span>
                    </p>
                    <p>
                      <span className="text-ink-soft">Saldo calculado: </span>
                      <span className="font-price">{money(h.saldoFinalCalculado)}</span>
                    </p>
                  </div>

                  {h.status === "CONFERIDO" && (
                    <p className="text-sm">
                      <span className="text-ink-soft">Saldo contado: </span>
                      <span className="font-price">{money(h.saldoFinalContado)}</span>
                    </p>
                  )}

                  {h.status === "FECHADO_AGUARDANDO_CONFERENCIA" && podeConferir && (
                    conferindoId === h.id ? (
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className={`${inputClass} w-40`}
                          placeholder="Saldo contado (R$)"
                          value={saldoContado}
                          onChange={(e) => setSaldoContado(e.target.value)}
                        />
                        <button onClick={() => conferir(h.id)} disabled={busy} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
                          Confirmar
                        </button>
                        <button onClick={() => setConferindoId(null)} className="btn-secondary text-xs px-3 py-1.5">
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConferindoId(h.id)}
                        className="text-xs px-3 py-1.5 rounded-full border border-flour-2 text-ink-soft hover:text-char mt-2"
                      >
                        Conferir
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      ) : !sessao ? (
        <p className="text-ink-soft text-sm">Abra o caixa na aba Turno pra poder registrar sangria/suprimento.</p>
      ) : (
        <div className="card p-6 max-w-md">
          <p className="text-sm text-ink-soft mb-4">
            Fundo de troco: <span className="font-price text-char">{money(sessao.fundoTroco)}</span>
          </p>

          {movTipo ? (
            <div className="border border-flour-2 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-ink-soft">{movTipo === "sangria" ? "Sangria" : "Suprimento"}</p>
              <input
                type="number"
                min="0.01"
                step="0.01"
                className={inputClass}
                placeholder="Valor (R$)"
                value={movValor}
                onChange={(e) => setMovValor(e.target.value)}
              />
              <input
                className={inputClass}
                placeholder="Motivo (obrigatório)"
                value={movMotivo}
                onChange={(e) => setMovMotivo(e.target.value)}
              />
              <div className="flex gap-2">
                <button onClick={registrarMovimento} disabled={busy} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
                  Confirmar
                </button>
                <button
                  onClick={() => {
                    setMovTipo(null);
                    setMovValor("");
                    setMovMotivo("");
                  }}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setMovTipo("sangria")} className="btn-secondary text-xs px-3 py-1.5">
                Sangria
              </button>
              <button onClick={() => setMovTipo("suprimento")} className="btn-secondary text-xs px-3 py-1.5">
                Suprimento
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
