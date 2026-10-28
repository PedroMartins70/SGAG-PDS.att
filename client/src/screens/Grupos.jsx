import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Crown,
  Lock,
  LogOut,
  Mail,
  Pencil,
  Plus,
  Shield,
  Trash2,
  User,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import Avatar from '../components/ui/Avatar.jsx';
import Modal from '../components/ui/Modal.jsx';
import Input from '../components/ui/Input.jsx';
import ThemeToggle from '../components/ui/ThemeToggle.jsx';
import { api } from '../services/api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import ContasSenhas from '../components/ContasSenhas.jsx';

/** Limites de negócio. */
const LIMITE_GRUPOS = 5;
const LIMITE_INTEGRANTES = 7;

/**
 * Página de cadastro de grupos (visão do Professor).
 * Permite criar até 5 grupos por turma, adicionar até 7 integrantes por grupo
 * e designar Líder e Vice-Líder. Também tem o botão "Contas e senhas", para o
 * professor gerar uma senha temporária para quem esqueceu a senha.
 * Intuitivo, seguindo a identidade Soft Dashboard.
 *
 * @returns {JSX.Element} Página de cadastro de grupos.
 */
export default function Grupos() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const token = session?.token;

  const [turmas, setTurmas] = useState([]);
  const [gruposPorTurma, setGruposPorTurma] = useState({});
  const [perfis, setPerfis] = useState([]);
  const [turmaAtiva, setTurmaAtiva] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ nome: '', integrante: '', perfilId: '' });
  const [formPerfil, setFormPerfil] = useState({ email: '', nome: '', senha: '', role: 'lider' });

  /**
   * Carrega turmas, perfis (líderes/vices) e os grupos de cada turma.
   */
  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const [{ turmas }, { perfis }] = await Promise.all([
        api('/turmas', { token }),
        api('/profiles', { token }),
      ]);
      setTurmas(turmas);
      setPerfis(perfis);
      if (turmas.length > 0) setTurmaAtiva((atual) => atual || turmas[0].id);

      const mapa = {};
      for (const turma of turmas) {
        const { grupos } = await api(`/turmas/${turma.id}/grupos`, { token });
        mapa[turma.id] = grupos;
      }
      setGruposPorTurma(mapa);
    } catch (e) {
      setErro(e.message || 'Falha ao carregar os grupos.');
    } finally {
      setCarregando(false);
    }
  }, [token]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /**
   * Recarrega os grupos de uma turma após uma mutação.
   *
   * @param {string} turmaId UUID da turma.
   */
  async function recarregar(turmaId) {
    const { grupos } = await api(`/turmas/${turmaId}/grupos`, { token });
    setGruposPorTurma((prev) => ({ ...prev, [turmaId]: grupos }));
  }

  const lideres = useMemo(() => perfis.filter((p) => p.role === 'lider'), [perfis]);
  const vices = useMemo(() => perfis.filter((p) => p.role === 'vice_lider'), [perfis]);

  const gruposAtuais = gruposPorTurma[turmaAtiva] ?? [];
  const podeCriarGrupo = gruposAtuais.length < LIMITE_GRUPOS;

  /** Abre um modal de ação e reinicia o formulário. */
  function abrirModal(tipo, contexto = {}) {
    setForm({ nome: contexto.nome ?? '', integrante: '', perfilId: '' });
    setModal({ tipo, ...contexto });
  }

  /** Abre o modal de cadastro de Líder/Vice-Líder. */
  function abrirPerfilModal() {
    setFormPerfil({ email: '', nome: '', senha: '', role: 'lider' });
    setModal({ tipo: 'perfil' });
  }

  /**
   * Cadastra um Líder ou Vice-Líder (gmail, nome, senha) pelo Professor.
   */
  async function cadastrarPerfil() {
    await api('/profiles', {
      method: 'POST',
      body: {
        email: formPerfil.email,
        nome: formPerfil.nome,
        senha: formPerfil.senha,
        role: formPerfil.role,
      },
      token,
    });
    setModal(null);
    const { perfis } = await api('/profiles', { token });
    setPerfis(perfis);
  }

  function sair() {
    logout();
    navigate('/login');
  }

  async function renomearGrupo() {
    await api(`/grupos/${modal.grupoId}`, { method: 'PUT', body: { nome: form.nome }, token });
    const turmaId = modal.turmaId;
    setModal(null);
    await recarregar(turmaId);
  }

  async function excluirGrupo() {
    await api(`/grupos/${modal.grupoId}`, { method: 'DELETE', token });
    const turmaId = modal.turmaId;
    setModal(null);
    await recarregar(turmaId);
  }

  async function adicionarIntegrante() {
    await api(`/grupos/${modal.grupoId}/integrantes`, {
      method: 'POST',
      body: { nome_aluno: form.integrante },
      token,
    });
    const turmaId = modal.turmaId;
    setModal(null);
    await recarregar(turmaId);
  }

  async function removerIntegrante(grupoId, turmaId, integranteId) {
    await api(`/grupos/${grupoId}/integrantes/${integranteId}`, { method: 'DELETE', token });
    await recarregar(turmaId);
  }

  async function designarLider() {
    await api(`/grupos/${modal.grupoId}/lider`, { method: 'PUT', body: { perfil_id: form.perfilId }, token });
    const turmaId = modal.turmaId;
    setModal(null);
    await recarregar(turmaId);
  }

  async function designarVice() {
    await api(`/grupos/${modal.grupoId}/vice-lider`, {
      method: 'PUT',
      body: { perfil_id: form.perfilId },
      token,
    });
    const turmaId = modal.turmaId;
    setModal(null);
    await recarregar(turmaId);
  }

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="text-text-muted">Carregando grupos...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <div className="leading-tight">
              <h1 className="font-display text-lg font-bold text-text">Cadastro de Grupos</h1>
              <p className="text-xs text-text-muted">Até 5 grupos por turma e 7 integrantes por grupo.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={sair}>
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {erro && (
          <div className="mb-4 rounded-lg border border-danger-soft bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
            {erro}
          </div>
        )}

        {/* Seletor de turmas */}
        <div className="mb-5 flex flex-wrap gap-2">
          {turmas.map((turma) => {
            const ativa = turma.id === turmaAtiva;
            return (
              <button
                key={turma.id}
                onClick={() => setTurmaAtiva(turma.id)}
                className={`rounded-xl px-4 py-2 font-semibold transition-colors ${
                  ativa
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'border border-border bg-surface text-text-muted hover:bg-surface-muted'
                }`}
              >
                Turma {turma.nome}
              </button>
            );
          })}
        </div>

        {/* Cabeçalho da turma ativa */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-text">
              Turma {turmas.find((t) => t.id === turmaAtiva)?.nome}
            </h2>
            <p className="text-sm text-text-muted">
              {gruposAtuais.length}/{LIMITE_GRUPOS} grupos criados
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={abrirPerfilModal}>
              <UserPlus className="h-4 w-4" /> Cadastrar Líder / Vice / Avaliador
            </Button>
            {/* Gera senha temporária para quem esqueceu a senha */}
            <ContasSenhas />
            <Button
              variant="success"
              onClick={() => navigate(`/grupos/novo/${turmaAtiva}`)}
              disabled={!podeCriarGrupo}
            >
              <Plus className="h-5 w-5" /> Novo grupo
            </Button>
          </div>
        </div>

        {!podeCriarGrupo && (
          <p className="mb-4 text-sm font-medium text-warning">
            Limite de {LIMITE_GRUPOS} grupos atingido nesta turma.
          </p>
        )}

        {/* Grupos */}
        {gruposAtuais.length === 0 ? (
          <Card className="p-8 text-center text-text-muted">
            <Users className="mx-auto mb-2 h-8 w-8" />
            Nenhum grupo ainda. Clique em "Novo grupo" para começar.
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {gruposAtuais.map((grupo) => (
              <GrupoCard
                key={grupo.id}
                grupo={grupo}
                turmaId={turmaAtiva}
                onAbrir={abrirModal}
                onRemoverIntegrante={removerIntegrante}
                onDetalhe={() => navigate(`/grupos/${grupo.id}`)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modais */}
      <Modal open={modal?.tipo === 'renomear'} onClose={() => setModal(null)} title="Renomear grupo">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            renomearGrupo();
          }}
          className="space-y-4"
        >
          <Input label="Novo nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus />
          <Button type="submit" className="w-full" disabled={!form.nome.trim()}>
            Salvar
          </Button>
        </form>
      </Modal>

      <Modal open={modal?.tipo === 'excluir'} onClose={() => setModal(null)} title="Excluir grupo">
        <p className="text-text-muted">
          Tem certeza que deseja excluir o grupo <strong className="text-text">{modal?.nome}</strong>? Essa ação não pode ser desfeita.
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setModal(null)}>
            Cancelar
          </Button>
          <Button variant="danger" className="flex-1" onClick={excluirGrupo}>
            Excluir
          </Button>
        </div>
      </Modal>

      <Modal open={modal?.tipo === 'integrante'} onClose={() => setModal(null)} title="Adicionar integrante">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            adicionarIntegrante();
          }}
          className="space-y-4"
        >
          <Input label="Nome do aluno" value={form.integrante} onChange={(e) => setForm({ ...form, integrante: e.target.value })} required autoFocus />
          <Button type="submit" className="w-full" disabled={!form.integrante.trim()}>
            Adicionar
          </Button>
        </form>
      </Modal>

      <Modal open={modal?.tipo === 'lider'} onClose={() => setModal(null)} title="Designar Líder">
        <EscolhaPerfil
          perfis={lideres}
          vazio="Nenhum perfil de Líder cadastrado ainda."
          selecionado={form.perfilId}
          onSelecionar={(id) => setForm({ ...form, perfilId: id })}
        />
        <Button className="mt-4 w-full" onClick={designarLider} disabled={!form.perfilId}>
          Salvar líder
        </Button>
      </Modal>

      <Modal open={modal?.tipo === 'vice'} onClose={() => setModal(null)} title="Designar Vice-Líder">
        <EscolhaPerfil
          perfis={vices}
          vazio="Nenhum perfil de Vice-Líder cadastrado ainda."
          selecionado={form.perfilId}
          onSelecionar={(id) => setForm({ ...form, perfilId: id })}
        />
        <Button className="mt-4 w-full" onClick={designarVice} disabled={!form.perfilId}>
          Salvar vice-líder
        </Button>
      </Modal>

      <Modal open={modal?.tipo === 'perfil'} onClose={() => setModal(null)} title="Cadastrar Líder, Vice-Líder ou Avaliador">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            cadastrarPerfil();
          }}
          className="space-y-4"
        >
          <Input
            label="Gmail"
            type="email"
            icon={Mail}
            value={formPerfil.email}
            onChange={(e) => setFormPerfil({ ...formPerfil, email: e.target.value })}
            required
            autoFocus
          />
          <Input
            label="Nome"
            icon={User}
            value={formPerfil.nome}
            onChange={(e) => setFormPerfil({ ...formPerfil, nome: e.target.value })}
            required
          />
          <Input
            label="Senha"
            type="password"
            icon={Lock}
            value={formPerfil.senha}
            onChange={(e) => setFormPerfil({ ...formPerfil, senha: e.target.value })}
            required
          />
          <div>
            <span className="mb-1.5 block text-sm font-semibold text-text">Papel</span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { valor: 'lider', rotulo: 'Líder' },
                { valor: 'vice_lider', rotulo: 'Vice-Líder' },
                { valor: 'avaliador', rotulo: 'Avaliador' },
              ].map((opcao) => (
                <button
                  key={opcao.valor}
                  type="button"
                  onClick={() => setFormPerfil({ ...formPerfil, role: opcao.valor })}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                    formPerfil.role === opcao.valor
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'border-border bg-surface text-text-muted hover:bg-surface-muted'
                  }`}
                >
                  {opcao.rotulo}
                </button>
              ))}
            </div>
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={!formPerfil.email.trim() || !formPerfil.nome.trim() || !formPerfil.senha.trim()}
          >
            Cadastrar
          </Button>
        </form>
      </Modal>
    </div>
  );
}

/**
 * Cartão de um grupo com integrantes e ações do professor.
 *
 * @param {Object} props Propriedades do cartão.
 * @param {Object} props.grupo Grupo a exibir.
 * @param {string} props.turmaId UUID da turma.
 * @param {Function} props.onAbrir Abre um modal de ação.
 * @param {Function} props.onRemoverIntegrante Remove um integrante.
 * @param {Function} props.onDetalhe Abre a página de detalhe/avaliações do grupo.
 * @returns {JSX.Element} Cartão do grupo.
 */
function GrupoCard({ grupo, turmaId, onAbrir, onRemoverIntegrante, onDetalhe }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold text-text">{grupo.nome}</h3>
          <Badge tone="aluno">
            {grupo.integrantes.length}/{LIMITE_INTEGRANTES} integrantes
          </Badge>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => onAbrir('renomear', { grupoId: grupo.id, turmaId, nome: grupo.nome })}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onAbrir('excluir', { grupoId: grupo.id, turmaId, nome: grupo.nome })}>
            <Trash2 className="h-4 w-4 text-danger" />
          </Button>
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {grupo.integrantes.length === 0 && (
          <li className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-text-muted">
            Nenhum integrante ainda.
          </li>
        )}
        {grupo.integrantes.map((integrante) => {
          const papel =
            integrante.id === grupo.lider_id ? 'lider' : integrante.id === grupo.vice_lider_id ? 'vice' : 'aluno';
          return (
            <li
              key={integrante.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-2 py-1.5"
            >
              <Avatar name={integrante.nome_aluno} className="h-7 w-7 text-xs" />
              <span className="flex-1 truncate text-sm font-medium text-text">{integrante.nome_aluno}</span>
              <Badge tone={papel}>{papel === 'lider' ? 'Líder' : papel === 'vice' ? 'Vice' : 'Aluno'}</Badge>
              <button
                type="button"
                aria-label={`Remover ${integrante.nome_aluno}`}
                onClick={() => onRemoverIntegrante(grupo.id, turmaId, integrante.id)}
                className="text-text-muted transition-colors hover:text-danger"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => onAbrir('lider', { grupoId: grupo.id, turmaId })}>
          <Crown className="h-4 w-4" /> Líder
        </Button>
        <Button size="sm" variant="outline" onClick={() => onAbrir('vice', { grupoId: grupo.id, turmaId })}>
          <Shield className="h-4 w-4" /> Vice
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onAbrir('integrante', { grupoId: grupo.id, turmaId })}
          disabled={grupo.integrantes.length >= LIMITE_INTEGRANTES}
        >
          <UserPlus className="h-4 w-4" /> + Integrante
        </Button>
      </div>
      {grupo.integrantes.length >= LIMITE_INTEGRANTES && (
        <p className="mt-2 text-xs font-medium text-warning">Limite de {LIMITE_INTEGRANTES} integrantes atingido.</p>
      )}

      <Button variant="outline" className="mt-3 w-full" onClick={onDetalhe}>
        Ver avaliações e gerenciar
      </Button>
    </Card>
  );
}

/**
 * Lista clicável de perfis (Líder/Vice-Líder) para designação.
 *
 * @param {Object} props Propriedades da escolha.
 * @param {Array<Object>} props.perfis Perfis disponíveis.
 * @param {string} props.vazio Mensagem quando não há perfis.
 * @param {string} props.selecionado UUID selecionado.
 * @param {Function} props.onSelecionar Callback de seleção.
 * @returns {JSX.Element} Lista de escolha.
 */
function EscolhaPerfil({ perfis, vazio, selecionado, onSelecionar }) {
  if (perfis.length === 0) {
    return <p className="text-text-muted">{vazio}</p>;
  }
  return (
    <div className="space-y-2">
      {perfis.map((perfil) => (
        <button
          key={perfil.id}
          type="button"
          onClick={() => onSelecionar(perfil.id)}
          className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
            selecionado === perfil.id
              ? 'border-primary bg-primary-soft'
              : 'border-border bg-surface hover:bg-surface-muted'
          }`}
        >
          <Avatar name={perfil.nome} className="h-8 w-8 text-xs" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text">{perfil.nome}</p>
            <p className="truncate text-xs text-text-muted">{perfil.email}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
