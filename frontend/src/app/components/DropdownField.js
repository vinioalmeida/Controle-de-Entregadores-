'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export default function DropdownField({ id, label, value, options, onChange, disabled = false }) {
  const generatedId = useId();
  const triggerId = id || `dropdown-${generatedId}`;
  const listboxId = `${triggerId}-listbox`;
  const rootRef = useRef(null);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = options[selectedIndex];
  const [aberto, setAberto] = useState(false);
  const [indiceAtivo, setIndiceAtivo] = useState(Math.max(selectedIndex, 0));

  useEffect(() => {
    if (!aberto) return undefined;

    const fecharAoClicarFora = (event) => {
      if (!rootRef.current?.contains(event.target)) setAberto(false);
    };

    document.addEventListener('pointerdown', fecharAoClicarFora);
    return () => document.removeEventListener('pointerdown', fecharAoClicarFora);
  }, [aberto]);

  const abrirEm = (indice) => {
    setIndiceAtivo(Math.min(Math.max(indice, 0), options.length - 1));
    setAberto(true);
  };

  const selecionar = (option) => {
    onChange(option.value);
    setAberto(false);
  };

  const navegarTeclado = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!aberto) {
        abrirEm(selectedIndex >= 0 ? selectedIndex : 0);
        return;
      }
      const direcao = event.key === 'ArrowDown' ? 1 : -1;
      setIndiceAtivo((indice) => (indice + direcao + options.length) % options.length);
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      abrirEm(event.key === 'Home' ? 0 : options.length - 1);
      return;
    }

    if (event.key === 'Escape' && aberto) {
      event.preventDefault();
      setAberto(false);
      return;
    }

    if (event.key === 'Tab' && aberto) {
      setAberto(false);
      return;
    }

    if ((event.key === 'Enter' || event.key === ' ') && aberto) {
      event.preventDefault();
      selecionar(options[indiceAtivo]);
    }
  };

  return (
    <div className="dropdown-field" ref={rootRef}>
      <label className="field-label" id={`${triggerId}-label`} htmlFor={triggerId}>{label}</label>
      <button
        id={triggerId}
        type="button"
        className="dropdown-trigger"
        role="combobox"
        aria-labelledby={`${triggerId}-label ${triggerId}-value`}
        aria-controls={listboxId}
        aria-expanded={aberto}
        aria-haspopup="listbox"
        aria-activedescendant={aberto ? `${triggerId}-option-${indiceAtivo}` : undefined}
        disabled={disabled || options.length === 0}
        onClick={() => aberto ? setAberto(false) : abrirEm(selectedIndex >= 0 ? selectedIndex : 0)}
        onKeyDown={navegarTeclado}
      >
        <span id={`${triggerId}-value`} className="dropdown-value">{selectedOption?.label || 'Selecione uma opção'}</span>
        <ChevronDown className="dropdown-chevron" size={17} aria-hidden="true" />
      </button>

      {aberto && (
        <ul id={listboxId} className="dropdown-menu" role="listbox" aria-labelledby={`${triggerId}-label`}>
          {options.map((option, index) => {
            const selecionada = option.value === value;
            const ativa = index === indiceAtivo;
            return (
              <li
                id={`${triggerId}-option-${index}`}
                key={option.value}
                role="option"
                aria-selected={selecionada}
                className="dropdown-option"
                data-active={ativa}
                data-selected={selecionada}
                onMouseEnter={() => setIndiceAtivo(index)}
                onClick={() => selecionar(option)}
              >
                <span>{option.label}</span>
                {selecionada && <Check size={16} aria-hidden="true" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}