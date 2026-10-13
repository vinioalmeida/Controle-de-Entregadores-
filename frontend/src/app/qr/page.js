'use client';

import Link from 'next/link';
import { QrCode } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { apiUrl } from '../api';
import AppHeader from '../components/AppHeader';
import DropdownField from '../components/DropdownField';

function QrContent() {
  const parametros = useSearchParams();
  const unidadeId = parametros.get('unidade_id');
  const [token, setToken] = useState('');
  const [nomeUnidade, setNomeUnidade] = useState('');
  const [endereco, setEndereco] = useState('');
  const [unidades, setUnidades] = useState([]);
  const [unidadeSelecionadaId, setUnidadeSelecionadaId] = useState(unidadeId || '');
  const [carregando, setCarregando] = useState(Boolean(unidadeId));
  const [erro, setErro] = useState('');

  useEffect(() => {
    const senhaAdmin = window.sessionStorage.getItem('adminPassword') || '';

    async function carregarUnidadesEQr() {
      try {
        if (!senhaAdmin) throw new Error('Entre no painel admin para escolher uma unidade e visualizar o QR.');

        const authResponse = await fetch(apiUrl('/admin/autenticar'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ senha: senhaAdmin }),
        });
        if (!authResponse.ok) throw new Error('Sua sessão admin expirou. Entre novamente para selecionar unidades.');

        const unidadesResponse = await fetch(apiUrl('/admin/unidades'), {
          headers: { 'X-Admin-Password': senhaAdmin },
        });
        const lista = await unidadesResponse.json();
        if (!unidadesResponse.ok) throw new Error(lista.erro || 'Não foi possível listar as unidades.');
        const ativas = lista.filter((unidade) => unidade.ativa);
        setUnidades(ativas);

        const selecionada = ativas.find((unidade) => String(unidade.id) === unidadeId) || ativas[0];
        if (!selecionada) throw new Error('Nenhuma unidade ativa cadastrada no painel admin.');

        setUnidadeSelecionadaId(String(selecionada.id));
        const qrResponse = await fetch(apiUrl(`/admin/unidades/${selecionada.id}/qr`), {
          headers: { 'X-Admin-Password': senhaAdmin },
        });
        const qr = await qrResponse.json();
        if (!qrResponse.ok) throw new Error(qr.erro || 'Não foi possível carregar o QR da unidade.');
        setToken(qr.qr_token);
        setNomeUnidade(qr.nome);
        setEndereco(qr.endereco);
      } catch (error) {
        setErro(error.message || 'Falha ao carregar o QR da unidade.');
      } finally {
        setCarregando(false);
      }
    }

    carregarUnidadesEQr();
  }, [unidadeId]);

  const selecionarUnidade = async (id) => {
    setUnidadeSelecionadaId(id);
    setCarregando(true);
    setErro('');
    try {
      const response = await fetch(apiUrl(`/admin/unidades/${encodeURIComponent(id)}/qr`), {
        headers: { 'X-Admin-Password': window.sessionStorage.getItem('adminPassword') || '' },
      });
      const resultado = await response.json();
      if (!response.ok) throw new Error(resultado.erro || 'Não foi possível carregar o QR da unidade.');
      setToken(resultado.qr_token);
      setNomeUnidade(resultado.nome);
      setEndereco(resultado.endereco);
    } catch (error) {
      setErro(error.message || 'Falha ao carregar o QR da unidade.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="app-shell">
      <AppHeader active="qr" />
      <main className="qr-page-wrap">
        <section className="qr-panel">
          <p className="page-eyebrow print-hidden">Identificação fixa</p>
          <h1 className="page-title">QR Code da unidade</h1>
          <p className="panel-title mt-3">{nomeUnidade}</p>
          {endereco && <p className="page-description mx-auto">{endereco}</p>}
          {unidades.length > 0 && (
            <div className="qr-unit-select print-hidden">
              <DropdownField
                id="qr-unidade"
                label="Selecionar unidade"
                value={unidadeSelecionadaId}
                onChange={selecionarUnidade}
                disabled={carregando}
                options={unidades.map((unidade) => ({ value: String(unidade.id), label: unidade.nome }))}
              />
            </div>
          )}

          {carregando ? (
            <p className="status-message mt-5" role="status">Carregando QR Code...</p>
          ) : erro ? (
            <p role="alert" className="status-message mt-5" data-status="error">{erro}</p>
          ) : token ? (
            <>
              <div className="qr-code-frame">
                <QRCodeSVG value={token} size={280} level="H" includeMargin aria-label={`QR Code de ${nomeUnidade}`} />
              </div>
              <div className="print-hidden grid gap-3">
                <button type="button" onClick={() => window.print()} className="button-primary w-full">
                  <QrCode size={18} aria-hidden="true" />
                  Imprimir QR Code
                </button>
                <p className="text-xs text-gray-500">Este código é fixo. Mantenha-o visível na unidade para leitura pelos entregadores.</p>
              </div>
            </>
          ) : (
            <p className="status-message mt-5" data-status="warning">
              Nenhuma unidade ativa cadastrada no painel admin.
            </p>
          )}

          <Link href="/admin" className="button-secondary print-hidden mt-5 w-full">
            Voltar ao painel admin
          </Link>
        </section>
      </main>
    </div>
  );
}

export default function QrPage() {
  return (
    <Suspense fallback={<main className="min-h-screen flex items-center justify-center">Carregando QR Code...</main>}>
      <QrContent />
    </Suspense>
  );
}