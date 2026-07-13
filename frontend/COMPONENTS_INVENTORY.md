# 📦 Inventário de Componentes - E Tenho Ditto Pizzaria

## Estrutura de Diretórios

```
frontend/src/
├── components/
│   ├── ui/                          # Componentes reutilizáveis
│   │   ├── Badge.jsx                # Tags/badges com variants
│   │   ├── Button.jsx               # Botão centralizado
│   │   ├── Modal.jsx                # Modal acessível
│   │   ├── Spinner.jsx              # Loading states
│   │   ├── Toast.jsx                # Sistema de notificações
│   │   └── index.js                 # Exports
│   │
│   ├── AccessibilityOverlay.jsx     # Skip links & SR features
│   ├── CartDrawer.jsx               # Drawer do carrinho (mobile-optimized)
│   ├── FormCheckbox.jsx             # Checkbox acessível
│   ├── FormInput.jsx                # Input acessível
│   ├── FormSelect.jsx               # Select acessível
│   ├── Header.jsx                   # Header com menu responsivo
│   ├── Layout.jsx                   # Layout wrapper
│   ├── Logo.jsx                     # Logo/branding
│   ├── PizzaBuilderModal.jsx        # Pizza builder modal (redesigned)
│   ├── PizzaPreview.jsx             # SVG pizza preview
│   ├── WhatsAppButton.jsx           # WhatsApp CTA
│   └── Footer.jsx                   # Footer
│
├── hooks/
│   ├── useClickOutside.js           # Detect clicks outside element
│   ├── useIsMobile.js               # Detect mobile device
│   └── index.js                     # Exports
│
├── utils/
│   ├── accessibility.js             # ARIA utilities & accessibility helpers
│   └── ... (outros utilitários)
│
├── styles/
│   ├── animations.css               # Keyframes & animation classes
│   └── ... (outros estilos)
│
├── pages/
│   ├── Home.jsx
│   ├── Menu.jsx
│   ├── About.jsx
│   ├── Contact.jsx
│   ├── Checkout.jsx
│   └── admin/
│
├── context/
│   ├── CartContext.jsx
│   ├── StoreContext.jsx
│   └── AdminAuthContext.jsx
│
├── services/
│   └── api.js
│
├── App.jsx
├── main.jsx
├── index.css
└── ...
```

---

## 🎨 Componentes UI - Status & Features

### ✅ Badge.jsx
**Propósito:** Tags, labels, status indicators

**Props:**
```javascript
<Badge
  variant="default|primary|accent|success|warning|error|outline"
  size="sm|md|lg"
  className="extra-classes"
>
  Content
</Badge>
```

**Variants:**
- `default` - Cinza neutro
- `primary` - Verde (brand)
- `accent` - Laranja (destaque)
- `success` - Verde (sucesso)
- `warning` - Amarelo (aviso)
- `error` - Vermelho (erro)
- `outline` - Apenas border

**Status Badge:**
```javascript
<StatusBadge status="pending|confirmed|preparing|ready|delivered|cancelled" />
```

---

### ✅ Button.jsx
**Propósito:** Botão centralizado com múltiplos estados

**Props:**
```javascript
<Button
  variant="primary|secondary|outline|ghost|danger"
  size="xs|sm|md|lg|icon"
  disabled={false}
  loading={false}
  className="extra-classes"
>
  Click me
</Button>
```

**Features:**
- Spinner animado durante loading
- Min-height 44px (touch target)
- Focus ring WCAG AA
- Active scale effect (95%)
- Disabled state

---

### ✅ Modal.jsx
**Propósito:** Modal genérico com acessibilidade

**Props:**
```javascript
<Modal
  open={true}
  onClose={() => {}}
  title="Modal Title"
  size="md|sm|lg|xl|2xl"
  closeButton={true}
  footer={<button>OK</button>}
>
  Content
</Modal>
```

**Features:**
- Escape key para fechar
- Click backdrop para fechar
- ARIA compliant
- Transições suaves
- Body scroll lock

---

### ✅ Spinner.jsx
**Propósito:** Loading indicators

**Componentes:**
```javascript
<Spinner size="sm|md|lg|xl" />
<SkeletonLoader count={3} height="h-20" />
<CardSkeleton count={3} />
```

---

### ✅ Toast.jsx
**Propósito:** Sistema de notificações

**Uso via Hook:**
```javascript
const toast = useToast();
toast.success("Sucesso!");
toast.error("Erro!");
toast.info("Info!");
toast.warning("Aviso!");
```

**Features:**
- Auto-dismiss (4 segundos padrão)
- Stacked notifications
- Role="status" e role="alert" apropriados
- Smooth animations

---

## 🛠️ Componentes de Formulário - Status & Features

### ✅ FormInput.jsx
**Propósito:** Input com validação e acessibilidade

```javascript
<FormInput
  label="Email"
  name="email"
  type="email"
  value={email}
  onChange={handleChange}
  onBlur={handleBlur}
  error={errors.email}
  required={true}
  disabled={false}
  helperText="Format: example@email.com"
  className="extra-classes"
/>
```

**Features:**
- ARIA attributes
- Error styling
- Helper text
- Auto-generated IDs
- Focus ring

---

### ✅ FormCheckbox.jsx
**Propósito:** Checkbox acessível

```javascript
<FormCheckbox
  label="Concordo"
  name="agree"
  checked={checked}
  onChange={handleChange}
  required={true}
  disabled={false}
/>
```

---

### ✅ FormSelect.jsx
**Propósito:** Select acessível

```javascript
<FormSelect
  label="Escolha"
  name="choice"
  options={[
    { value: "1", label: "Opção 1" },
    { value: "2", label: "Opção 2" }
  ]}
  value={value}
  onChange={handleChange}
  error={errors.choice}
  placeholder="Selecione..."
/>
```

---

## 🧩 Componentes Principais

### ✅ Header.jsx
**Features:**
- Logo clickável
- Menu horizontal (desktop)
- Menu mobile com max-height transition
- Cart button com badge
- Staggered menu animations
- WCAG touch targets (44px)
- ARIA roles e labels

---

### ✅ CartDrawer.jsx
**Features:**
- Drawer slide-in from right
- Fade-in backdrop
- Responsive padding (mobile vs desktop)
- Quantity controls (touch-friendly)
- "Continuar comprando" button
- Min-height 48px buttons
- Staggered item animations

---

### ✅ PizzaBuilderModal.jsx
**Features:**
- 2-column layout (desktop), 1-column (mobile)
- SVG pizza preview integrado
- Flavor selection com checkmarks
- Progress dots animados
- Price breakdown
- Border selection
- Observations textarea
- Emoji buttons (🍕 🍫)
- Touch-friendly (min-height 60px em flavor cards)

---

### ✅ PizzaPreview.jsx
**Features:**
- SVG pizza dinâmica
- Cores por sabor
- Borda visual indicator
- Flavor badges
- Resto de sabores counter
- Responsive size (48x48 mobile, 56x56 desktop)

---

## 🎯 Hooks Customizados

### ✅ useIsMobile.js
```javascript
const isMobile = useIsMobile(768); // breakpoint default 768px
```

**Features:**
- Detecta resize
- Cleanup automático
- Customizável por breakpoint

---

### ✅ useClickOutside.js
```javascript
const ref = useClickOutside(() => {
  // Clicou fora
});

return <div ref={ref}>Content</div>;
```

---

## 🎨 Utilities & Styling

### ✅ accessibility.js
```javascript
// Focus classes
focusClasses.ring
focusClasses.ringSecondary
focusClasses.ringSmall

// ARIA labels
ariaLabels.cartItems(5)
ariaLabels.addItem("Pizza")
ariaLabels.removeItem("Pizza")
ariaLabels.openMenu
ariaLabels.closeMenu

// Price to words
priceToWords(1234.56) // Para screen readers

// Input ID generation
generateInputId("email") // input_email_randomid
```

### ✅ animations.css
```css
/* Keyframes */
@keyframes fadeIn, fadeOut
@keyframes slideInUp, slideInDown, slideOutUp, slideOutDown
@keyframes scaleIn
@keyframes pulse-soft, bounce-sm, glow

/* Classes */
.animate-fade-in
.animate-slide-in-up
.animate-scale-in
.animate-pulse-soft
.animate-bounce-sm
.animate-glow
.transition-smooth
.hover-lift
.hover-scale
.hover-glow
.active-press
.focus-ring
```

### ✅ index.css Utilities
```css
/* Screen reader only */
.sr-only
.not-sr-only

/* Line clamping */
.line-clamp-1
.line-clamp-2
.line-clamp-3

/* Safe area for notches */
@supports (padding: max(0px)) {
  body { padding: max(..., env(safe-area-inset-*)); }
}
```

---

## 📊 Status de Implementação

| Componente | Status | Mobile | A11y | Animations | Testado |
|-----------|--------|--------|------|-----------|---------|
| Badge | ✅ | ✅ | ✅ | ✅ | ✅ |
| Button | ✅ | ✅ | ✅ | ✅ | ✅ |
| Modal | ✅ | ✅ | ✅ | ✅ | ✅ |
| Spinner | ✅ | ✅ | ✅ | ✅ | ✅ |
| Toast | ✅ | ✅ | ✅ | ✅ | ✅ |
| FormInput | ✅ | ✅ | ✅ | ✅ | ✅ |
| FormCheckbox | ✅ | ✅ | ✅ | ✅ | ✅ |
| FormSelect | ✅ | ✅ | ✅ | ✅ | ✅ |
| Header | ✅ | ✅ | ✅ | ✅ | ✅ |
| CartDrawer | ✅ | ✅ | ✅ | ✅ | ✅ |
| PizzaBuilder | ✅ | ✅ | ✅ | ✅ | ✅ |
| PizzaPreview | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 🚀 Como Estender

### Adicionar novo componente UI
```javascript
// 1. Criar frontend/src/components/ui/MyComponent.jsx
// 2. Adicionar ao index.js
export { default as MyComponent } from "./MyComponent";
// 3. Usar via import
import { MyComponent } from "../components/ui";
```

### Adicionar novo hook
```javascript
// 1. Criar frontend/src/hooks/useMyHook.js
// 2. Adicionar ao index.js
export { useMyHook } from "./useMyHook";
// 3. Usar via import
import { useMyHook } from "../hooks";
```

### Adicionar novo utility
```javascript
// Adicionar à accessibility.js ou criar novo arquivo
export const myUtility = (value) => { /* ... */ };
```

---

## 📝 Notas Finais

- Todos os componentes UI estão em `src/components/ui/`
- Todos os hooks estão em `src/hooks/`
- Acessibilidade é prioridade em todos os componentes
- Touch targets minimum 44×44px em mobile
- Animações são suaves e performáticas
- WCAG AA compliance em toda a interface

---

**Última atualização:** 12 de Julho de 2026  
**Versão:** 1.0.0
