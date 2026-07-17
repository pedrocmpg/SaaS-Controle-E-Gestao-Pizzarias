import { AdminCadastroScreen } from "../../components/cadastro";

// Operadores são Admin com role GERENTE/ATENDENTE — SUPER_ADMIN e ADMIN não
// aparecem aqui de propósito (mesmo recorte de antes, quando a tela só
// permitia criar). Agora com listagem, edição e desativação completas.
export default function AdminOperators() {
  return (
    <AdminCadastroScreen
      title="Operadores"
      itemLabelSingular="operador"
      roleFilter={["GERENTE", "ATENDENTE"]}
      roleOptions={[
        { value: "GERENTE", label: "Gerente" },
        { value: "ATENDENTE", label: "Atendente" },
      ]}
      emptyMessage="Nenhum operador cadastrado."
    />
  );
}
