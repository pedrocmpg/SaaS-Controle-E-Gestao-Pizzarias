import { io } from "socket.io-client";

// VITE_API_URL aponta para .../api — o socket conecta na origem (sem o /api)
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3333/api";
const SOCKET_URL = API_URL.replace(/\/api\/?$/, "");

let socket = null;

/**
 * Conecta (ou reaproveita) o socket autenticado com o mesmo JWT do HTTP.
 * O token do localStorage vai em `auth.token`; o cookie httpOnly é fallback no servidor.
 */
export function connectSocket() {
  if (socket && socket.connected) return socket;

  const token = localStorage.getItem("etd_admin_token");

  socket = io(SOCKET_URL, {
    withCredentials: true,
    auth: { token },
    autoConnect: true,
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
