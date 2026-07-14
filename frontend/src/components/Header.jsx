import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import Logo from "./Logo";
import { useCart } from "../context/CartContext";
import { ariaLabels } from "../utils/accessibility";

const navLinks = [
  { to: "/", label: "Início" },
  { to: "/cardapio", label: "Cardápio" },
  { to: "/sobre", label: "Sobre" },
  { to: "/contato", label: "Contato" },
];

export default function Header({ onOpenCart }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { totalItems } = useCart();

  const handleMenuToggle = () => {
    setMenuOpen((o) => !o);
  };

  const handleCartOpen = () => {
    setMenuOpen(false);
    onOpenCart();
  };

  return (
    <header
      className="sticky top-0 z-40 bg-page/95 backdrop-blur border-b border-black/5"
      role="banner"
    >
      <div className="container-app flex items-center justify-between h-20">
        <Link to="/" onClick={() => setMenuOpen(false)} className="hover-lift">
          <Logo />
        </Link>

        {/* Menu desktop */}
        <nav
          className="hidden md:flex items-center gap-8"
          role="navigation"
          aria-label="Navegação principal"
        >
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `font-medium transition-colors duration-200 relative group focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ember-500 rounded px-2 py-1 underline-offset-4 ${
                  isActive ? "text-ember-600 underline" : "text-ink hover:text-ember-600"
                }`
              }
              aria-current={({ isActive }) => (isActive ? "page" : undefined)}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCartOpen}
            className="relative flex items-center justify-center w-11 h-11 rounded-full bg-brand-50 hover:bg-brand-100 transition-smooth active:scale-95 hover-glow focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-500 min-h-[44px] min-w-[44px]"
            aria-label={ariaLabels.cartItems(totalItems)}
            aria-expanded="false"
          >
            <CartIcon aria-hidden="true" />
            {totalItems > 0 && (
              <span
                className="absolute -top-1 -right-1 bg-accent-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-bounce-sm"
                aria-live="polite"
                aria-atomic="true"
              >
                {totalItems}
              </span>
            )}
          </button>

          {/* Menu mobile toggle */}
          <button
            className="md:hidden flex items-center justify-center w-11 h-11 rounded-full bg-brand-50 hover:bg-brand-100 transition-smooth active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-700 min-h-[44px] min-w-[44px]"
            onClick={handleMenuToggle}
            aria-label={menuOpen ? ariaLabels.closeMenu : ariaLabels.openMenu}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            <MenuIcon open={menuOpen} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Menu mobile */}
      <nav
        id="mobile-menu"
        role="navigation"
        aria-label="Menu de navegação mobile"
        className={`md:hidden border-t border-black/5 bg-page overflow-hidden transition-all duration-300 ${
          menuOpen ? "max-h-64" : "max-h-0"
        }`}
      >
        <div className="container-app flex flex-col py-3">
          {navLinks.map((link, index) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `py-3 font-medium border-b border-black/5 last:border-none transition-all duration-300 transform focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ember-500 px-2 ${
                  isActive ? "text-ember-600 underline underline-offset-4" : "text-ink"
                } ${menuOpen ? "translate-x-0" : "-translate-x-2"}`
              }
              style={{
                transitionDelay: menuOpen ? `${index * 50}ms` : "0ms",
              }}
              aria-current={({ isActive }) => (isActive ? "page" : undefined)}
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </header>
  );
}

function CartIcon({ ...props }) {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 stroke-brand-800 fill-none" strokeWidth="1.8" {...props}>
      <path d="M3 3h2l.4 2M7 13h10l3-8H5.4M7 13L5.4 5M7 13l-1.5 4h11" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="20" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="17" cy="20" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

function MenuIcon({ open, ...props }) {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 stroke-brand-800 fill-none" strokeWidth="2" {...props}>
      {open ? (
        <path
          d="M6 6l12 12M18 6L6 18"
          strokeLinecap="round"
          className="transition-all duration-300"
        />
      ) : (
        <path
          d="M4 7h16M4 12h16M4 17h16"
          strokeLinecap="round"
          className="transition-all duration-300"
        />
      )}
    </svg>
  );
}
