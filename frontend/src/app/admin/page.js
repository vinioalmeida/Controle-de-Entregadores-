'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  BarChart3, 
  Building2, 
  CircleAlert, 
  ClipboardList, 
  LogOut, 
  ShieldCheck, 
  Truck, 
  Users 
} from 'lucide-react';
import { apiUrl } from '../api';
import AppHeader from '../components/AppHeader';
import DashboardIndicadores from '../components/DashboardIndicadores';
import TabelaRegistros from '../components/TabelaRegistros';
import GestaoEntregadores from '../components/GestaoEntregadores';
import GestaoUnidades, { DEMO_UNIDADES } from '../components/GestaoUnidades';

export default function AdminPage() {
  const [autenticado, setAutenticado] = useState(false);
  const [senhaInput, setSenhaInput] = useState('');
  const [erroSenha, setErroSenha] = useState(false);
  const [entrando, setEntrando] = useState(false);

  // Aba ativa: 'indicadores' | 'registros' | 'entregadores' | 'unidades'
  const [abaAtiva, setAbaAtiva] = useState('indicadores');

  const [registros, setRegistros] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [entregadores, setEntregadores] = useState([]);
  const [carregando, setCarregando] = useState(true);

  // Estados para cadastro/edição de unidades
  const [nomeUnidade, setNomeUnidade] = useState('');
  const [enderecoUnidade, setEnderecoUnidade] = useState('');
  const [unidadeEditandoId, setUnidadeEditandoId] = useState(null);
  const [salvandoUnidade, setSalvandoUnidade] = useState(false);
  const [statusUnidade, setStatusUnidade] = useState('');

  // Estados para cadastro/edição de entregadores
  const [nomeEntregador, setNomeEntregador] = useState('');
  const [placaEntregador, setPlacaEntregador] = useState('');
  const [telefoneEntregador, setTelefoneEntregador] = useState('');
  const [entregadorEditandoId, setEntregadorEditandoId] = useState(null);
  const [salvandoEntregador, setSalvandoEntregador] = useState(false);
  const [statusEntregador, setStatusEntregador] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setEntrando(true);
    try {
      const response = await fetch(apiUrl('/admin/autenticar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha: senhaInput }),
      });
      if (!response.ok) throw new Error('Senha incorreta.');
      window.sessionStorage.setItem('adminPassword', senhaInput);
      setAutenticado(true);
      setErroSenha(false);
    } catch {
      setErroSenha(true);
      setSenhaInput('');
    } finally {
      setEntrando(false);
    }
  };

  useEffect(() => {
    if (!autenticado) {
      const senhaSalva = window.sessionStorage.getItem('adminPassword');
      if (!senhaSalva) return;
      fetch(apiUrl('/admin/autenticar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha: senhaSalva }),
      }).then((response) => {
        if (response.ok) setAutenticado(true);
        else window.sessionStorage.removeItem('adminPassword');
      }).catch(() => window.sessionStorage.removeItem('adminPassword'));
      return;
    }

    async function carregarDados() {
      setCarregando(true);
      try {
        const senha = window.sessionStorage.getItem('adminPassword') || '';
        const [responseRegistros, responseUnidades, responseEntregadores] = await Promise.all([
          fetch(apiUrl('/registros')),
          fetch(apiUrl('/admin/unidades'), {
            headers: { 'X-Admin-Password': senha },
          }),
          fetch(apiUrl('/admin/entregadores'), {
            headers: { 'X-Admin-Password': senha },
          }),
        ]);

        if (!responseUnidades.ok) throw new Error('Não foi possível carregar as unidades. Entre novamente.');
        const [dadosRegistros, dadosUnidades, dadosEntregadores] = await Promise.all([
          responseRegistros.json(),
          responseUnidades.json(),
          responseEntregadores.ok ? responseEntregadores.json() : [],
        ]);
        setRegistros(dadosRegistros || []);
        setUnidades(dadosUnidades || []);
        setEntregadores(dadosEntregadores || []);
      } catch (error) {
        console.error('Erro ao buscar dados do painel:', error);
        setStatusUnidade(error.message);
      } finally {
        setCarregando(false);
      }
    }
    carregarDados();
  }, [autenticado]);

  // Funções de Unidades
  const cadastrarUnidade = async (e) => {
    e.preventDefault();
    const editando = unidadeEditandoId !== null;
    setSalvandoUnidade(true);
    setStatusUnidade(`Localizando o endereço e ${editando ? 'atualizando' : 'cadastrando'} a unidade...`);
    try {
      const response = await fetch(apiUrl(editando ? `/admin/unidades/${unidadeEditandoId}` : '/admin/unidades'), {
        method: editando ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': window.sessionStorage.getItem('adminPassword') || '',
        },
        body: JSON.stringify({
          nome: nomeUnidade,
          endereco: enderecoUnidade,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.erro || `Não foi possível ${editando ? 'atualizar' : 'cadastrar'} a unidade.`);
      setUnidades((anteriores) => {
        const atualizadas = editando
          ? anteriores.map((unidade) => (unidade.id === result.id ? result : unidade))
          : [...anteriores, result];
        return atualizadas.sort((a, b) => a.nome.localeCompare(b.nome));
      });
      setStatusUnidade(`Unidade ${editando ? 'atualizada' : 'cadastrada'}. Local encontrado: ${result.endereco_encontrado}`);
      setNomeUnidade('');
      setEnderecoUnidade('');
      setUnidadeEditandoId(null);
    } catch (error) {
      setStatusUnidade(error.message || 'Falha de conexão ao cadastrar unidade.');
    } finally {
      setSalvandoUnidade(false);
    }
  };

  const iniciarEdicaoUnidade = (unidade) => {
    setUnidadeEditandoId(unidade.id);
    setNomeUnidade(unidade.nome);
    setEnderecoUnidade(unidade.endereco);
    setStatusUnidade(`Editando unidade "${unidade.nome}".`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelarEdicaoUnidade = () => {
    setUnidadeEditandoId(null);
    setNomeUnidade('');
    setEnderecoUnidade('');
    setStatusUnidade('');
  };

  const alternarStatusUnidade = async (unidade) => {
    const desativando = unidade.ativa;
    if (desativando && !window.confirm(`Desativar a unidade "${unidade.nome}"? O QR deixará de funcionar, mas os registros históricos serão mantidos.`)) {
      return;
    }

    try {
      const response = await fetch(
        apiUrl(desativando ? `/admin/unidades/${unidade.id}` : `/admin/unidades/${unidade.id}/ativar`),
        {
          method: desativando ? 'DELETE' : 'POST',
          headers: { 'X-Admin-Password': window.sessionStorage.getItem('adminPassword') || '' },
        }
      );
      const resultado = await response.json();
      if (!response.ok) throw new Error(resultado.erro || 'Não foi possível alterar a unidade.');
      setUnidades((anteriores) =>
        anteriores.map((item) => (item.id === unidade.id ? { ...item, ativa: !desativando } : item))
      );
      setStatusUnidade(desativando ? 'Unidade desativada; registros históricos mantidos.' : 'Unidade reativada.');
    } catch (error) {
      setStatusUnidade(error.message || 'Falha de conexão ao alterar a unidade.');
    }
  };

  // Funções de Entregadores
  const cadastrarEntregador = async (e) => {
    e.preventDefault();
    const editando = entregadorEditandoId !== null;
    setSalvandoEntregador(true);
    setStatusEntregador(`${editando ? 'Atualizando' : 'Cadastrando'} entregador...`);
    try {
      const response = await fetch(apiUrl(editando ? `/admin/entregadores/${entregadorEditandoId}` : '/admin/entregadores'), {
        method: editando ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': window.sessionStorage.getItem('adminPassword') || '',
        },
        body: JSON.stringify({
          nome: nomeEntregador,
          placa_padrao: placaEntregador,
          telefone: telefoneEntregador,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.erro || `Não foi possível ${editando ? 'atualizar' : 'cadastrar'} o entregador.`);
      setEntregadores((anteriores) => {
        const atualizados = editando
          ? anteriores.map((item) => (item.id === result.id ? result : item))
          : [...anteriores, result];
        return atualizados.sort((a, b) => a.nome.localeCompare(b.nome));
      });
      setStatusEntregador(`Entregador "${result.nome}" ${editando ? 'atualizado' : 'cadastrado'} com sucesso.`);
      setNomeEntregador('');
      setPlacaEntregador('');
      setTelefoneEntregador('');
      setEntregadorEditandoId(null);
    } catch (error) {
      setStatusEntregador(error.message || 'Falha de conexão ao salvar entregador.');
    } finally {
      setSalvandoEntregador(false);
    }
  };

  const iniciarEdicaoEntregador = (entregador) => {
    setEntregadorEditandoId(entregador.id);
    setNomeEntregador(entregador.nome);
    setPlacaEntregador(entregador.placa_padrao || '');
    setTelefoneEntregador(entregador.telefone || '');
    setStatusEntregador(`Editando entregador "${entregador.nome}".`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelarEdicaoEntregador = () => {
    setEntregadorEditandoId(null);
    setNomeEntregador('');
    setPlacaEntregador('');
    setTelefoneEntregador('');
    setStatusEntregador('');
  };

  const alternarStatusEntregador = async (entregador) => {
    const desativando = entregador.ativo;
    if (desativando && !window.confirm(`Desativar o entregador "${entregador.nome}"?`)) {
      return;
    }

    try {
      const response = await fetch(
        apiUrl(desativando ? `/admin/entregadores/${entregador.id}` : `/admin/entregadores/${entregador.id}/ativar`),
        {
          method: desativando ? 'DELETE' : 'POST',
          headers: { 'X-Admin-Password': window.sessionStorage.getItem('adminPassword') || '' },
        }
      );
      const resultado = await response.json();
      if (!response.ok) throw new Error(resultado.erro || 'Não foi possível alterar o status do entregador.');
      setEntregadores((anteriores) =>
        anteriores.map((item) => (item.id === entregador.id ? { ...item, ativo: !desativando } : item))
      );
      setStatusEntregador(desativando ? 'Entregador desativado.' : 'Entregador reativado.');
    } catch (error) {
      setStatusEntregador(error.message || 'Falha de conexão ao alterar entregador.');
    }
  };

  const encerrarSessao = () => {
    window.sessionStorage.removeItem('adminPassword');
    setAutenticado(false);
    setSenhaInput('');
    setErroSenha(false);
    setCarregando(true);
  };

  // ========== TELA DE LOGIN ==========
  if (!autenticado) {
    return (
      <div className="app-shell">
        <AppHeader active="admin" />
        <main className="auth-shell">
          <section className="auth-panel">
            <div className="panel-heading">
              <span className="admin-stat-icon mb-4">
                <ShieldCheck size={20} aria-hidden="true" />
              </span>
              <p className="page-eyebrow">Área protegida</p>
              <h1 className="panel-title">Acesso do gestor</h1>
              <p className="panel-description">
                Entre com a senha de administrador para acessar os indicadores, registros, entregadores e gestão de unidades.
              </p>
            </div>
            <form onSubmit={handleLogin} className="form-stack">
              <div>
                <label className="field-label" htmlFor="senha-gestor">
                  Senha do gestor
                </label>
                <input
                  id="senha-gestor"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={senhaInput}
                  onChange={(e) => setSenhaInput(e.target.value)}
                  className="field-control"
                  placeholder="Digite a senha..."
                />
              </div>

              {erroSenha && (
                <div className="status-message" data-status="error" role="alert">
                  <CircleAlert size={17} />
                  Senha incorreta.
                </div>
              )}

              <button type="submit" disabled={entrando} className="button-primary w-full">
                {entrando ? 'Verificando...' : 'Entrar no painel'}
              </button>
            </form>
          </section>
        </main>
      </div>
    );
  }

  // ========== TELA DO PAINEL ADMIN ==========
  return (
    <div className="app-shell">
      <AppHeader active="admin" />
      <main className="content-wrap">
        {/* CABEÇALHO DO PAINEL */}
        <div className="page-heading">
          <div>
            <p className="page-eyebrow">Gestão Operacional</p>
            <h1 className="page-title">Painel do Administrador</h1>
            <p className="page-description">
              Acompanhe indicadores de entrega, tempo por unidade e entregador, consulte registros e gerencie sua operação.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/" className="button-secondary">
              <Truck size={16} aria-hidden="true" />
              <span>Registro de Pátio</span>
            </Link>
            <button type="button" onClick={encerrarSessao} className="button-quiet">
              <LogOut size={16} aria-hidden="true" />
              <span>Sair</span>
            </button>
          </div>
        </div>

        {/* NAVEGAÇÃO POR ABAS */}
        <nav className="admin-nav-tabs" aria-label="Abas do painel admin">
          <button
            type="button"
            className="admin-tab-button"
            data-active={abaAtiva === 'indicadores'}
            onClick={() => setAbaAtiva('indicadores')}
          >
            <BarChart3 size={18} aria-hidden="true" />
            <span>Indicadores e Gráficos</span>
          </button>

          <button
            type="button"
            className="admin-tab-button"
            data-active={abaAtiva === 'registros'}
            onClick={() => setAbaAtiva('registros')}
          >
            <ClipboardList size={18} aria-hidden="true" />
            <span>Registros e Movimentação</span>
            <span className="tab-badge">{registros.length}</span>
          </button>

          <button
            type="button"
            className="admin-tab-button"
            data-active={abaAtiva === 'entregadores'}
            onClick={() => setAbaAtiva('entregadores')}
          >
            <Truck size={18} aria-hidden="true" />
            <span>Entregadores</span>
            <span className="tab-badge">{entregadores.length}</span>
          </button>

          <button
            type="button"
            className="admin-tab-button"
            data-active={abaAtiva === 'unidades'}
            onClick={() => setAbaAtiva('unidades')}
          >
            <Building2 size={18} aria-hidden="true" />
            <span>Gestão de Unidades</span>
            <span className="tab-badge">
              {unidades.length || (carregando ? 0 : DEMO_UNIDADES.length)}
            </span>
          </button>
        </nav>

        {/* CONTEÚDO DA ABA ATIVA */}
        {abaAtiva === 'indicadores' && (
          <DashboardIndicadores
            registros={registros}
            unidades={unidades}
            carregando={carregando}
            onIrParaRegistros={() => setAbaAtiva('registros')}
            onIrParaUnidades={() => setAbaAtiva('unidades')}
          />
        )}

        {abaAtiva === 'registros' && (
          <TabelaRegistros
            registros={registros}
            unidades={unidades}
            carregando={carregando}
          />
        )}

        {abaAtiva === 'entregadores' && (
          <GestaoEntregadores
            entregadores={entregadores}
            nomeEntregador={nomeEntregador}
            setNomeEntregador={setNomeEntregador}
            placaEntregador={placaEntregador}
            setPlacaEntregador={setPlacaEntregador}
            telefoneEntregador={telefoneEntregador}
            setTelefoneEntregador={setTelefoneEntregador}
            entregadorEditandoId={entregadorEditandoId}
            salvandoEntregador={salvandoEntregador}
            statusEntregador={statusEntregador}
            cadastrarEntregador={cadastrarEntregador}
            iniciarEdicaoEntregador={iniciarEdicaoEntregador}
            cancelarEdicaoEntregador={cancelarEdicaoEntregador}
            alternarStatusEntregador={alternarStatusEntregador}
          />
        )}

        {abaAtiva === 'unidades' && (
          <GestaoUnidades
            unidades={unidades}
            carregando={carregando}
            nomeUnidade={nomeUnidade}
            setNomeUnidade={setNomeUnidade}
            enderecoUnidade={enderecoUnidade}
            setEnderecoUnidade={setEnderecoUnidade}
            unidadeEditandoId={unidadeEditandoId}
            salvandoUnidade={salvandoUnidade}
            statusUnidade={statusUnidade}
            cadastrarUnidade={cadastrarUnidade}
            iniciarEdicaoUnidade={iniciarEdicaoUnidade}
            cancelarEdicaoUnidade={cancelarEdicaoUnidade}
            alternarStatusUnidade={alternarStatusUnidade}
          />
        )}
      </main>
    </div>
  );
}
