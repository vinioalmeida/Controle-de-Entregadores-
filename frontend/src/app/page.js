'use client';

import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, CircleAlert, LoaderCircle, MapPin, ScanLine, X } from 'lucide-react';
import { apiUrl } from './api';
import AppHeader from './components/AppHeader';

function obterLocalizacao() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Este navegador não oferece acesso à localização.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({
        latitude: coords.latitude,
        longitude: coords.longitude,
        precisao_metros: coords.accuracy,
      }),
      (error) => {
        const mensagens = {
          1: 'Permita o acesso à localização para registrar o evento.',
          2: 'Não foi possível obter sua localização. Verifique o GPS e tente novamente.',
          3: 'A localização demorou demais. Tente novamente em uma área aberta.',
        };
        reject(new Error(mensagens[error.code] || 'Falha ao obter a localização.'));
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}

export default function Home() {
  const [entregadorId, setEntregadorId] = useState('');
  const [placa, setPlaca] = useState('');
  const [qrToken, setQrToken] = useState('');
  const [scannerAtivo, setScannerAtivo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [status, setStatus] = useState('');
  const [statusTipo, setStatusTipo] = useState('');
  const [entregadoresCadastrados, setEntregadoresCadastrados] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [carregandoRegistros, setCarregandoRegistros] = useState(true);

  const atualizarRegistros = useCallback(async () => {
    const response = await fetch(apiUrl('/registros'));
    if (!response.ok) throw new Error('Não foi possível consultar o status das entregas.');
    setRegistros(await response.json());
  }, []);

  // Carrega os entregadores ativos para seleção no registro.
  useEffect(() => {
    fetch(apiUrl('/entregadores'))
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setEntregadoresCadastrados(data || []))
      .catch(() => {});
    atualizarRegistros()
      .catch(() => {
        setStatus('Não foi possível consultar o status das entregas. Atualize a página e tente novamente.');
        setStatusTipo('error');
      })
      .finally(() => setCarregandoRegistros(false));
  }, [atualizarRegistros]);

  const ultimoEvento = registros
    .filter((registro) => registro.entregador_id?.trim().toLocaleLowerCase() === entregadorId.trim().toLocaleLowerCase())
    .sort((a, b) => (b.data_hora || '').localeCompare(a.data_hora || '') || (b.id || 0) - (a.id || 0))[0];
  const tipoEvento = ultimoEvento?.tipo_evento === 'chegada' ? 'saida' : 'chegada';

  const handleEntregadorChange = (valor) => {
    setEntregadorId(valor);
    const encontrado = entregadoresCadastrados.find((e) => e.nome === valor);
    if (encontrado?.placa_padrao) {
      setPlaca(encontrado.placa_padrao);
    }
  };

  useEffect(() => {
    if (!scannerAtivo) return undefined;

    let scanner;
    let desmontando = false;

    async function iniciarLeitor() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (desmontando) return;
        scanner = new Html5Qrcode('leitor-qr');
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (texto) => {
            setQrToken(texto.trim());
            setScannerAtivo(false);
            setStatus('QR lido. A localização será verificada ao registrar.');
          },
          () => {},
        );
      } catch {
        if (!desmontando) {
          setScannerAtivo(false);
          setStatus('Não foi possível abrir a câmera. Verifique a permissão e use HTTPS ou localhost.');
          setStatusTipo('error');
        }
      }
    }

    iniciarLeitor();
    return () => {
      desmontando = true;
      if (scanner?.isScanning) {
        scanner.stop().then(() => scanner.clear()).catch(() => {});
      } else {
        try {
          scanner?.clear();
        } catch {}
      }
    };
  }, [scannerAtivo]);

  const handleEnviar = async (e) => {
    e.preventDefault();
    
    if (carregandoRegistros || !entregadoresCadastrados.some((ent) => ent.nome === entregadorId) || !qrToken.trim()) {
      setStatus('Selecione um entregador cadastrado e leia o QR Code da unidade.');
      setStatusTipo('error');
      return;
    }
    if (!/^[A-Z0-9]{7}$/.test(placa.trim().toUpperCase())) {
      setStatus('Informe uma placa válida com 7 letras e números.');
      setStatusTipo('error');
      return;
    }

    setEnviando(true);
    setStatus('Obtendo localização precisa...');
    setStatusTipo('');

    try {
      const localizacao = await obterLocalizacao();
      setStatus('Validando QR e proximidade da unidade...');
      const response = await fetch(apiUrl('/registrar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entregador_id: entregadorId,
          placa: placa.trim().toUpperCase(),
          tipo_evento: tipoEvento,
          qr_token: qrToken.trim(),
          ...localizacao,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setStatus(`Sucesso: ${result.mensagem}`);
        setStatusTipo('success');
        setQrToken('');
        await atualizarRegistros();
      } else {
        setStatus(`Erro: ${result.erro}`);
        setStatusTipo('error');
        if (response.status === 409) {
          await atualizarRegistros().catch(() => {});
        }
      }
    } catch (error) {
      setStatus(error.message || 'Erro de conexão com o servidor.');
      setStatusTipo('error');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="app-shell">
      <AppHeader active="registro" />
      <main className="content-wrap">
        <div className="page-heading">
          <div>
            <p className="page-eyebrow">Registro operacional</p>
            <h1 className="page-title">Movimentação no pátio</h1>
            <p className="page-description">Identifique o veículo e confirme sua chegada ou saída na unidade.</p>
          </div>
        </div>

        <section className="worker-layout">
          <aside className="worker-aside">
            <span className="aside-kicker">Instruções de uso</span>
            <h2 className="aside-title">Registro rápido em 3 passos</h2>
            <p className="aside-copy">Faça o check-in na chegada para iniciar a contagem e registre a saída ao concluir.</p>

            <ol className="workflow-list">
              <li className="workflow-item">
                <span className="workflow-index">01</span>
                <span>Selecione seu cadastro e informe a placa do veículo.</span>
              </li>
              <li className="workflow-item">
                <span className="workflow-index">02</span>
                <span>Use a ação disponível: chegada ou saída, conforme seu registro atual.</span>
              </li>
              <li className="workflow-item">
                <span className="workflow-index">03</span>
                <span>Escaneie o QR Code fixado na unidade e confirme.</span>
              </li>
            </ol>
          </aside>

          <section className="form-panel surface">
            <div className="panel-heading">
              <h2 className="panel-title">Identificação do veículo</h2>
              <p className="panel-description">Preencha os campos abaixo e escaneie o código da filial.</p>
            </div>

            <form onSubmit={handleEnviar} className="form-stack">
              <div className="form-grid-two">
                <div>
                  <label className="field-label" htmlFor="entregador-id">Entregador</label>
                  <select
                    id="entregador-id"
                    required
                    className="field-control"
                    value={entregadorId}
                    onChange={(e) => handleEntregadorChange(e.target.value)}
                  >
                    <option value="" disabled>Selecione um entregador cadastrado</option>
                    {entregadoresCadastrados.map((ent) => (
                      <option key={ent.id} value={ent.nome}>
                        {ent.nome}
                      </option>
                    ))}
                  </select>
                  {entregadoresCadastrados.length === 0 && (
                    <p className="field-hint">Nenhum entregador ativo cadastrado. Cadastre um no painel administrativo.</p>
                  )}
                </div>
                <div>
                  <label className="field-label" htmlFor="placa-veiculo">Placa do veículo</label>
                  <input
                    id="placa-veiculo"
                    type="text"
                    required
                    minLength={7}
                    maxLength={7}
                    pattern="[A-Za-z0-9]{7}"
                    title="Informe os 7 caracteres da placa, sem espaços ou hífen."
                    autoCapitalize="characters"
                    autoComplete="off"
                    value={placa}
                    onChange={(e) => setPlaca(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 7).toUpperCase())}
                    className="field-control font-mono"
                    placeholder="ABC1D23"
                  />
                </div>
              </div>

              {entregadorId && (
                <p className="field-hint" role="status">
                  {carregandoRegistros
                    ? 'Consultando sua entrega em aberto...'
                    : tipoEvento === 'saida'
                      ? 'Você tem uma entrega em aberto. O próximo registro será a saída.'
                      : 'Você não tem entrega em aberto. O próximo registro será a chegada.'}
                </p>
              )}

              <div>
                <label className="field-label">QR Code da unidade</label>
                <div className="qr-control-row">
                  <button
                    type="button"
                    onClick={() => { setStatus(''); setStatusTipo(''); setScannerAtivo(true); }}
                    disabled={scannerAtivo || enviando}
                    className="button-secondary"
                  >
                    <ScanLine size={18} aria-hidden="true" />
                    {scannerAtivo ? 'Abrindo câmera...' : 'Ler QR Code'}
                  </button>
                  {scannerAtivo && (
                    <button
                      type="button"
                      onClick={() => setScannerAtivo(false)}
                      className="button-quiet"
                      aria-label="Fechar leitor de QR"
                      title="Fechar leitor"
                    >
                      <X size={19} aria-hidden="true" />
                    </button>
                  )}
                </div>
                {scannerAtivo && <div id="leitor-qr" className="scanner-frame mt-3" />}
                {qrToken && <p className="scan-success mt-3"><BadgeCheck size={16} aria-hidden="true" /> QR Code lido e pronto para validação.</p>}
              </div>

              <button type="submit" disabled={enviando || scannerAtivo || carregandoRegistros || entregadoresCadastrados.length === 0 || !entregadorId} className="button-primary w-full">
                {enviando ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <MapPin size={18} aria-hidden="true" />}
                {enviando ? 'Validando localização...' : tipoEvento === 'saida' ? 'Registrar saída' : 'Registrar chegada'}
              </button>
            </form>

            {status && (
              <div className="status-message mt-4" data-status={statusTipo} role={statusTipo === 'error' ? 'alert' : 'status'}>
                {statusTipo === 'success' ? <BadgeCheck size={18} aria-hidden="true" /> : statusTipo === 'error' ? <CircleAlert size={18} aria-hidden="true" /> : <MapPin size={18} aria-hidden="true" />}
                <span>{status}</span>
              </div>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}
