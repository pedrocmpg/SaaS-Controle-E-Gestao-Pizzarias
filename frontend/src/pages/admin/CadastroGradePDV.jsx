import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { pdvConfigService, catalogService } from "../../services/api";
import { CadastroSlideOver, Field, inputClass } from "../../components/cadastro";
import Button from "../../components/ui/Button";
import { useToast } from "../../components/ui/Toast";
import { Spinner } from "../../components/ui/Spinner";

/**
 * Tela de configuração da grade do PDV (spec-5): LojaConfig + grupos + botões.
 * Sistema nasce vazio — sem seed. Só GERENCIA_ROLES acessa (ver App.jsx).
 */
export default function CadastroGradePDV() {
  const [config, setConfig] = useState(null);
  const [grupos, setGrupos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [grupoSelecionadoId, setGrupoSelecionadoId] = useState(null);
  const toast = useToast();

  function load() {
    setLoading(true);
    return Promise.all([pdvConfigService.getLojaConfig().then(setConfig), pdvConfigService.getGrupos().then(setGrupos)])
      .catch(() => toast.error("Não foi possível carregar a configuração da grade."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grupoSelecionado = grupos.find((g) => g.id === grupoSelecionadoId) || null;

  if (loading) {
    return (
      <div className="py-10 text-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-display font-semibold text-char mb-6">Grade do PDV</h1>

      <LojaConfigPanel config={config} onSaved={setConfig} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <GruposPanel
          grupos={grupos}
          selecionadoId={grupoSelecionadoId}
          onSelect={setGrupoSelecionadoId}
          onChanged={load}
        />
        <BotoesPanel grupo={grupoSelecionado} onChanged={load} />
      </div>
    </div>
  );
}

function LojaConfigPanel({ config, onSaved }) {
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function handleToggle(field) {
    setSaving(true);
    try {
      const saved = await pdvConfigService.updateLojaConfig({ [field]: !config[field] });
      onSaved(saved);
    } catch {
      toast.error("Não foi possível atualizar a configuração.");
    } finally {
      setSaving(false);
    }
  }

  if (!config) return null;

  return (
    <div className="card p-4">
      <h2 className="text-sm font-semibold text-ink-soft uppercase tracking-wide mb-3">Configuração da loja</h2>
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={config.usaMesa} disabled={saving} onChange={() => handleToggle("usaMesa")} />
          Usa numeração de mesa
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={config.usaBorda} disabled={saving} onChange={() => handleToggle("usaBorda")} />
          Oferece borda no montador de pizza
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          Modo de adicional de sabor:{" "}
          <span className="font-semibold text-ink">CHEIO (único disponível nesta fase)</span>
        </label>
      </div>
    </div>
  );
}

function GruposPanel({ grupos, selecionadoId, onSelect, onChanged }) {
  const [slideOver, setSlideOver] = useState({ open: false, row: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const toast = useToast();

  async function handleDelete(grupo) {
    try {
      await pdvConfigService.deleteGrupo(grupo.id);
      toast.success("Grupo excluído.");
      if (selecionadoId === grupo.id) onSelect(null);
      setDeleteTarget(null);
      onChanged();
    } catch {
      toast.error("Não foi possível excluir o grupo.");
    }
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-ink-soft uppercase tracking-wide">Grupos</h2>
        <Button size="xs" onClick={() => setSlideOver({ open: true, row: null })}>
          <Plus size={14} />
          Novo grupo
        </Button>
      </div>

      {grupos.length === 0 ? (
        <p className="text-ink-soft text-sm py-6 text-center">Nenhum grupo cadastrado.</p>
      ) : (
        <ul className="divide-y divide-flour-2 border border-flour-2 rounded-lg">
          {grupos.map((grupo) => (
            <li
              key={grupo.id}
              className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer transition ${
                selecionadoId === grupo.id ? "bg-ember-500/10" : "hover:bg-flour-2/40"
              }`}
              onClick={() => onSelect(grupo.id)}
            >
              <span className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: grupo.cor || "#9CA3AF" }}
                />
                <span className={grupo.ativo ? "" : "text-ink-soft line-through"}>{grupo.nome}</span>
                <span className="text-xs text-ink-soft">({grupo.botoes?.length || 0})</span>
              </span>
              <span className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSlideOver({ open: true, row: grupo });
                  }}
                  className="text-ink-soft hover:text-ember-600 transition"
                  aria-label={`Editar ${grupo.nome}`}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(grupo);
                  }}
                  className="text-ink-soft hover:text-danger-700 transition"
                  aria-label={`Excluir ${grupo.nome}`}
                >
                  <Trash2 size={14} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <CadastroSlideOver
        open={slideOver.open}
        onClose={() => setSlideOver({ open: false, row: null })}
        title={slideOver.row ? "Editar grupo" : "Novo grupo"}
      >
        {slideOver.open && (
          <GrupoForm
            row={slideOver.row}
            proximaPosicao={grupos.length}
            onSaved={() => {
              setSlideOver({ open: false, row: null });
              onChanged();
            }}
            onCancel={() => setSlideOver({ open: false, row: null })}
          />
        )}
      </CadastroSlideOver>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm">
            <p className="text-sm text-ink mb-4">
              Excluir o grupo <strong>{deleteTarget.nome}</strong>? Todos os botões dele também serão excluídos.
            </p>
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button variant="danger" className="flex-1" onClick={() => handleDelete(deleteTarget)}>
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GrupoForm({ row, proximaPosicao, onSaved, onCancel }) {
  const [nome, setNome] = useState(row?.nome || "");
  const [cor, setCor] = useState(row?.cor || "#E67E22");
  const [corFonte, setCorFonte] = useState(row?.corFonte || "#FFFFFF");
  const [ativo, setAtivo] = useState(row?.ativo ?? true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    const data = { nome, cor, corFonte, posicao: row?.posicao ?? proximaPosicao, ativo };
    setSaving(true);
    try {
      if (row) {
        await pdvConfigService.updateGrupo(row.id, data);
        toast.success("Grupo atualizado.");
      } else {
        await pdvConfigService.createGrupo(data);
        toast.success("Grupo criado.");
      }
      onSaved();
    } catch {
      toast.error("Não foi possível salvar o grupo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Field label="Nome" required>
        <input className={inputClass} value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={50} />
      </Field>
      <Field label="Cor de fundo">
        <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} className="h-10 w-20" />
      </Field>
      <Field label="Cor da fonte">
        <input type="color" value={corFonte} onChange={(e) => setCorFonte(e.target.value)} className="h-10 w-20" />
      </Field>
      {row && (
        <label className="flex items-center gap-2 mb-6 text-sm text-ink">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          Ativo
        </label>
      )}
      <div className="flex gap-3">
        <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" loading={saving} className="flex-1">
          Salvar
        </Button>
      </div>
    </form>
  );
}

function BotoesPanel({ grupo, onChanged }) {
  const [slideOver, setSlideOver] = useState({ open: false, row: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const toast = useToast();

  async function handleDelete(botao) {
    try {
      await pdvConfigService.deleteBotao(botao.id);
      toast.success("Botão excluído.");
      setDeleteTarget(null);
      onChanged();
    } catch {
      toast.error("Não foi possível excluir o botão.");
    }
  }

  if (!grupo) {
    return (
      <div className="card p-4">
        <h2 className="text-sm font-semibold text-ink-soft uppercase tracking-wide mb-3">Botões</h2>
        <p className="text-ink-soft text-sm py-6 text-center">Selecione um grupo à esquerda.</p>
      </div>
    );
  }

  const botoes = grupo.botoes || [];

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-ink-soft uppercase tracking-wide">Botões · {grupo.nome}</h2>
        <Button size="xs" onClick={() => setSlideOver({ open: true, row: null })}>
          <Plus size={14} />
          Novo botão
        </Button>
      </div>

      {botoes.length === 0 ? (
        <p className="text-ink-soft text-sm py-6 text-center">Nenhum botão cadastrado neste grupo.</p>
      ) : (
        <ul className="divide-y divide-flour-2 border border-flour-2 rounded-lg">
          {botoes.map((botao) => (
            <li key={botao.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: botao.cor || grupo.cor || "#9CA3AF" }} />
                <span className={botao.ativo ? "" : "text-ink-soft line-through"}>{botao.labelBotao}</span>
                <span className="text-xs text-ink-soft">{botao.tipo === "PIZZA" ? "Pizza" : "Produto"}</span>
              </span>
              <span className="flex items-center gap-2">
                <button
                  onClick={() => setSlideOver({ open: true, row: botao })}
                  className="text-ink-soft hover:text-ember-600 transition"
                  aria-label={`Editar ${botao.labelBotao}`}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setDeleteTarget(botao)}
                  className="text-ink-soft hover:text-danger-700 transition"
                  aria-label={`Excluir ${botao.labelBotao}`}
                >
                  <Trash2 size={14} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <CadastroSlideOver
        open={slideOver.open}
        onClose={() => setSlideOver({ open: false, row: null })}
        title={slideOver.row ? "Editar botão" : "Novo botão"}
      >
        {slideOver.open && (
          <BotaoForm
            row={slideOver.row}
            grupoId={grupo.id}
            proximaPosicao={botoes.length}
            onSaved={() => {
              setSlideOver({ open: false, row: null });
              onChanged();
            }}
            onCancel={() => setSlideOver({ open: false, row: null })}
          />
        )}
      </CadastroSlideOver>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm">
            <p className="text-sm text-ink mb-4">
              Excluir o botão <strong>{deleteTarget.labelBotao}</strong>?
            </p>
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button variant="danger" className="flex-1" onClick={() => handleDelete(deleteTarget)}>
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BotaoForm({ row, grupoId, proximaPosicao, onSaved, onCancel }) {
  const [labelBotao, setLabelBotao] = useState(row?.labelBotao || "");
  const [cor, setCor] = useState(row?.cor || "");
  const [tipo, setTipo] = useState(row?.tipo || "PRODUTO");
  const [pizzaSizeId, setPizzaSizeId] = useState(row?.pizzaSizeId || "");
  const [productId, setProductId] = useState(row?.productId || "");
  const [ativo, setAtivo] = useState(row?.ativo ?? true);
  const [sizes, setSizes] = useState([]);
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    Promise.all([catalogService.getSizes().then(setSizes), catalogService.getProducts().then(setProducts)]).catch(() =>
      toast.error("Não foi possível carregar o cardápio.")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    const data = {
      grupoId,
      labelBotao,
      cor: cor || null,
      tipo,
      pizzaSizeId: tipo === "PIZZA" ? Number(pizzaSizeId) : undefined,
      productId: tipo === "PRODUTO" ? Number(productId) : undefined,
      posicao: row?.posicao ?? proximaPosicao,
      ativo,
    };
    setSaving(true);
    try {
      if (row) {
        await pdvConfigService.updateBotao(row.id, data);
        toast.success("Botão atualizado.");
      } else {
        await pdvConfigService.createBotao(data);
        toast.success("Botão criado.");
      }
      onSaved();
    } catch {
      toast.error("Não foi possível salvar o botão.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Field label="Nome no botão" required>
        <input className={inputClass} value={labelBotao} onChange={(e) => setLabelBotao(e.target.value)} required maxLength={60} />
      </Field>
      <Field label="Cor (opcional, herda do grupo se vazio)">
        <input type="color" value={cor || "#E67E22"} onChange={(e) => setCor(e.target.value)} className="h-10 w-20" />
      </Field>
      <Field label="Tipo" required>
        <select className={inputClass} value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="PRODUTO">Produto (lança direto)</option>
          <option value="PIZZA">Pizza (abre montador)</option>
        </select>
      </Field>
      {tipo === "PIZZA" ? (
        <Field label="Tamanho de pizza" required>
          <select className={inputClass} value={pizzaSizeId} onChange={(e) => setPizzaSizeId(e.target.value)} required>
            <option value="">Selecione...</option>
            {sizes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <Field label="Produto" required>
          <select className={inputClass} value={productId} onChange={(e) => setProductId(e.target.value)} required>
            <option value="">Selecione...</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · R$ {Number(p.price).toFixed(2)}
              </option>
            ))}
          </select>
        </Field>
      )}
      {row && (
        <label className="flex items-center gap-2 mb-6 text-sm text-ink">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          Ativo
        </label>
      )}
      <div className="flex gap-3">
        <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" loading={saving} className="flex-1">
          Salvar
        </Button>
      </div>
    </form>
  );
}
