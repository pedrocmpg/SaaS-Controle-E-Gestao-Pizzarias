/**
 * Componente que fornece skip links e features de acessibilidade global
 */

export function AccessibilityOverlay() {
  return (
    <>
      {/* Skip link - só visível no focus */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-0 focus:left-0 focus:bg-brand-700 focus:text-white focus:p-3 focus:z-[999]"
      >
        Pular para conteúdo principal
      </a>

      {/* Screen reader only text */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Bem-vindo ao site da Sua Marca Aqui
      </div>
    </>
  );
}

/**
 * Utilitário Tailwind: sr-only (screen reader only)
 * Deve estar em index.css se não estiver
 */
