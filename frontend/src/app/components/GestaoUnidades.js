'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  CircleAlert, 
  MapPin, 
  Pencil, 
  PlusCircle, 
  QrCode, 
  RotateCcw, 
  Trash2 
} from 'lucide-react';

export const DEMO_UNIDADES = [
  {
    id: 'demo-unidade-1',
    nome: 'CD Demonstração Barueri',
    endereco: 'Rua Exemplo, 100, Barueri - SP',
    ativa: true,
    raio_metros: 300,
    latitude: -23.5052,
    longitude: -46.8791,
  },
  {
    id: 'demo-unidade-2',
    nome: 'Filial Modelo Osasco',
    endereco: 'Avenida das Amostras, 250, Osasco - SP',
    ativa: true,
    raio_metros: 300,
    latitude: -23.5329,
    longitude: -46.7917,
  },
  {
    id: 'demo-unidade-3',
    nome: 'Ponto de Apoio Fictício',
    endereco: 'Alameda da Demonstração, 50, Santana de Parnaíba - SP',
    ativa: false,
    raio_metros: 300,
    latitude: -23.4432,
    longitude: -46.9178,
  },
];

export default function GestaoUnidades({
  unidades = [],
  carregando = false,
  nomeUnidade = '',
  setNomeUnidade,
  enderecoUnidade = '',
  setEnderecoUnidade,
  unidadeEditandoId = null,
  salvandoUnidade = false,
  statusUnidade = '',
  cadastrarUnidade,
  iniciarEdicaoUnidade,
  cancelarEdicaoUnidade,
  alternarStatusUnidade,
}) {
  const [modoDemonstracao, setModoDemonstracao] = useState(false);
  const usandoDadosDemonstracao = modoDemonstracao || (!carregando && unidades.length === 0);
  const unidadesExibidas = usandoDadosDemonstracao ? DEMO_UNIDADES : unidades;
  const ativas = unidadesExibidas.filter((u) => u.ativa);
  const inativas = unidadesExibidas.filter((u) => !u.ativa);

  return (
    <div className="units-tab-container">
      <div className="section-heading-row mb-5">
        <div>
          <p className="page-eyebrow">Locais de operação</p>
          <h2 className="panel-title">Gestão de Unidades</h2>
          <p className="panel-description">
            Cadastre novos locais e gerencie QR codes fixos com raio de validação de 300 metros.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="event-badge" data-event="chegada">
            {ativas.length} {ativas.length === 1 ? 'ativa' : 'ativas'}
          </span>
          {inativas.length > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
              {inativas.length} inativa{inativas.length === 1 ? '' : 's'}
            </span>
          )}
          {!carregando && unidades.length > 0 && (
            <button
              type="button"
              onClick={() => setModoDemonstracao((ativo) => !ativo)}
              className="button-secondary text-xs h-9 px-3"
            >
              {modoDemonstracao ? 'Voltar às unidades cadastradas' : 'Ver dados fictícios'}
            </button>
          )}
        </div>
      </div>

      <section className="unit-management-grid">
        {/* FORMULÁRIO DE CADASTRO / EDIÇÃO */}
        <form onSubmit={cadastrarUnidade} className="unit-form-panel form-stack">
          <div className="panel-heading mb-0">
            <div className="flex items-center gap-2">
              <span className="chart-icon-box">
                {unidadeEditandoId ? <Pencil size={18} /> : <PlusCircle size={18} />}
              </span>
              <h3 className="panel-title">{unidadeEditandoId ? 'Editar unidade' : 'Cadastrar nova unidade'}</h3>
            </div>
            <p className="panel-description">
              O endereço é validado por geocodificação automática com raio fixo de 300 metros para conferência de GPS.
            </p>
          </div>

          <div>
            <label className="field-label" htmlFor="nome-unidade-input">
              Nome da unidade
            </label>
            <input
              id="nome-unidade-input"
              required
              value={nomeUnidade}
              onChange={(e) => setNomeUnidade(e.target.value)}
              className="field-control"
              placeholder="Ex.: Filial Alphaville, CD Barueri..."
            />
          </div>

          <div>
            <label className="field-label" htmlFor="endereco-unidade-input">
              Endereço completo
            </label>
            <textarea
              id="endereco-unidade-input"
              required
              rows={3}
              value={enderecoUnidade}
              onChange={(e) => setEnderecoUnidade(e.target.value)}
              className="field-control resize-y"
              placeholder="Rua/Avenida, número, cidade e estado"
            />
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="submit"
              disabled={salvandoUnidade}
              className="button-primary w-full"
            >
              {salvandoUnidade
                ? 'Localizando endereço...'
                : unidadeEditandoId
                ? 'Salvar alterações'
                : 'Cadastrar unidade'}
            </button>

            {unidadeEditandoId && (
              <button
                type="button"
                onClick={cancelarEdicaoUnidade}
                disabled={salvandoUnidade}
                className="button-secondary w-full"
              >
                Cancelar edição
              </button>
            )}
          </div>

          {statusUnidade && (
            <p role="status" className="status-message">
              {statusUnidade}
            </p>
          )}
        </form>

        {/* LISTA DE UNIDADES CADASTRADAS */}
        <section className="unit-list-panel">
          <div className="unit-list-heading">
            <div>
              <p className="page-eyebrow">Rede de atendimento</p>
              <h3 className="panel-title">Unidades Cadastradas</h3>
            </div>
            <span className="text-sm text-gray-500 font-semibold">{unidadesExibidas.length} no total</span>
          </div>

          {carregando ? (
            <div className="empty-state">Carregando unidades...</div>
          ) : unidadesExibidas.length === 0 ? (
            <div className="empty-state">Nenhuma unidade cadastrada ainda. Cadastre a primeira ao lado.</div>
          ) : (
            <>
              {usandoDadosDemonstracao && (
                <div className="status-message mb-4" role="status">
                  <CircleAlert size={16} aria-hidden="true" />
                  <span>Prévia com dados fictícios. Eles não foram salvos e as ações da lista ficam desativadas.</span>
                </div>
              )}
              <ul className="unit-list">
              {unidadesExibidas.map((unidade) => (
                <li key={unidade.id} className="unit-item">
                  <div className="unit-details">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-gray-900 dark:text-gray-100">{unidade.nome}</h4>
                      <span className="event-badge" data-event={unidade.ativa ? 'chegada' : 'saida'}>
                        {unidade.ativa ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>

                    <p className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1.5 mt-1">
                      <MapPin size={13} className="flex-shrink-0 mt-0.5 text-purple-700 dark:text-purple-300" />
                      <span>{unidade.endereco}</span>
                    </p>

                    <div className="text-[11px] text-gray-500 mt-1">
                      <span>Raio permitido: <strong>{Math.round(unidade.raio_metros)}m</strong></span>
                      {unidade.latitude != null && (
                        <span> • Lat: {unidade.latitude.toFixed(4)}, Lon: {unidade.longitude.toFixed(4)}</span>
                      )}
                    </div>
                  </div>

                  {usandoDadosDemonstracao ? (
                    <div className="unit-actions">
                      <span className="text-xs text-gray-500">Exemplo</span>
                    </div>
                  ) : (
                    <div className="unit-actions">
                      {unidade.ativa && (
                        <Link
                          href={`/qr?unidade_id=${unidade.id}`}
                          className="button-secondary text-xs h-9 px-3"
                          title="Ver e imprimir QR Code da unidade"
                        >
                          <QrCode size={14} aria-hidden="true" />
                          <span>QR Code</span>
                        </Link>
                      )}

                      <button
                        type="button"
                        onClick={() => iniciarEdicaoUnidade(unidade)}
                        className="button-secondary text-xs h-9 px-3"
                        title="Editar dados da unidade"
                      >
                        <Pencil size={14} aria-hidden="true" />
                        <span>Editar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => alternarStatusUnidade(unidade)}
                        className={unidade.ativa ? 'button-danger text-xs h-9 px-3' : 'button-secondary text-xs h-9 px-3'}
                        title={unidade.ativa ? 'Desativar unidade' : 'Reativar unidade'}
                      >
                        {unidade.ativa ? (
                          <>
                            <Trash2 size={14} aria-hidden="true" />
                            <span>Desativar</span>
                          </>
                        ) : (
                          <>
                            <RotateCcw size={14} aria-hidden="true" />
                            <span>Reativar</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </li>
              ))}
              </ul>
            </>
          )}
        </section>
      </section>
    </div>
  );
}
