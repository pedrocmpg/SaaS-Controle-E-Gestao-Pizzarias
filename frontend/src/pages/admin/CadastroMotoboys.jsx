import { AdminCadastroScreen } from "../../components/cadastro";

// Motoboys são Admin com role=MOTOBOY — distinto das telas operacionais de
// despacho/turno (OperacaoDespacho, OperacaoMotoboyTurno), que continuam
// intocadas. Esta tela só gerencia o cadastro do entregador em si.
export default function CadastroMotoboys() {
  return (
    <AdminCadastroScreen
      title="Motoboys"
      itemLabelSingular="motoboy"
      roleFilter={["MOTOBOY"]}
      roleOptions={[{ value: "MOTOBOY", label: "Motoboy" }]}
      emptyMessage="Nenhum motoboy cadastrado."
    />
  );
}
