import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, Crown, Loader2, Pencil, Plus, Shield, Trash2, UserX } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import Modal from '../components/ui/Modal.jsx';
import Input from '../components/ui/Input.jsx';
import Avatar from '../components/ui/Avatar.jsx';
import ThemeToggle from '../components/ui/ThemeToggle.jsx';
import ProjetoArquivos from '../components/ProjetoArquivos.jsx';
import { api } from '../services/api.js';
import { useAuth } from '../auth/AuthContext.jsx';

/** Critérios de avaliação (0,00 a 0,20). */
const CRITERIOS = [
  { key: 'interesse', rotulo: 'Interesse' },
  { key: 'entrega_prazo', rotulo: 'Entrega no prazo' },
  { key: 'participacao', rotulo: 'Participação' },
  { key: 'qualidade_trabalho', rotulo: 'Qualidade no trabalho' },
  { key: 'respeito_grupo', rotulo: 'Respeito no grupo' },
];

/** Bimestres disponíveis para seleção. */
const BIMESTRES = [1, 2, 3, 4];

const critVazio = () => Object.fromEntries(CRITERIOS.map((c) => [c.key, '']));

/**
 * Página de detalhe do grupo (Professor): ver e editar avaliações por
 * bimestre, renomear o grupo, gerenciar integrantes e ver (somente leitura)
 * os arquivos do projeto enviados pelo líder/vice. A edição de avaliação
 * exige justificativa.
 *
 * @returns {JSX.Element} Página de detalhe do grupo.
 */
export default function DetalheGrupo() {
  const { grupoId } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const token = session?.token;

  const [grupo, setGrupo] = useState(null);
  const [bimestre, setBimestre] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ nome: '', integrante: '', justificativa: '', crit: critVazio() });

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const { grupo } = await api(`/grupos/${grupoId}?bimestre=${bimestre}`, { token });
      setGrupo(grupo);
    } catch (e) {
      setErro(e.message || 'Falha ao carregar o grupo.');
    } finally {
      setCarregando(false);
    }
  }, [grupoId, bimestre, token]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /** Abre um modal, pré-preenchendo o formulário. */
  function abrirModal(tipo, contexto = {}) {
    setForm({
      nome: contexto.nome ?? '',
      integrante: '',
      justificativa: '',
      crit: contexto.avaliacao ? deAvaliacao(contexto.avaliacao) : critVazio(),
    });
    setModal({ tipo, ...contexto });
  }

  async function renomearGrupo() {
    await api(`/grupos/${grupoId}`, { method: 'PUT', token, body: { nome: form.nome } });
    setModal(null);
    await carregar();
  }

  async function adicionarIntegrante() {
    await api(`/grupos/${grupoId}/integrantes`, { method: 'POST', token, body: { nome_aluno: form.integrante } });
    setModal(null);
    await carregar();
  }

  async function renomearIntegrante() {
    await api(`/grupos/${grupoId}/integrantes/${modal.integranteId}`, {
      method: 'PUT',
      token,
      body: { nome_aluno: form.integrante },
    });
    setModal(null);
    await carregar();
  }

  async function excluirIntegrante() {
    await api(`/grupos/${grupoId}/integrantes/${modal.integranteId}`, { method: 'DELETE', token });
    setModal(null);
    await carregar();
  }

  async function salvarAvaliacao() {
    const corpo = { bimestre };
    for (const c of CRITERIOS) corpo[c.key] = Number(form.crit[c.key]);
    corpo.comentario_esclarecimento = form.justificativa.trim();
    await api(`/grupos/${grupoId}/avaliacoes/${modal.integranteId}`, { method: 'PUT', token, body: corpo });
    setModal(null);
    await carregar();
  }

  if (carregando && !grupo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (erro || !grupo) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas p-4">
        <UserX className="h-10 w-10 text-text-muted" />
        <p className="text-text-muted">{erro || 'Grupo não encontrado.'}</p>
        <Button variant="outline" onClick={() => navigate('/grupos')}>
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/grupos')}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            {grupo.logo_url && (
              <img
                src={grupo.logo_url}
                alt={`Logo do grupo ${grupo.nome}`}
                className="h-10 w-10 shrink-0 rounded-lg border border-border object-cover"
              />
            )}
            <div className="leading-tight">
              <h1 className="font-display text-lg font-bold text-text">{grupo.nome}</h1>
              <p className="text-xs text-text-muted">Detalhe e avaliações do grupo</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(`/grupos/${grupoId}/historico`)}>
              <Clock className="h-4 w-4" /> Histórico
            </Button>
            <Button variant="outline" size="sm" onClick={() => abrirModal('renomearGrupo', { nome: grupo.nome })}>
              <Pencil className="h-4 w-4" /> Renomear
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {erro && (
          <div className="mb-4 rounded-lg border border-danger-soft bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
            {erro}
          </div>
        )}

        {/* Seletor de bimestre */}
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm font-semibold text-text">Bimestre:</span>
          <div className="flex gap-1">
            {BIMESTRES.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBimestre(b)}
                className={`h-9 w-9 rounded-lg text-sm font-bold transition-all ${
                  bimestre === b
                    ? 'bg-primary text-white'
                    : 'border border-border bg-surface text-text-muted hover:border-primary'
                }`}
              >
                {b}º
              </button>
            ))}
          </div>
        </div>

        {/* Resumo: Líder, Vice, média */}
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <p className="mb-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-badge-lider-text">
              <Crown className="h-4 w-4" /> Líder
            </p>
            <p className="truncate font-semibold text-text">{grupo.lider?.nome ?? '—'}</p>
            <p className="truncate text-xs text-text-muted">{grupo.lider?.email}</p>
          </Card>
          <Card className="p-4">
            <p className="mb-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-badge-vice-text">
              <Shield className="h-4 w-4" /> Vice-Líder
            </p>
            <p className="truncate font-semibold text-text">{grupo.vice?.nome ?? '—'}</p>
            <p className="truncate text-xs text-text-muted">{grupo.vice?.email}</p>
          </Card>
          <Card className="p-4">
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-text-muted">
              Média do {bimestre}º bimestre
            </p>
            <p className="font-display text-2xl font-extrabold text-primary">
              {grupo.media_geral === null ? '—' : `${grupo.media_geral.toFixed(2)} / 1,00`}
            </p>
          </Card>
        </div>

        {/* Integrantes */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-display text-xl font-bold text-text">Integrantes</h2>
          <Button size="sm" onClick={() => abrirModal('integrante')}>
            <Plus className="h-4 w-4" /> Adicionar integrante
          </Button>
        </div>

        {grupo.integrantes.length === 0 ? (
          <Card className="p-8 text-center text-text-muted">Nenhum integrante ainda.</Card>
        ) : (
          <div className="space-y-3">
            {grupo.integrantes.map((integrante) => (
              <LinhaIntegrante
                key={integrante.id}
                integrante={integrante}
                grupo={grupo}
                onAvaliar={() => abrirModal('avaliacao', { integranteId: integrante.id, avaliacao: integrante.avaliacao })}
                onRenomear={() => abrirModal('renomearIntegrante', { integranteId: integrante.id, nome: integrante.nome_aluno })}
                onExcluir={() => abrirModal('excluirIntegrante', { integranteId: integrante.id, nome: integrante.nome_aluno })}
              />
            ))}
          </div>
        )}

        {/* Arquivos do projeto (somente visualização para o professor) */}
        <h2 className="mb-4 mt-10 font-display text-xl font-bold text-text">Arquivos do projeto</h2>
        <ProjetoArquivos grupoId={grupoId} />
      </main>

      {/* Modal renomear grupo */}
      <Modal open={modal?.tipo === 'renomearGrupo'} onClose={() => setModal(null)} title="Renomear grupo">
        <FormAcao valor={form.nome} onChange={(v) => setForm({ ...form, nome: v })} onConfirmar={renomearGrupo} rotulo="Nome do grupo" botao="Salvar" />
      </Modal>

      {/* Modal adicionar integrante */}
      <Modal open={modal?.tipo === 'integrante'} onClose={() => setModal(null)} title="Adicionar integrante">
        <FormAcao valor={form.integrante} onChange={(v) => setForm({ ...form, integrante: v })} onConfirmar={adicionarIntegrante} rotulo="Nome do aluno" botao="Adicionar" />
      </Modal>

      {/* Modal renomear integrante */}
      <Modal open={modal?.tipo === 'renomearIntegrante'} onClose={() => setModal(null)} title="Renomear integrante">
        <FormAcao valor={form.integrante} onChange={(v) => setForm({ ...form, integrante: v })} onConfirmar={renomearIntegrante} rotulo="Novo nome" botao="Salvar" />
      </Modal>

      {/* Modal excluir integrante */}
      <Modal open={modal?.tipo === 'excluirIntegrante'} onClose={() => setModal(null)} title="Excluir integrante">
        <p className="text-text-muted">
          Excluir <strong className="text-text">{modal?.nome}</strong> do grupo? Essa ação não pode ser desfeita.
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setModal(null)}>Cancelar</Button>
          <Button variant="danger" className="flex-1" onClick={excluirIntegrante}>Excluir</Button>
        </div>
      </Modal>

      {/* Modal editar avaliação (justificativa obrigatória) */}
      <Modal
        open={modal?.tipo === 'avaliacao'}
        onClose={() => setModal(null)}
        title={`Editar avaliação do integrante — ${bimestre}º bimestre`}
      >
        <AvaliacaoProfessor
          crit={form.crit}
          justificativa={form.justificativa}
          onChangeCrit={(c) => setForm({ ...form, crit: c })}
          onChangeJustificativa={(v) => setForm({ ...form, justificativa: v })}
          onSalvar={salvarAvaliacao}
        />
      </Modal>
    </div>
  );
}

/**
 * Linha de um integrante com ações (avaliar, renomear, excluir).
 *
 * @param {Object} props Propriedades da linha.
 * @returns {JSX.Element} Linha do integrante.
 */
function LinhaIntegrante({ integrante, grupo, onAvaliar, onRenomear, onExcluir }) {
  const av = integrante.avaliacao;
  const avaliadorNome = av?.avaliador_id
    ? av.avaliador_id === grupo.lider?.id
      ? 'Líder'
      : av.avaliador_id === grupo.vice?.id
        ? 'Vice-Líder'
        : 'Professor'
    : null;

  const isLider = integrante.nome_aluno === grupo.lider?.nome;
  const isVice = integrante.nome_aluno === grupo.vice?.nome;

  return (
    <Card className="flex flex-wrap items-center gap-3 p-4">
      <Avatar name={integrante.nome_aluno} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-semibold text-text">
          {integrante.nome_aluno}
          {isLider && (
            <span className="inline-flex items-center gap-1 rounded-full bg-badge-lider px-2 py-0.5 text-xs font-bold text-badge-lider-text">
              <Crown className="h-3 w-3" /> Líder
            </span>
          )}
          {isVice && (
            <span className="inline-flex items-center gap-1 rounded-full bg-badge-vice px-2 py-0.5 text-xs font-bold text-badge-vice-text">
              <Shield className="h-3 w-3" /> Vice-Líder
            </span>
          )}
        </p>
        {av ? (
          <p className="text-sm text-text-muted">
            Nota {Number(av.nota_total).toFixed(2)}/1,00{avaliadorNome ? ` · avaliado por ${avaliadorNome}` : ''}
            {av.alterado_por_professor ? ' · ajustada pelo professor' : ''}
          </p>
        ) : (
          <p className="text-sm text-text-muted">Ainda não avaliado neste bimestre.</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onAvaliar}>
          {av ? 'Ver/Editar nota' : 'Avaliar'}
        </Button>
        <Button size="sm" variant="outline" onClick={onRenomear}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onExcluir}>
          <Trash2 className="h-4 w-4 text-danger" />
        </Button>
      </div>
    </Card>
  );
}

/**
 * Pequeno formulário de um campo + botão confirmar.
 *
 * @param {Object} props Propriedades do formulário.
 * @returns {JSX.Element} Formulário.
 */
function FormAcao({ valor, onChange, onConfirmar, rotulo, botao }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onConfirmar();
      }}
      className="space-y-4"
    >
      <Input label={rotulo} value={valor} onChange={(e) => onChange(e.target.value)} required autoFocus />
      <Button type="submit" className="w-full" disabled={!valor.trim()}>
        {botao}
      </Button>
    </form>
  );
}

/**
 * Converte uma avaliação (valores numéricos) em mapa de strings para edição.
 *
 * @param {Object} avaliacao Avaliação retornada pela API.
 * @returns {Object} Mapa critério -> string.
 */
function deAvaliacao(avaliacao) {
  const valores = {};
  for (const c of CRITERIOS) {
    const v = avaliacao[c.key];
    valores[c.key] = v === null || v === undefined ? '' : String(v);
  }
  return valores;
}

/**
 * Formulário de edição da avaliação pelo Professor, com justificativa obrigatória.
 *
 * @param {Object} props Propriedades do formulário.
 * @returns {JSX.Element} Formulário de avaliação.
 */
function AvaliacaoProfessor({ crit, justificativa, onChangeCrit, onChangeJustificativa, onSalvar }) {
  const numeros = CRITERIOS.map((c) => Number(crit[c.key]));
  const total = numeros.reduce((s, n) => s + (Number.isFinite(n) ? n : 0), 0);
  const todosValidos = numeros.every((n) => Number.isFinite(n) && n >= 0 && n <= 0.2);
  const pronto = todosValidos && justificativa.trim().length > 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {CRITERIOS.map((c) => (
          <label key={c.key} className="block">
            <span className="mb-1 block text-xs font-semibold text-text">{c.rotulo}</span>
            <input
              type="number"
              min="0"
              max="0.2"
              step="0.05"
              value={crit[c.key]}
              onChange={(e) => onChangeCrit({ ...crit, [c.key]: e.target.value })}
              className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-base text-text transition-all focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
            />
          </label>
        ))}
      </div>

      <p className="text-sm text-text-muted">
        Nota total: <strong className="text-primary">{Number.isFinite(total) ? total.toFixed(2) : '0,00'}</strong> / 1,00
      </p>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-warning">* Motivo da alteração (obrigatório)</span>
        <textarea
          rows={3}
          value={justificativa}
          onChange={(e) => onChangeJustificativa(e.target.value)}
          placeholder="Explique por que esta nota está sendo alterada para manter o registro histórico..."
          className="h-auto w-full rounded-xl border border-warning bg-surface px-3.5 py-2.5 text-base text-text placeholder:text-text-muted transition-all focus:border-warning focus:outline-none focus:ring-4 focus:ring-warning/15"
        />
      </label>

      <Button variant="success" className="w-full" onClick={onSalvar} disabled={!pronto}>
        Salvar e Confirmar
      </Button>
    </div>
  );
}
