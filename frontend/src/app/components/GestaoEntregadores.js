'use client';

import { 
  Pencil, 
  Phone, 
  PlusCircle, 
  RotateCcw, 
  Trash2, 
  Truck, 
  User, 
  Users 
} from 'lucide-react';

export default function GestaoEntregadores({
  entregadores = [],
  nomeEntregador = '',
  setNomeEntregador,
  placaEntregador = '',
  setPlacaEntregador,
  telefoneEntregador = '',
  setTelefoneEntregador,
  entregadorEditandoId = null,
  salvandoEntregador = false,
  statusEntregador = '',
  cadastrarEntregador,
  iniciarEdicaoEntregador,
  cancelarEdicaoEntregador,
  alternarStatusEntregador,
}) {
  const ativos = entregadores.filter((e) => e.ativo);
  const inativos = entregadores.filter((e) => !e.ativo);

  return (
    <div className="drivers-tab-container">
      <div className="section-heading-row mb-5">
        <div>
          <p className="page-eyebrow">Equipe de transporte</p>
          <h2 className="panel-title">Gestão de Entregadores</h2>
          <p className="panel-description">
            Cadastre os entregadores e vincule a placa padrão do veículo para agilizar o registro de pátio.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="event-badge" data-event="chegada">
            {ativos.length} {ativos.length === 1 ? 'ativo' : 'ativos'}
          </span>
          {inativos.length > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
              {inativos.length} inativo{inativos.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>

      <section className="unit-management-grid">
        {/* FORMULÁRIO DE CADASTRO / EDIÇÃO */}
        <form onSubmit={cadastrarEntregador} className="unit-form-panel form-stack">
          <div className="panel-heading mb-0">
            <div className="flex items-center gap-2">
              <span className="chart-icon-box" style={{ background: 'var(--rvd-blue-pale)', color: 'var(--brand-deep)' }}>
                {entregadorEditandoId ? <Pencil size={18} /> : <PlusCircle size={18} />}
              </span>
              <h3 className="panel-title">{entregadorEditandoId ? 'Editar entregador' : 'Cadastrar novo entregador'}</h3>
            </div>
            <p className="panel-description">
              O entregador cadastrado poderá ser selecionado diretamente na tela de registro operacional.
            </p>
          </div>

          <div>
            <label className="field-label" htmlFor="nome-entregador-input">
              Nome do entregador
            </label>
            <input
              id="nome-entregador-input"
              required
              value={nomeEntregador}
              onChange={(e) => setNomeEntregador(e.target.value)}
              className="field-control"
              placeholder="Ex.: Carlos Silva, Adriano Santos..."
            />
          </div>

          <div className="form-grid-two">
            <div>
              <label className="field-label" htmlFor="placa-entregador-input">
                Placa padrão (opcional)
              </label>
              <input
                id="placa-entregador-input"
                maxLength={7}
                value={placaEntregador}
                onChange={(e) => setPlacaEntregador(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 7).toUpperCase())}
                className="field-control font-mono"
                placeholder="ABC1D23"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="tel-entregador-input">
                Telefone (opcional)
              </label>
              <input
                id="tel-entregador-input"
                type="tel"
                value={telefoneEntregador}
                onChange={(e) => setTelefoneEntregador(e.target.value)}
                className="field-control"
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="submit"
              disabled={salvandoEntregador}
              className="button-primary w-full"
            >
              {salvandoEntregador
                ? 'Salvando...'
                : entregadorEditandoId
                ? 'Salvar alterações'
                : 'Cadastrar entregador'}
            </button>

            {entregadorEditandoId && (
              <button
                type="button"
                onClick={cancelarEdicaoEntregador}
                disabled={salvandoEntregador}
                className="button-secondary w-full"
              >
                Cancelar edição
              </button>
            )}
          </div>

          {statusEntregador && (
            <p role="status" className="status-message">
              {statusEntregador}
            </p>
          )}
        </form>

        {/* LISTA DE ENTREGADORES */}
        <section className="unit-list-panel">
          <div className="unit-list-heading">
            <div>
              <p className="page-eyebrow">Motoristas cadastrados</p>
              <h3 className="panel-title">Lista de Entregadores</h3>
            </div>
            <span className="text-sm text-gray-500 font-semibold">{entregadores.length} no total</span>
          </div>

          {entregadores.length === 0 ? (
            <div className="empty-state">Nenhum entregador cadastrado ainda. Cadastre o primeiro no formulário ao lado.</div>
          ) : (
            <ul className="unit-list">
              {entregadores.map((entregador) => (
                <li key={entregador.id} className="unit-item">
                  <div className="unit-details">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-gray-900 dark:text-gray-100">{entregador.nome}</h4>
                      <span className="event-badge" data-event={entregador.ativo ? 'chegada' : 'saida'}>
                        {entregador.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-400 mt-1.5">
                      {entregador.placa_padrao && (
                        <span className="font-mono font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">
                          {entregador.placa_padrao}
                        </span>
                      )}
                      {entregador.telefone && (
                        <span className="flex items-center gap-1">
                          <Phone size={12} className="text-purple-700 dark:text-purple-300" />
                          {entregador.telefone}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="unit-actions">
                    <button
                      type="button"
                      onClick={() => iniciarEdicaoEntregador(entregador)}
                      className="button-secondary text-xs h-9 px-3"
                      title="Editar dados do entregador"
                    >
                      <Pencil size={14} aria-hidden="true" />
                      <span>Editar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => alternarStatusEntregador(entregador)}
                      className={entregador.ativo ? 'button-danger text-xs h-9 px-3' : 'button-secondary text-xs h-9 px-3'}
                      title={entregador.ativo ? 'Desativar entregador' : 'Reativar entregador'}
                    >
                      {entregador.ativo ? (
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
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </div>
  );
}
