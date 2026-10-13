'use client';

import { useMemo, useState } from 'react';
import { 
  ArrowDownToLine, 
  Building2, 
  Calendar, 
  CircleAlert, 
  Download, 
  Filter, 
  MapPin, 
  RotateCcw, 
  Search, 
  Truck 
} from 'lucide-react';
import DropdownField from './DropdownField';
import { 
  exportarCSVRegistros, 
  formatarDataHora, 
  parseDataHoraMs 
} from '../utils/deliveryMetrics';

export default function TabelaRegistros({
  registros = [],
  unidades = [],
  carregando = false,
}) {
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroEvento, setFiltroEvento] = useState('');
  const [filtroUnidade, setFiltroUnidade] = useState('');
  const [filtroPeriodo, setFiltroPeriodo] = useState('todos');

  // Opções de unidades para o filtro
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

  // Registros filtrados com base em todos os critérios
  const registrosFiltrados = useMemo(() => {
    const agora = new Date();
    const hojeStr = agora.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    const termo = filtroTexto.toLowerCase().trim();

    return registros.filter((reg) => {
      // 1. Filtro por texto (entregador, placa, unidade, data)
      if (termo) {
        const entregador = (reg.entregador_id || '').toLowerCase();
        const placa = (reg.placa || '').toLowerCase();
        const unidade = (reg.unidade || '').toLowerCase();
        const dataStr = `${reg.data_hora || ''} ${formatarDataHora(reg.data_hora)}`.toLowerCase();
        const bateuTexto = entregador.includes(termo) || placa.includes(termo) || unidade.includes(termo) || dataStr.includes(termo);
        if (!bateuTexto) return false;
      }

      // 2. Filtro por tipo de evento
      if (filtroEvento && reg.tipo_evento !== filtroEvento) {
        return false;
      }

      // 3. Filtro por unidade
      if (filtroUnidade && (reg.unidade || '').trim().toLowerCase() !== filtroUnidade.trim().toLowerCase()) {
        return false;
      }

      // 4. Filtro por período
      if (filtroPeriodo !== 'todos' && reg.data_hora) {
        const [dataParte] = reg.data_hora.split(' ');
        if (filtroPeriodo === 'hoje' && dataParte !== hojeStr) return false;
        if (filtroPeriodo === '7dias') {
          const ts = parseDataHoraMs(reg.data_hora);
          const limite = agora.getTime() - 7 * 24 * 60 * 60 * 1000;
          if (ts < limite) return false;
        }
        if (filtroPeriodo === '30dias') {
          const ts = parseDataHoraMs(reg.data_hora);
          const limite = agora.getTime() - 30 * 24 * 60 * 60 * 1000;
          if (ts < limite) return false;
        }
      }

      return true;
    });
  }, [registros, filtroTexto, filtroEvento, filtroUnidade, filtroPeriodo]);

  const totalChegadas = useMemo(() => {
    return registrosFiltrados.filter((r) => r.tipo_evento === 'chegada').length;
  }, [registrosFiltrados]);

  const totalSaidas = useMemo(() => {
    return registrosFiltrados.filter((r) => r.tipo_evento === 'saida').length;
  }, [registrosFiltrados]);

  const limparFiltros = () => {
    setFiltroTexto('');
    setFiltroEvento('');
    setFiltroUnidade('');
    setFiltroPeriodo('todos');
  };

  const temFiltrosAtivos = Boolean(filtroTexto || filtroEvento || filtroUnidade || filtroPeriodo !== 'todos');

  return (
    <div className="records-tab-container">
      {/* CABEÇALHO DA SEÇÃO DE REGISTROS */}
      <div className="section-heading-row mb-4">
        <div>
          <p className="page-eyebrow">Histórico completo</p>
          <h2 className="panel-title">Registros de Movimentação</h2>
          <p className="panel-description">
            Consulte todas as chegadas e saídas com detalhes de GPS, placa e unidade.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportarCSVRegistros(registrosFiltrados)}
            disabled={registrosFiltrados.length === 0}
            className="button-secondary"
            title="Exportar registros filtrados para formato CSV/Excel"
          >
            <Download size={16} aria-hidden="true" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* BARRA DE FERRAMENTAS E FILTROS */}
      <div className="records-toolbar mb-4">
        {/* Campo de Busca Textual */}
        <div className="records-search">
          <label className="field-label" htmlFor="buscar-registros-tab">
            Buscar registro
          </label>
          <div className="records-search-input">
            <Search className="records-search-icon" size={17} aria-hidden="true" />
            <input
              id="buscar-registros-tab"
              type="text"
              className="field-control"
              placeholder="Entregador, placa, unidade ou data..."
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
            />
          </div>
        </div>

        {/* Filtro de Evento */}
        <div className="min-w-[170px]">
          <DropdownField
            id="filtro-evento-tab"
            label="Tipo de evento"
            value={filtroEvento}
            onChange={setFiltroEvento}
            options={[
              { value: '', label: 'Todos os eventos' },
              { value: 'chegada', label: 'Apenas chegadas' },
              { value: 'saida', label: 'Apenas saídas' },
            ]}
          />
        </div>

        {/* Filtro de Unidade */}
        <div className="min-w-[190px]">
          <DropdownField
            id="filtro-unidade-tab"
            label="Unidade"
            value={filtroUnidade}
            onChange={setFiltroUnidade}
            options={opcoesUnidades}
          />
        </div>

        {/* Filtro de Período */}
        <div className="min-w-[160px]">
          <DropdownField
            id="filtro-periodo-tab"
            label="Período"
            value={filtroPeriodo}
            onChange={setFiltroPeriodo}
            options={[
              { value: 'todos', label: 'Todo o histórico' },
              { value: 'hoje', label: 'Hoje' },
              { value: '7dias', label: 'Últimos 7 dias' },
              { value: '30dias', label: 'Últimos 30 dias' },
            ]}
          />
        </div>

        {/* Botão de Limpar Filtros */}
        {temFiltrosAtivos && (
          <div className="flex items-end">
            <button
              type="button"
              onClick={limparFiltros}
              className="button-quiet text-xs font-semibold flex items-center gap-1.5 h-[46px]"
              title="Restaurar todos os filtros"
            >
              <RotateCcw size={14} />
              Limpar filtros
            </button>
          </div>
        )}
      </div>

      {/* RESUMO DOS REGISTROS FILTRADOS */}
      <div className="records-summary-badge-bar mb-3">
        <span className="text-xs text-gray-500">
          Exibindo <strong>{registrosFiltrados.length}</strong> de <strong>{registros.length}</strong> registros
        </span>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {totalChegadas} chegadas
          </span>
          <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            {totalSaidas} saídas
          </span>
        </div>
      </div>

      {/* TABELA DE REGISTROS */}
      <div className="records-surface">
        <table className="records-table">
          <thead>
            <tr className="bg-gray-100 text-gray-700 text-xs sm:text-sm uppercase tracking-wider">
              <th className="p-4 font-semibold whitespace-nowrap">Entregador</th>
              <th className="p-4 font-semibold whitespace-nowrap">Placa</th>
              <th className="p-4 font-semibold whitespace-nowrap">Evento</th>
              <th className="p-4 font-semibold whitespace-nowrap">Unidade</th>
              <th className="p-4 font-semibold whitespace-nowrap">Data / Hora</th>
              <th className="p-4 font-semibold whitespace-nowrap">Localização GPS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm sm:text-base">
            {carregando ? (
              <tr>
                <td colSpan="6" className="empty-state">
                  Carregando registros de movimentação...
                </td>
              </tr>
            ) : registrosFiltrados.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-state">
                  {temFiltrosAtivos
                    ? 'Nenhum registro encontrado com os filtros selecionados.'
                    : 'Nenhum registro encontrado no banco de dados.'}
                </td>
              </tr>
            ) : (
              registrosFiltrados.map((reg) => (
                <tr key={reg.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <td data-label="Entregador" className="font-semibold text-gray-900 dark:text-gray-100">
                    {reg.entregador_id}
                  </td>
                  <td data-label="Placa" className="font-mono font-bold text-gray-700 dark:text-gray-300">
                    {reg.placa || '-'}
                  </td>
                  <td data-label="Evento">
                    <span className="event-badge" data-event={reg.tipo_evento}>
                      {reg.tipo_evento}
                    </span>
                  </td>
                  <td data-label="Unidade" className="text-gray-800 dark:text-gray-200">
                    {reg.unidade || '-'}
                  </td>
                  <td data-label="Data / hora" className="text-gray-600 dark:text-gray-400">
                    {formatarDataHora(reg.data_hora)}
                  </td>
                  <td data-label="Localização">
                    {reg.latitude != null && reg.longitude != null ? (
                      <a
                        href={`https://maps.google.com/?q=${reg.latitude},${reg.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-action"
                        title="Abrir localização no Google Maps"
                      >
                        {reg.distancia_metros != null ? `${Math.round(reg.distancia_metros)} m da unidade` : 'Ver no mapa'}
                        {reg.precisao_metros != null && (
                          <span className="block text-xs text-gray-500">
                            Precisão ±{Math.round(reg.precisao_metros)} m
                          </span>
                        )}
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
