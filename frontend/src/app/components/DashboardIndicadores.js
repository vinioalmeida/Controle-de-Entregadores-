'use client';

import { useMemo, useState } from 'react';
import { 
  Award, 
  Building2, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  Radio, 
  Timer, 
  Truck, 
  UserCheck, 
  Users, 
  Zap 
} from 'lucide-react';
import DropdownField from './DropdownField';
import { 
  formatarApenasHora, 
  formatarDataHora, 
  formatarDuracao, 
  formatarDuracaoMedia, 
  formatarTempoDecorrido, 
  processarMetricasCompletas 
} from '../utils/deliveryMetrics';

export default function DashboardIndicadores({
  registros = [],
  unidades = [],
  carregando = false,
  onIrParaRegistros,
  onIrParaUnidades,
}) {
  const [periodo, setPeriodo] = useState('todos'); // 'todos' | 'hoje' | '7dias' | '30dias'
  const [unidadeFiltro, setUnidadeFiltro] = useState('');

  // Processamento reativo das métricas
  const metricas = useMemo(() => {
    return processarMetricasCompletas(registros, unidades, {
      periodo,
      unidadeFiltro,
    });
  }, [registros, unidades, periodo, unidadeFiltro]);

  // Opções para o dropdown de filtro de unidades
  const opcoesUnidades = useMemo(() => {
    const lista = [{ value: '', label: 'Todas as unidades' }];
    const nomes = new Set();
    unidades.forEach((u) => {
      if (u.nome) nomes.add(u.nome.trim());
    });
    registros.forEach((r) => {
      if (r.unidade) nomes.add(r.unidade.trim());
    });
    Array.from(nomes).sort().forEach((nome) => {
      lista.push({ value: nome, label: nome });
    });
    return lista;
  }, [unidades, registros]);

  // Proporção máxima para barras de tempo por unidade
  const tempoMaximoEntreUnidades = useMemo(() => {
    const tempos = metricas.listaUnidadesStats
      .map((u) => u.tempoMedioSegundos)
      .filter((t) => t > 0);
    return tempos.length > 0 ? Math.max(...tempos, 60) : 60;
  }, [metricas.listaUnidadesStats]);

  // Proporção máxima para barras de tempo por entregador
  const tempoMaximoEntreEntregadores = useMemo(() => {
    const tempos = metricas.listaEntregadoresStats
      .map((e) => e.tempoMedioSegundos)
      .filter((t) => t > 0);
    return tempos.length > 0 ? Math.max(...tempos, 60) : 60;
  }, [metricas.listaEntregadoresStats]);

  return (
    <div className="dashboard-container">
      {/* BARRA DE FILTROS DO DASHBOARD */}
      <div className="dashboard-controls">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar size={14} className="text-purple-700 dark:text-purple-300" />
            Período:
          </span>
          <div className="period-pill-group" role="group" aria-label="Filtro de período">
            <button
              type="button"
              className="period-pill-btn"
              data-active={periodo === 'todos'}
              onClick={() => setPeriodo('todos')}
            >
              Todo o Histórico
            </button>
            <button
              type="button"
              className="period-pill-btn"
              data-active={periodo === 'hoje'}
              onClick={() => setPeriodo('hoje')}
            >
              Hoje
            </button>
            <button
              type="button"
              className="period-pill-btn"
              data-active={periodo === '7dias'}
              onClick={() => setPeriodo('7dias')}
            >
              Últimos 7 dias
            </button>
            <button
              type="button"
              className="period-pill-btn"
              data-active={periodo === '30dias'}
              onClick={() => setPeriodo('30dias')}
            >
              Últimos 30 dias
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto min-w-[220px]">
          <div className="w-full">
            <DropdownField
              id="filtro-unidade-dashboard"
              label="Filtrar por unidade"
              value={unidadeFiltro}
              onChange={setUnidadeFiltro}
              options={opcoesUnidades}
            />
          </div>
        </div>
      </div>

      {/* CARDS DE INDICADORES CHAVE (KPIS) */}
      <section className="kpi-cards-grid" aria-label="Indicadores principais">
        {/* KPI 1: Tempo Médio de Entrega Geral */}
        <div className="kpi-card">
          <div className="kpi-card-header">
            <h3 className="kpi-card-title">Tempo Médio Geral</h3>
            <span className="kpi-card-icon" style={{ background: 'var(--rvd-blue)', color: 'var(--brand)' }}>
              <Timer size={20} aria-hidden="true" />
            </span>
          </div>
          <div>
            <p className="kpi-card-value">
              {metricas.totalEntregasConcluidas > 0
                ? formatarDuracaoMedia(metricas.tempoMedioGeralSegundos)
                : '-'}
            </p>
            <div className="kpi-card-footer">
              {metricas.totalEntregasConcluidas > 0 ? (
                <span>
                  Mín: <strong>{formatarDuracao(metricas.tempoMinGeral)}</strong> • Máx: <strong>{formatarDuracao(metricas.tempoMaxGeral)}</strong>
                </span>
              ) : (
                <span>Aguardando registros de entrega</span>
              )}
            </div>
          </div>
        </div>

        {/* KPI 2: Entregas Realizadas */}
        <div className="kpi-card">
          <div className="kpi-card-header">
            <h3 className="kpi-card-title">Entregas Realizadas</h3>
            <span className="kpi-card-icon" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
              <CheckCircle2 size={20} aria-hidden="true" />
            </span>
          </div>
          <div>
            <p className="kpi-card-value">{metricas.totalEntregasConcluidas}</p>
            <div className="kpi-card-footer">
              <span>Taxa de conclusão: <strong>{metricas.taxaConclusao}%</strong> das chegadas</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Entregadores no Local Agora */}
        <div className="kpi-card">
          <div className="kpi-card-header">
            <h3 className="kpi-card-title">No Local Agora</h3>
            <span className="kpi-card-icon relative" style={{ background: 'var(--rvd-blue-pale)', color: 'var(--brand-deep)' }}>
              <Radio size={20} aria-hidden="true" className={metricas.noLocalAgora.length > 0 ? 'animate-pulse text-green-600' : ''} />
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="kpi-card-value">{metricas.noLocalAgora.length}</p>
              {metricas.noLocalAgora.length > 0 && (
                <span className="live-pulse-badge">
                  <span className="live-pulse-dot" /> Em atendimento
                </span>
              )}
            </div>
            <div className="kpi-card-footer">
              <span>{metricas.noLocalAgora.length === 1 ? '1 entregador aguardando saída' : `${metricas.noLocalAgora.length} entregadores aguardando saída`}</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Total de Entregadores em Operação */}
        <div className="kpi-card">
          <div className="kpi-card-header">
            <h3 className="kpi-card-title">Entregadores Ativos</h3>
            <span className="kpi-card-icon" style={{ background: 'var(--rvd-plum-pale)', color: 'var(--brand)' }}>
              <Users size={20} aria-hidden="true" />
            </span>
          </div>
          <div>
            <p className="kpi-card-value">{metricas.totalEntregadoresUnicos}</p>
            <div className="kpi-card-footer">
              {metricas.entregadorMaisRapido ? (
                <span>Mais ágil: <strong>{metricas.entregadorMaisRapido.nome}</strong> ({formatarDuracaoMedia(metricas.entregadorMaisRapido.tempoMedioSegundos)})</span>
              ) : (
                <span>{metricas.totalEntregasConcluidas} entregas concluídas</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO PRINCIPAL DE GRÁFICOS: TEMPO POR UNIDADE & TEMPO POR ENTREGADOR */}
      <section className="dashboard-grid-two mb-6">
        {/* GRÁFICO 1: TEMPO MÉDIO DE ENTREGA POR UNIDADE */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <div className="flex items-center gap-2">
                <span className="chart-icon-box"><Building2 size={18} /></span>
                <h2 className="chart-card-title">Tempo Médio de Entrega por Unidade</h2>
              </div>
              <p className="chart-card-subtitle">
                Permanência média calculada entre a chegada e saída em cada local
              </p>
            </div>
          </div>

          <div className="chart-content">
            {carregando ? (
              <div className="empty-state">Carregando dados das unidades...</div>
            ) : metricas.listaUnidadesStats.length === 0 ? (
              <div className="empty-state">Nenhuma unidade com registros no período.</div>
            ) : (
              <div className="unit-time-bars-list">
                {metricas.listaUnidadesStats.map((unidade) => {
                  const temEntregas = unidade.entregasConcluidas.length > 0;
                  const percentualBarra = temEntregas
                    ? Math.max(8, Math.min(100, Math.round((unidade.tempoMedioSegundos / tempoMaximoEntreUnidades) * 100)))
                    : 0;
                  const eMaisRapida = metricas.unidadeMaisRapida?.id === unidade.id && temEntregas;

                  return (
                    <div key={unidade.id || unidade.nome} className="unit-bar-item">
                      <div className="unit-bar-header">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="unit-bar-name">{unidade.nome}</span>
                          {!unidade.ativa && (
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                              Inativa
                            </span>
                          )}
                          {eMaisRapida && (
                            <span className="fastest-unit-badge">
                              <Award size={13} /> Mais ágil
                            </span>
                          )}
                        </div>
                        <div className="unit-bar-value-box">
                          {temEntregas ? (
                            <span className="unit-bar-time-value">
                              {formatarDuracaoMedia(unidade.tempoMedioSegundos)}
                            </span>
                          ) : (
                            <span className="unit-bar-time-empty">Sem saídas finalizadas</span>
                          )}
                        </div>
                      </div>

                      {/* Barra de Progresso Visual */}
                      <div className="unit-progress-track">
                        {temEntregas ? (
                          <div
                            className="unit-progress-fill"
                            style={{
                              width: `${percentualBarra}%`,
                              background: unidade.tempoMedioSegundos <= 1800 
                                ? 'linear-gradient(90deg, #5eae79, #1c6848)' 
                                : unidade.tempoMedioSegundos <= 3600
                                ? 'linear-gradient(90deg, #88b8d0, #782078)'
                                : 'linear-gradient(90deg, #e9c28a, #a83e35)'
                            }}
                          />
                        ) : (
                          <div className="unit-progress-fill-empty" />
                        )}
                      </div>

                      <div className="unit-bar-footer">
                        <span>
                          <strong>{unidade.entregasConcluidas.length}</strong> {unidade.entregasConcluidas.length === 1 ? 'entrega realizada' : 'entregas realizadas'}
                        </span>
                        {temEntregas && (
                          <span className="text-xs text-gray-500">
                            Mín: <strong>{formatarDuracao(unidade.tempoMinSegundos)}</strong> • Máx: <strong>{formatarDuracao(unidade.tempoMaxSegundos)}</strong>
                          </span>
                        )}
                        {unidade.noLocalAgora > 0 && (
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            {unidade.noLocalAgora} no local
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* GRÁFICO 2: TEMPO MÉDIO DE ENTREGA POR ENTREGADOR (INDICATIVO DE ENTREGADORES) */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <div className="flex items-center gap-2">
                <span className="chart-icon-box" style={{ background: 'var(--rvd-blue-pale)', color: 'var(--brand-deep)' }}>
                  <Truck size={18} />
                </span>
                <h2 className="chart-card-title">Tempo Médio por Entregador</h2>
              </div>
              <p className="chart-card-subtitle">
                Média de tempo gasto pelos motoristas para concluir cada entrega
              </p>
            </div>
            {metricas.entregadorMaisRapido && (
              <span className="fastest-unit-badge">
                <Zap size={13} /> Mais ágil: {metricas.entregadorMaisRapido.nome}
              </span>
            )}
          </div>

          <div className="chart-content">
            {carregando ? (
              <div className="empty-state">Carregando entregadores...</div>
            ) : metricas.listaEntregadoresStats.length === 0 ? (
              <div className="empty-state">Nenhum entregador com registros no período.</div>
            ) : (
              <div className="unit-time-bars-list">
                {metricas.listaEntregadoresStats.map((entregador) => {
                  const temEntregas = entregador.entregasConcluidas.length > 0;
                  const percentualBarra = temEntregas
                    ? Math.max(8, Math.min(100, Math.round((entregador.tempoMedioSegundos / tempoMaximoEntreEntregadores) * 100)))
                    : 0;
                  const eMaisRapido = metricas.entregadorMaisRapido?.nome === entregador.nome && temEntregas;
                  const placaPrincipal = entregador.placasLista && entregador.placasLista.length > 0
                    ? entregador.placasLista.join(', ')
                    : null;

                  return (
                    <div key={entregador.nome} className="unit-bar-item">
                      <div className="unit-bar-header">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="unit-bar-name">{entregador.nome}</span>
                          {placaPrincipal && (
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">
                              {placaPrincipal}
                            </span>
                          )}
                          {eMaisRapido && (
                            <span className="fastest-unit-badge">
                              <Award size={13} /> Mais ágil
                            </span>
                          )}
                        </div>
                        <div className="unit-bar-value-box">
                          {temEntregas ? (
                            <span className="unit-bar-time-value">
                              {formatarDuracaoMedia(entregador.tempoMedioSegundos)}
                            </span>
                          ) : (
                            <span className="unit-bar-time-empty">Sem saídas finalizadas</span>
                          )}
                        </div>
                      </div>

                      {/* Barra de Progresso Visual */}
                      <div className="unit-progress-track">
                        {temEntregas ? (
                          <div
                            className="unit-progress-fill"
                            style={{
                              width: `${percentualBarra}%`,
                              background: entregador.tempoMedioSegundos <= 1800 
                                ? 'linear-gradient(90deg, #5eae79, #1c6848)' 
                                : entregador.tempoMedioSegundos <= 3600
                                ? 'linear-gradient(90deg, #88b8d0, #782078)'
                                : 'linear-gradient(90deg, #e9c28a, #a83e35)'
                            }}
                          />
                        ) : (
                          <div className="unit-progress-fill-empty" />
                        )}
                      </div>

                      <div className="unit-bar-footer">
                        <span>
                          <strong>{entregador.entregasConcluidas.length}</strong> {entregador.entregasConcluidas.length === 1 ? 'entrega realizada' : 'entregas realizadas'}
                        </span>
                        {temEntregas && (
                          <span className="text-xs text-gray-500">
                            Mín: <strong>{formatarDuracao(entregador.tempoMinSegundos)}</strong> • Máx: <strong>{formatarDuracao(entregador.tempoMaxSegundos)}</strong>
                          </span>
                        )}
                        {entregador.noLocalAgora && (
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            No local ({entregador.unidadeAtual || 'Unidade'})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SEÇÃO 2: ENTREGADORES NO LOCAL AGORA & ÚLTIMAS ENTREGAS CONCLUÍDAS */}
      <section className="dashboard-grid-two mb-6">
        {/* PAINEL "NO LOCAL AGORA" (EM ATENDIMENTO) */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <div className="flex items-center gap-2">
                <span className="chart-icon-box" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
                  <UserCheck size={18} />
                </span>
                <h2 className="chart-card-title">Entregadores no Local Agora</h2>
              </div>
              <p className="chart-card-subtitle">
                Profissionais com chegada confirmada aguardando registro de saída
              </p>
            </div>
            <span className="event-badge" data-event="chegada">
              {metricas.noLocalAgora.length} ativo{metricas.noLocalAgora.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="chart-content">
            {metricas.noLocalAgora.length === 0 ? (
              <div className="empty-state py-8 text-center">
                <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-600 opacity-60" />
                <p className="font-semibold text-gray-700 dark:text-gray-300">Nenhum entregador no pátio no momento.</p>
                <p className="text-xs text-gray-500 mt-1">Todos os atendimentos recentes registraram saída.</p>
              </div>
            ) : (
              <ul className="active-drivers-list">
                {metricas.noLocalAgora.map((driver) => (
                  <li key={driver.id} className="active-driver-item">
                    <div className="active-driver-info">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                        <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm sm:text-base">
                          {driver.entregador}
                        </h4>
                        {driver.placa && driver.placa !== '-' && (
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">
                            {driver.placa}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <MapPin size={12} />
                        {driver.unidade}
                      </p>
                    </div>

                    <div className="active-driver-meta">
                      <span className="text-xs text-gray-500">
                        Chegada às <strong>{formatarApenasHora(driver.chegada)}</strong>
                      </span>
                      <span className="driver-elapsed-badge">
                        {formatarTempoDecorrido(driver.timestamp)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ÚLTIMAS ENTREGAS CONCLUÍDAS */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <div className="flex items-center gap-2">
                <span className="chart-icon-box"><CheckCircle2 size={18} /></span>
                <h2 className="chart-card-title">Últimas Entregas Concluídas</h2>
              </div>
              <p className="chart-card-subtitle">
                Atendimentos finalizados com tempo de permanência calculado
              </p>
            </div>
            {metricas.entregasConcluidas.length > 0 && (
              <button
                type="button"
                onClick={onIrParaRegistros}
                className="button-quiet text-xs font-semibold"
              >
                Ver histórico ➔
              </button>
            )}
          </div>

          <div className="chart-content">
            {metricas.entregasConcluidas.length === 0 ? (
              <div className="empty-state py-8">
                Nenhuma entrega concluída (par de chegada e saída) no período selecionado.
              </div>
            ) : (
              <div>
                <table className="records-table completed-deliveries-table">
                  <thead>
                    <tr>
                      <th>Entregador</th>
                      <th>Placa</th>
                      <th>Unidade</th>
                      <th>Chegada / Saída</th>
                      <th>Tempo Gasto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {metricas.entregasConcluidas.slice(0, 6).map((entrega) => (
                      <tr key={entrega.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <td data-label="Entregador" className="font-semibold text-gray-900 dark:text-gray-100">
                          {entrega.entregador}
                        </td>
                        <td data-label="Placa" className="font-mono text-xs font-semibold text-gray-700 dark:text-gray-300">
                          {entrega.placa || '-'}
                        </td>
                        <td data-label="Unidade" className="text-gray-700 dark:text-gray-300 text-xs">
                          {entrega.unidade}
                        </td>
                        <td data-label="Horários" className="text-xs text-gray-600 dark:text-gray-400">
                          {formatarApenasHora(entrega.chegada)} ➔ {formatarApenasHora(entrega.saida)}
                        </td>
                        <td data-label="Duração">
                          <span className="duration-pill">
                            <Timer size={13} />
                            {formatarDuracao(entrega.duracaoSegundos)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
