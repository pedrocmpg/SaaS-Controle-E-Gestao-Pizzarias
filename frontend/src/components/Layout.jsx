import { useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import WhatsAppButton from "./WhatsAppButton";
import CartDrawer from "./CartDrawer";

export default function Layout() {
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <Header onOpenCart={() => setCartOpen(true)} />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <WhatsAppButton />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
