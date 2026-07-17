import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import Button from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { CadastroSlideOver } from "./CadastroSlideOver";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";

/**
 * Tabela genérica de cadastro: tabela + "Novo [item]" + slide-over de
 * formulário + seleção em massa (ativar/desativar) + exclusão sempre atrás
 * de modal de confirmação. Reaproveitada por todas as telas de cadastro
 * (Produtos, Sabores, Tamanhos/Bordas, Ofertas, Motoboys, Operadores) —
 * cada uma só define suas próprias colunas e formulário (spec-4).
 *
 * `renderForm(row, close)` renderiza o conteúdo do slide-over: `row` é null
 * em modo criação. Cada tela decide seus próprios campos e chamadas de
 * serviço; a estrutura de tabela/slide-over/seleção é sempre a mesma.
 */
export function CadastroTable({
  title,
  itemLabelSingular,
  columns,
  rows,
  loading = false,
  getRowId = (row) => row.id,
  getRowLabel = (row) => row.name,
  renderForm,
  onBulkToggleActive,
  onDelete,
  emptyMessage = "Nenhum item cadastrado.",
}) {
  const [slideOver, setSlideOver] = useState({ open: false, row: null });
  const [selected, setSelected] = useState(new Set());
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  function openCreate() {
    setSlideOver({ open: true, row: null });
  }

  function openEdit(row) {
    setSlideOver({ open: true, row });
  }

  function closeSlideOver() {
    setSlideOver({ open: false, row: null });
  }

  function toggleRow(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map(getRowId))));
  }

  async function handleBulkToggle(nextActive) {
    if (!onBulkToggleActive || selected.size === 0) return;
    setBulkLoading(true);
    try {
      await onBulkToggleActive(Array.from(selected), nextActive);
      setSelected(new Set());
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || !onDelete) return;
    setDeleting(true);
    try {
      await onDelete(deleteTarget);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const allSelected = rows.length > 0 && selected.size === rows.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-display font-semibold text-char">{title}</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus size={16} />
          Novo {itemLabelSingular}
        </Button>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2 rounded-xl bg-accent-50 border border-accent-100">
          <span className="text-sm font-medium text-ink">{selected.size} selecionado(s)</span>
          <Button size="xs" variant="outline" loading={bulkLoading} onClick={() => handleBulkToggle(true)}>
            Ativar selecionados
          </Button>
          <Button size="xs" variant="outline" loading={bulkLoading} onClick={() => handleBulkToggle(false)}>
            Desativar selecionados
          </Button>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-flour-2 text-ink-soft text-xs uppercase tracking-wide">
            <tr>
              {onBulkToggleActive && (
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Selecionar todos"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 font-semibold text-left ${col.align === "right" ? "text-right" : ""}`}
                >
                  {col.label}
                </th>
              ))}
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length + 2} className="px-4 py-10 text-center">
                  <Spinner />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 2} className="px-4 py-10 text-center text-ink-soft text-sm">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const id = getRowId(row);
                return (
                  <tr key={id} className="border-t border-flour-2 hover:bg-flour-2/40 transition">
                    {onBulkToggleActive && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(id)}
                          onChange={() => toggleRow(id)}
                          aria-label={`Selecionar ${getRowLabel(row)}`}
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 ${col.align === "right" ? "text-right" : ""}`}
                      >
                        {col.render ? col.render(row) : row[col.key]}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(row)}
                          className="text-ink-soft hover:text-ember-600 transition"
                          aria-label={`Editar ${getRowLabel(row)}`}
                        >
                          <Pencil size={16} />
                        </button>
                        {onDelete && (
                          <button
                            onClick={() => setDeleteTarget(row)}
                            className="text-ink-soft hover:text-danger-700 transition"
                            aria-label={`Excluir ${getRowLabel(row)}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <CadastroSlideOver
        open={slideOver.open}
        onClose={closeSlideOver}
        title={slideOver.row ? `Editar ${itemLabelSingular}` : `Novo ${itemLabelSingular}`}
      >
        {slideOver.open && renderForm(slideOver.row, closeSlideOver)}
      </CadastroSlideOver>

      {onDelete && (
        <ConfirmDeleteModal
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
          itemLabel={deleteTarget ? getRowLabel(deleteTarget) : null}
          loading={deleting}
        />
      )}
    </div>
  );
}
