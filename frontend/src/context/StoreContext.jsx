import { createContext, useContext, useEffect, useState } from "react";
import { settingsService } from "../services/api";

const StoreContext = createContext(null);

// Fallback usado enquanto a API carrega ou caso ela esteja indisponível.
// Mantém o site funcional (modo "vitrine") mesmo sem backend/DB configurado ainda.
const FALLBACK_SETTINGS = {
  whatsapp: "5554999999999",
  phone: "(54) 99999-9999",
  address: "R Pernambuco, 392 - Sala 01",
  city: "Bento Gonçalves",
  state: "RS",
  zipCode: "95705-052",
  ifoodUrl:
    "https://www.ifood.com.br/delivery/bento-goncalves-rs/e-tenho-ditto-pizzaria---bento-goncalves-e-garibaldi-humaita/9e21dfe2-99f6-4abc-9b51-3e4433336bfb",
  instagramUrl: null,
  facebookUrl: null,
  openingHours: {
    seg: { open: "18:00", close: "23:00" },
    ter: { open: "18:00", close: "23:00" },
    qua: { open: "18:00", close: "23:00" },
    qui: { open: "18:00", close: "23:00" },
    sex: { open: "18:00", close: "23:59" },
    sab: { open: "18:00", close: "23:59" },
    dom: { open: "18:00", close: "23:00" },
  },
  minDeliveryFee: 10,
  maxDeliveryFee: 20,
  minDeliveryTime: 40,
  maxDeliveryTime: 70,
  isOpen: true,
};

export function StoreProvider({ children }) {
  const [settings, setSettings] = useState(FALLBACK_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [apiOnline, setApiOnline] = useState(true);

  useEffect(() => {
    settingsService
      .get()
      .then((data) => {
        setSettings(data);
        setApiOnline(true);
      })
      .catch(() => {
        // Backend ainda não configurado / offline: usa dados fictícios de exemplo
        setApiOnline(false);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <StoreContext.Provider value={{ settings, loading, apiOnline }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore deve ser usado dentro de um StoreProvider");
  return ctx;
}
