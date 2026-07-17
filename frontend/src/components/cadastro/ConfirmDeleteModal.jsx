import { Modal } from "../ui/Modal";
import Button from "../ui/Button";

/**
 * Wrapper fino sobre o Modal genérico — forma fixa pra confirmação de exclusão,
 * reaproveitada por todas as telas de cadastro (spec-4: exclusão nunca é ação
 * direta de um clique só).
 */
export function ConfirmDeleteModal({ open, onClose, onConfirm, itemLabel, loading = false }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Confirmar exclusão"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading} className="flex-1">
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading} className="flex-1">
            Excluir
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-soft">
        Tem certeza que deseja excluir {itemLabel ? <strong>{itemLabel}</strong> : "este item"}?
        Esta ação não pode ser desfeita.
      </p>
    </Modal>
  );
}
