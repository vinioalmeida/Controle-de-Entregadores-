// Utilitários e cálculo de métricas de entrega e permanência em unidades e por entregador

export function formatarDataHora(dataString, incluirSegundos = false) {
  if (!dataString) return '-';
  try {
    const [dataParte, horaParte] = dataString.split(' ');
    if (!dataParte || !horaParte) return dataString;
    const [ano, mes, dia] = dataParte.split('-');
    const [hora, minuto, segundo] = horaParte.split(':');
    if (incluirSegundos && segundo) {
      return `${dia}/${mes}/${ano} às ${hora}:${minuto}:${segundo}`;
    }
    return `${dia}/${mes}/${ano} às ${hora}:${minuto}`;
  } catch {
    return dataString;
  }
}

export function formatarApenasHora(dataString) {
  if (!dataString) return '-';
  try {
    const [, horaParte] = dataString.split(' ');
    if (!horaParte) return dataString;
    const [hora, minuto] = horaParte.split(':');
    return `${hora}:${minuto}`;
  } catch {
    return dataString;
  }
}

export function formatarDuracao(segundos) {
  if (segundos == null || isNaN(segundos) || segundos < 0) return '-';
  const s = Math.round(segundos);
  if (s < 60) return `${s}s`;
  const mins = Math.floor(s / 60);
  const remSecs = s % 60;
  if (mins < 60) {
    return remSecs > 0 ? `${mins} min ${remSecs}s` : `${mins} min`;
  }
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h ${remMins} min` : `${hours}h`;
}

export function formatarDuracaoMedia(segundos) {
  if (segundos == null || isNaN(segundos) || segundos === 0) return '-';
  const s = Math.round(segundos);
  if (s < 60) return `${s} seg`;
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h ${remMins} min` : `${hours}h`;
}

export function formatarTempoDecorrido(timestampMs) {
  if (!timestampMs) return '-';
  const agora = Date.now();
  const diffSecs = Math.max(0, Math.floor((agora - timestampMs) / 1000));
  if (diffSecs < 60) return 'há poucos instantes';
  const mins = Math.floor(diffSecs / 60);
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) return `há ${hours}h ${remMins > 0 ? remMins + 'm' : ''}`;
  const days = Math.floor(hours / 24);
  return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
}

export function parseDataHoraMs(dataHoraStr) {
  if (!dataHoraStr) return 0;
  return new Date(dataHoraStr.replace(' ', 'T')).getTime();
}

export function processarMetricasCompletas(registros = [], unidades = [], { periodo = 'todos', unidadeFiltro = '' } = {}) {
  const agora = new Date();
  const hojeStr = agora.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

  // 1. Filtrar registros por período e unidade
  const registrosFiltrados = registros.filter((reg) => {
    if (!reg.data_hora) return false;
    const [dataParte] = reg.data_hora.split(' ');

    if (periodo === 'hoje' && dataParte !== hojeStr) return false;
    if (periodo === '7dias') {
      const dataReg = parseDataHoraMs(reg.data_hora);
      const limite = agora.getTime() - 7 * 24 * 60 * 60 * 1000;
      if (dataReg < limite) return false;
    }
    if (periodo === '30dias') {
      const dataReg = parseDataHoraMs(reg.data_hora);
      const limite = agora.getTime() - 30 * 24 * 60 * 60 * 1000;
      if (dataReg < limite) return false;
    }
    if (periodo === 'mes') {
      const [anoHoje, mesHoje] = hojeStr.split('-');
      const [anoReg, mesReg] = dataParte.split('-');
      if (anoReg !== anoHoje || mesReg !== mesHoje) return false;
    }
    if (unidadeFiltro && (reg.unidade || '').trim().toLowerCase() !== unidadeFiltro.trim().toLowerCase()) {
      return false;
    }
    return true;
  });

  // 2. Ordenar cronologicamente para pareamento
  const ordenados = [...registrosFiltrados].sort((a, b) => (a.data_hora || '').localeCompare(b.data_hora || ''));
  const abertos = new Map();
  const entregasConcluidas = [];

  for (const reg of ordenados) {
    const motoristaKey = (reg.entregador_id || '').trim().toLowerCase();
    const unidadeNome = (reg.unidade || 'Sem unidade').trim();
    const chave = `${motoristaKey}__${unidadeNome.toLowerCase()}`;
    const ts = parseDataHoraMs(reg.data_hora);

    if (reg.tipo_evento === 'chegada') {
      abertos.set(chave, { reg, ts, unidadeNome });
    } else if (reg.tipo_evento === 'saida') {
      let matching = abertos.get(chave);
      if (!matching) {
        // Fallback: busca chegada em aberto para o mesmo entregador
        for (const [k, v] of abertos.entries()) {
          if (k.startsWith(`${motoristaKey}__`)) {
            matching = v;
            abertos.delete(k);
            break;
          }
        }
      } else {
        abertos.delete(chave);
      }

      if (matching) {
        const duracaoSegundos = Math.max(0, Math.round((ts - matching.ts) / 1000));
        // Aceita sessões de permanência de até 24h
        if (duracaoSegundos <= 86400) {
          entregasConcluidas.push({
            id: `${matching.reg.id}_${reg.id}`,
            entregador: reg.entregador_id || matching.reg.entregador_id,
            placa: reg.placa || matching.reg.placa || '-',
            unidade: matching.unidadeNome,
            chegada: matching.reg.data_hora,
            saida: reg.data_hora,
            duracaoSegundos,
          });
        }
      }
    }
  }

  // 3. Entregadores no local agora (chegadas sem saída correspondente)
  const noLocalAgora = [];
  for (const [, val] of abertos.entries()) {
    const diffHoras = (agora.getTime() - val.ts) / (1000 * 60 * 60);
    const [dataParte] = val.reg.data_hora.split(' ');
    // Considera ativo se for do dia de hoje ou nas últimas 24 horas
    if (dataParte === hojeStr || diffHoras <= 24) {
      noLocalAgora.push({
        id: val.reg.id,
        entregador: val.reg.entregador_id,
        placa: val.reg.placa || '-',
        unidade: val.unidadeNome,
        chegada: val.reg.data_hora,
        timestamp: val.ts,
      });
    }
  }

  // 4. Mapeamento e métricas de cada unidade
  const mapaUnidades = new Map();
  // Inclui primeiro todas as unidades cadastradas
  unidades.forEach((u) => {
    mapaUnidades.set(u.nome.trim().toLowerCase(), {
      id: u.id,
      nome: u.nome.trim(),
      endereco: u.endereco,
      ativa: Boolean(u.ativa),
      totalChegadas: 0,
      totalSaidas: 0,
      totalMovimentos: 0,
      entregasConcluidas: [],
      tempoTotalSegundos: 0,
      tempoMedioSegundos: 0,
      tempoMinSegundos: null,
      tempoMaxSegundos: null,
      noLocalAgora: 0,
    });
  });

  // Processa todas as movimentações por unidade
  registrosFiltrados.forEach((reg) => {
    const uNome = (reg.unidade || 'Sem unidade').trim();
    const chave = uNome.toLowerCase();
    if (!mapaUnidades.has(chave)) {
      mapaUnidades.set(chave, {
        id: reg.unidade_id || null,
        nome: uNome,
        endereco: '-',
        ativa: true,
        totalChegadas: 0,
        totalSaidas: 0,
        totalMovimentos: 0,
        entregasConcluidas: [],
        tempoTotalSegundos: 0,
        tempoMedioSegundos: 0,
        tempoMinSegundos: null,
        tempoMaxSegundos: null,
        noLocalAgora: 0,
      });
    }
    const stat = mapaUnidades.get(chave);
    stat.totalMovimentos++;
    if (reg.tipo_evento === 'chegada') stat.totalChegadas++;
    if (reg.tipo_evento === 'saida') stat.totalSaidas++;
  });

  // Agrega entregas concluídas às unidades
  entregasConcluidas.forEach((entrega) => {
    const chave = (entrega.unidade || 'Sem unidade').trim().toLowerCase();
    const stat = mapaUnidades.get(chave);
    if (stat) {
      stat.entregasConcluidas.push(entrega);
      stat.tempoTotalSegundos += entrega.duracaoSegundos;
      if (stat.tempoMinSegundos === null || entrega.duracaoSegundos < stat.tempoMinSegundos) {
        stat.tempoMinSegundos = entrega.duracaoSegundos;
      }
      if (stat.tempoMaxSegundos === null || entrega.duracaoSegundos > stat.tempoMaxSegundos) {
        stat.tempoMaxSegundos = entrega.duracaoSegundos;
      }
    }
  });

  // Agrega entregadores no local às unidades
  noLocalAgora.forEach((item) => {
    const chave = (item.unidade || 'Sem unidade').trim().toLowerCase();
    const stat = mapaUnidades.get(chave);
    if (stat) stat.noLocalAgora++;
  });

  // Finaliza cálculo de médias e lista de unidades
  const listaUnidadesStats = Array.from(mapaUnidades.values()).map((stat) => {
    const qtd = stat.entregasConcluidas.length;
    stat.tempoMedioSegundos = qtd > 0 ? Math.round(stat.tempoTotalSegundos / qtd) : 0;
    return stat;
  });

  // 5. Mapeamento e métricas de cada entregador
  const mapaEntregadores = new Map();
  registrosFiltrados.forEach((reg) => {
    const nome = (reg.entregador_id || 'Não informado').trim();
    const chave = nome.toLowerCase();
    if (!mapaEntregadores.has(chave)) {
      mapaEntregadores.set(chave, {
        nome,
        placas: new Set(),
        unidadesVisitadas: new Set(),
        totalChegadas: 0,
        totalSaidas: 0,
        totalMovimentos: 0,
        entregasConcluidas: [],
        tempoTotalSegundos: 0,
        tempoMedioSegundos: 0,
        tempoMinSegundos: null,
        tempoMaxSegundos: null,
        noLocalAgora: false,
        unidadeAtual: null,
      });
    }
    const stat = mapaEntregadores.get(chave);
    stat.totalMovimentos++;
    if (reg.placa) stat.placas.add(reg.placa.toUpperCase());
    if (reg.unidade) stat.unidadesVisitadas.add(reg.unidade.trim());
    if (reg.tipo_evento === 'chegada') stat.totalChegadas++;
    if (reg.tipo_evento === 'saida') stat.totalSaidas++;
  });

  // Agrega entregas concluídas aos entregadores
  entregasConcluidas.forEach((entrega) => {
    const chave = (entrega.entregador || 'Não informado').trim().toLowerCase();
    const stat = mapaEntregadores.get(chave);
    if (stat) {
      stat.entregasConcluidas.push(entrega);
      stat.tempoTotalSegundos += entrega.duracaoSegundos;
      if (stat.tempoMinSegundos === null || entrega.duracaoSegundos < stat.tempoMinSegundos) {
        stat.tempoMinSegundos = entrega.duracaoSegundos;
      }
      if (stat.tempoMaxSegundos === null || entrega.duracaoSegundos > stat.tempoMaxSegundos) {
        stat.tempoMaxSegundos = entrega.duracaoSegundos;
      }
    }
  });

  // Marca entregadores no local agora
  noLocalAgora.forEach((item) => {
    const chave = (item.entregador || '').trim().toLowerCase();
    const stat = mapaEntregadores.get(chave);
    if (stat) {
      stat.noLocalAgora = true;
      stat.unidadeAtual = item.unidade;
    }
  });

  // Finaliza lista de estatísticas dos entregadores
  const listaEntregadoresStats = Array.from(mapaEntregadores.values()).map((stat) => {
    const qtd = stat.entregasConcluidas.length;
    stat.tempoMedioSegundos = qtd > 0 ? Math.round(stat.tempoTotalSegundos / qtd) : 0;
    stat.placasLista = Array.from(stat.placas);
    stat.unidadesLista = Array.from(stat.unidadesVisitadas);
    return stat;
  });

  // 6. KPIs e Resumo Geral
  const totalChegadasGeral = registrosFiltrados.filter((r) => r.tipo_evento === 'chegada').length;
  const totalSaidasGeral = registrosFiltrados.filter((r) => r.tipo_evento === 'saida').length;
  const totalEntregasConcluidas = entregasConcluidas.length;
  const tempoTotalGeral = entregasConcluidas.reduce((acc, cur) => acc + cur.duracaoSegundos, 0);
  const tempoMedioGeralSegundos = totalEntregasConcluidas > 0 ? Math.round(tempoTotalGeral / totalEntregasConcluidas) : 0;

  let tempoMinGeral = null;
  let tempoMaxGeral = null;
  entregasConcluidas.forEach((e) => {
    if (tempoMinGeral === null || e.duracaoSegundos < tempoMinGeral) tempoMinGeral = e.duracaoSegundos;
    if (tempoMaxGeral === null || e.duracaoSegundos > tempoMaxGeral) tempoMaxGeral = e.duracaoSegundos;
  });

  // Identifica unidade mais rápida e mais movimentada
  const unidadesComTempo = listaUnidadesStats.filter((u) => u.entregasConcluidas.length > 0);
  const unidadeMaisRapida = unidadesComTempo.length > 0
    ? [...unidadesComTempo].sort((a, b) => a.tempoMedioSegundos - b.tempoMedioSegundos)[0]
    : null;

  const unidadesComMovimento = listaUnidadesStats.filter((u) => u.totalMovimentos > 0);
  const unidadeMaisMovimentada = unidadesComMovimento.length > 0
    ? [...unidadesComMovimento].sort((a, b) => b.totalMovimentos - a.totalMovimentos)[0]
    : null;

  // Identifica entregador mais ágil e mais ativo
  const entregadoresComTempo = listaEntregadoresStats.filter((e) => e.entregasConcluidas.length > 0);
  const entregadorMaisRapido = entregadoresComTempo.length > 0
    ? [...entregadoresComTempo].sort((a, b) => a.tempoMedioSegundos - b.tempoMedioSegundos)[0]
    : null;

  const entregadoresComMovimento = listaEntregadoresStats.filter((e) => e.totalMovimentos > 0);
  const entregadorMaisAtivo = entregadoresComMovimento.length > 0
    ? [...entregadoresComMovimento].sort((a, b) => b.totalMovimentos - a.totalMovimentos)[0]
    : null;

  // Taxa de conclusão (% de chegadas que tiveram saída)
  const taxaConclusao = totalChegadasGeral > 0
    ? Math.min(100, Math.round((totalEntregasConcluidas / totalChegadasGeral) * 100))
    : 0;

  return {
    registrosFiltrados,
    entregasConcluidas: [...entregasConcluidas].reverse(), // Mais recentes primeiro
    noLocalAgora,
    listaUnidadesStats,
    listaEntregadoresStats: [...listaEntregadoresStats].sort((a, b) => {
      // Prioriza quem tem entregas concluídas, depois mais movimentos
      if (b.entregasConcluidas.length !== a.entregasConcluidas.length) {
        return b.entregasConcluidas.length - a.entregasConcluidas.length;
      }
      return b.totalMovimentos - a.totalMovimentos;
    }),
    totalChegadasGeral,
    totalSaidasGeral,
    totalMovimentos: registrosFiltrados.length,
    totalEntregasConcluidas,
    tempoMedioGeralSegundos,
    tempoMinGeral,
    tempoMaxGeral,
    unidadeMaisRapida,
    unidadeMaisMovimentada,
    entregadorMaisRapido,
    entregadorMaisAtivo,
    totalEntregadoresUnicos: listaEntregadoresStats.length,
    taxaConclusao,
  };
}

export function exportarCSVRegistros(registros) {
  if (!registros || registros.length === 0) return;

  const cabecalhos = ['ID', 'Entregador', 'Placa', 'Evento', 'Unidade', 'Data', 'Hora', 'Distância (m)', 'Precisão GPS (m)', 'Latitude', 'Longitude'];
  const linhas = registros.map((reg) => {
    const [dataParte = '', horaParte = ''] = (reg.data_hora || '').split(' ');
    const distancia = reg.distancia_metros != null ? Math.round(reg.distancia_metros) : '';
    const precisao = reg.precisao_metros != null ? Math.round(reg.precisao_metros) : '';
    const placa = reg.placa || '-';
    const entregador = `"${(reg.entregador_id || '').replace(/"/g, '""')}"`;
    const unidade = `"${(reg.unidade || '').replace(/"/g, '""')}"`;

    return [
      reg.id,
      entregador,
      placa,
      reg.tipo_evento,
      unidade,
      dataParte,
      horaParte,
      distancia,
      precisao,
      reg.latitude || '',
      reg.longitude || '',
    ].join(';');
  });

  const conteudoCSV = '\uFEFF' + [cabecalhos.join(';'), ...linhas].join('\r\n');
  const blob = new Blob([conteudoCSV], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dataHoje = new Date().toISOString().slice(0, 10);
  link.setAttribute('href', url);
  link.setAttribute('download', `registros-controle-entregas-${dataHoje}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
