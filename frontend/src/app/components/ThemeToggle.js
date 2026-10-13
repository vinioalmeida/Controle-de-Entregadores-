'use client';

import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';

const THEME_STORAGE_KEY = 'controle-patio-theme';
const THEME_CHANGE_EVENT = 'controle-patio-theme-change';

function assinarTema(callback) {
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, callback);
}

function lerTema() {
  return document.documentElement.dataset.theme || 'light';
}

function lerTemaNoServidor() {
  return 'light';
}

export default function ThemeToggle() {
  const tema = useSyncExternalStore(assinarTema, lerTema, lerTemaNoServidor);
  const temaEscuro = tema === 'dark';

  const alternarTema = () => {
    const proximoTema = temaEscuro ? 'light' : 'dark';
    document.documentElement.dataset.theme = proximoTema;
    window.localStorage.setItem(THEME_STORAGE_KEY, proximoTema);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={alternarTema}
      aria-label={temaEscuro ? 'Ativar modo claro' : 'Ativar modo escuro'}
      title={temaEscuro ? 'Ativar modo claro' : 'Ativar modo escuro'}
      aria-pressed={temaEscuro}
    >
      {temaEscuro ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}