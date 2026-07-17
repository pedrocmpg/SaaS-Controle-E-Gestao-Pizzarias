import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

// Layout único compartilhado por /admin/* (exceto login) e /operacao/* —
// substitui OperacaoLayout + OperacaoSidebar + AdminHeader (spec-4).
export default function AppShell() {
  return (
    <div className="min-h-screen flex bg-flour">
      <Sidebar />
      <main className="flex-1 min-w-0 p-8 overflow-x-auto">
        <Outlet />
      </main>
    </div>
  );
}
