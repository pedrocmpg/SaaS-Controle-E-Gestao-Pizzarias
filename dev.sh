#!/bin/bash
# Abre dois terminais: um rodando o backend (npm run dev) e outro o frontend (npm run dev)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

open_terminal() {
  local title="$1"
  local dir="$2"
  local cmd="cd \"$dir\" && npm run dev; exec bash"

  if command -v gnome-terminal &> /dev/null; then
    gnome-terminal --title="$title" -- bash -c "$cmd"
  elif command -v konsole &> /dev/null; then
    konsole --new-tab -p tabtitle="$title" -e bash -c "$cmd"
  elif command -v xfce4-terminal &> /dev/null; then
    xfce4-terminal --title="$title" -e "bash -c '$cmd'"
  elif command -v xterm &> /dev/null; then
    xterm -T "$title" -e bash -c "$cmd" &
  else
    echo "Nenhum emulador de terminal suportado encontrado (gnome-terminal, konsole, xfce4-terminal, xterm)."
    exit 1
  fi
}

open_terminal "Backend" "$BACKEND_DIR"
open_terminal "Frontend" "$FRONTEND_DIR"
