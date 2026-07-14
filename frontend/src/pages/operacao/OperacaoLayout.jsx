import { Outlet } from "react-router-dom";
import OperacaoSidebar from "../../components/operacao/OperacaoSidebar";

export default function OperacaoLayout() {
  return (
    <div className="min-h-screen flex bg-flour">
      <OperacaoSidebar />
      <main className="flex-1 min-w-0 p-8">
        <Outlet />
      </main>
    </div>
  );
}
