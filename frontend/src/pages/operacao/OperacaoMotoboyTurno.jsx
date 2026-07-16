import { useCallback, useEffect, useState } from "react";
import { motoboyService } from "../../services/api";
import { useAdminAuth } from "../../context/AdminAuthContext";

const inputClass =
  "w-full border border-flour-2 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-char";

const STATUS_LABEL = {
  FECHADO_AGUARDANDO_CONFERENCIA: "Aguardando conferência",
  CONFERIDO: "Conferido",
};

const EXTRA_TIPO_LABEL = {
  ENTREGA_LONGA: "Entrega longa",
  GORJETA: "Gorjeta",
  AJUDA_CUSTO: "Ajuda de custo",
  OUTRO: "Outro",
};

function money(v) {
  return `R$ ${Number(v || 0).toFixed(2)}`;
}

export default function OperacaoMotoboyTurno() {
  const { admin } = useAdminAuth();
  const podeConferir = ["SUPER_ADMIN", "ADMIN", "GERENTE"].includes(admin?.role);

  const [motoboys, setMotoboys] = useState([]);
  const [turnosAbertos, setTurnosAbertos] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [motoboyId, setMotoboyId] = useState("");
  const [fundoTroco, setFundoTroco] = useState("");

  const [extraTurnoId, setExtraTurnoId] = useState(null);
  const [extraTipo, setExtraTipo] = useState("OUTRO");
  const [extraValor, setExtraValor] = useState("");
  const [extraMotivo, setExtraMotivo] = useState("");

  const [fechandoTurnoId, setFechandoTurnoId] = useState(null);
  const [totalCartao, setTotalCartao] = useState("");
  const [totalPix, setTotalPix] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([motoboyService.getLista(), motoboyService.getTurnoAtual(), motoboyService.getHistorico()])
      .then(([motoboysData, turnosData, historicoData]) => {
        setMotoboys(motoboysData);
        setTurnosAbertos(Array.isArray(turnosData) ? turnosData : []);
        setHistorico(historicoData);
      })
      .catch(() => setError("Não foi possível carregar os turnos de motoboy."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function abrirTurno() {
    if (!motoboyId) {
      setError("Selecione um motoboy.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await motoboyService.abrirTurno({ motoboyId: Number(motoboyId), fundoTroco: Number(fundoTroco) || 0 });
      setMotoboyId("");
      setFundoTroco("");
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível abrir o turno.");
    } finally {
      setBusy(false);
    }
  }

  async function lancarExtra() {
    setBusy(true);
    setError(null);
    try {
      await motoboyService.lancarExtra(extraTurnoId, {
        tipo: extraTipo,
        valor: Number(extraValor) || 0,
        motivo: extraMotivo.trim(),
      });
      setExtraTurnoId(null);
      setExtraValor("");
      setExtraMotivo("");
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível lançar o extra.");
    } finally {
      setBusy(false);
    }
  }

  async function fecharTurno() {
    setBusy(true);
    setError(null);
    try {
      await motoboyService.fecharTurno(fechandoTurnoId, {
        totalRecebidoCartao: Number(totalCartao) || 0,
        totalRecebidoPix: Number(totalPix) || 0,
      });
      setFechandoTurnoId(null);
      setTotalCartao("");
      setTotalPix("");
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível fechar o turno.");
    } finally {
      setBusy(false);
    }
  }

  async function conferir(id) {
    setBusy(true);
    setError(null);
    try {
      await motoboyService.conferirTurno(id);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível confirmar a conferência.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-ink-soft text-sm">Carregando turnos de motoboy...</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-display font-semibold text-char mb-6">Motoboy — turnos</h1>

      {error && (
        <p className="text-red-500 mb-4 cursor-pointer text-sm" onClick={() => setError(null)}>
          {error} (clique para dispensar)
        </p>
      )}

      <div className="card p-6 max-w-md mb-8">
        <p className="text-sm font-semibold text-char mb-3">Abrir turno</p>
        <label className="block text-xs font-semibold text-ink-soft mb-1">Motoboy</label>
        <select className={inputClass} value={motoboyId} onChange={(e) => setMotoboyId(e.target.value)}>
          <option value="">Selecione</option>
          {motoboys.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <label className="block text-xs font-semibold text-ink-soft mb-1 mt-3">Fundo de troco (R$)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          className={inputClass}
          value={fundoTroco}
          onChange={(e) => setFundoTroco(e.target.value)}
          placeholder="0,00"
        />
        <button onClick={abrirTurno} disabled={busy} className="btn-primary text-sm mt-3 disabled:opacity-50">
          Abrir turno
        </button>
      </div>

      <h2 className="text-lg font-display font-semibold text-char mb-4">Turnos abertos</h2>
      {turnosAbertos.length === 0 ? (
        <p className="text-ink-soft text-sm mb-8">Nenhum turno aberto no momento.</p>
      ) : (
        <div className="space-y-4 mb-8">
          {turnosAbertos.map((t) => (
            <div key={t.id} className="card p-5">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <p className="text-sm font-semibold text-char">{t.motoboy?.name}</p>
                <p className="text-xs text-ink-soft">Aberto desde {new Date(t.abertoEm).toLocaleString("pt-BR")}</p>
              </div>
              <p className="text-sm text-ink-soft mb-3">
                Fundo de troco: <span className="font-mono text-char">{money(t.fundoTroco)}</span>
              </p>

              {extraTurnoId === t.id ? (
                <div className="border border-flour-2 rounded-lg p-3 mb-3 space-y-2">
                  <select className={inputClass} value={extraTipo} onChange={(e) => setExtraTipo(e.target.value)}>
                    {Object.entries(EXTRA_TIPO_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    className={inputClass}
                    placeholder="Valor (R$)"
                    value={extraValor}
                    onChange={(e) => setExtraValor(e.target.value)}
                  />
                  <input
                    className={inputClass}
                    placeholder="Motivo (obrigatório)"
                    value={extraMotivo}
                    onChange={(e) => setExtraMotivo(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button onClick={lancarExtra} disabled={busy} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
                      Confirmar
                    </button>
                    <button
                      onClick={() => {
                        setExtraTurnoId(null);
                        setExtraValor("");
                        setExtraMotivo("");
                      }}
                      className="btn-secondary text-xs px-3 py-1.5"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : fechandoTurnoId === t.id ? (
                <div className="border border-flour-2 rounded-lg p-3 mb-3 space-y-2">
                  <label className="block text-xs font-semibold text-ink-soft">Recebido em cartão (R$, digitado da maquininha)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputClass}
                    value={totalCartao}
                    onChange={(e) => setTotalCartao(e.target.value)}
                  />
                  <label className="block text-xs font-semibold text-ink-soft">Recebido em PIX (R$)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputClass}
                    value={totalPix}
                    onChange={(e) => setTotalPix(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button onClick={fecharTurno} disabled={busy} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
                      Confirmar fechamento
                    </button>
                    <button onClick={() => setFechandoTurnoId(null)} className="btn-secondary text-xs px-3 py-1.5">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setExtraTurnoId(t.id)} className="btn-secondary text-xs px-3 py-1.5">
                    Lançar extra
                  </button>
                  <button onClick={() => setFechandoTurnoId(t.id)} className="btn-primary text-xs px-3 py-1.5">
                    Fechar turno
                  </button>
                </div>
              )}
            </div>
          ))}
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
                <p className="text-sm font-semibold text-char">
                  {h.motoboy?.name} · {new Date(h.abertoEm).toLocaleDateString("pt-BR")} — {STATUS_LABEL[h.status]}
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-2">
                <p>
                  <span className="text-ink-soft">Entregas: </span>
                  <span className="font-mono">{h.totalEntregas}</span>
                </p>
                <p>
                  <span className="text-ink-soft">Valor da noite: </span>
                  <span className="font-mono">{money(h.valorDaNoite)}</span>
                </p>
                <p>
                  <span className="text-ink-soft">Recebido dinheiro: </span>
                  <span className="font-mono">{money(h.totalRecebidoDinheiro)}</span>
                </p>
                <p>
                  <span className="text-ink-soft">Acerto: </span>
                  <span className="font-mono">{money(h.acerto)}</span>
                </p>
              </div>
              <p className="text-sm mb-2">
                <span className="text-ink-soft">Sangria: </span>
                <span className="font-mono">{money(h.sangria)}</span>
                <span className="text-xs text-ink-soft ml-2">
                  ({Number(h.acerto) > 0 ? "motoboy repassa ao caixa" : "pizzaria paga ao motoboy (PIX, nunca sangria)"})
                </span>
              </p>

              {h.status === "FECHADO_AGUARDANDO_CONFERENCIA" && podeConferir && (
                <button
                  onClick={() => conferir(h.id)}
                  disabled={busy}
                  className="text-xs px-3 py-1.5 rounded-full border border-flour-2 text-ink-soft hover:text-char mt-2 disabled:opacity-50"
                >
                  Conferir
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
