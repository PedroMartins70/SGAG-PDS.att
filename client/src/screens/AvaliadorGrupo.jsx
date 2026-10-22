import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, Crown, Loader2, Shield, UserX } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Avatar from '../components/ui/Avatar.jsx';
import ThemeToggle from '../components/ui/ThemeToggle.jsx';
import ProjetoArquivos from '../components/ProjetoArquivos.jsx';
import AvaliacaoBanca from '../components/AvaliacaoBanca.jsx';
import { api } from '../services/api.js';
import { useAuth } from '../auth/AuthContext.jsx';

/** Critérios de avaliação dados pelo líder/vice/professor (0,00 a 0,20 cada). */
const CRITERIOS = [
  { key: 'interesse', rotulo: 'Interesse' },
  { key: 'entrega_prazo', rotulo: 'Entrega no prazo' },
  { key: 'participacao', rotulo: 'Participação' },
  { key: 'qualidade_trabalho', rotulo: 'Qualidade no trabalho' },
  { key: 'respeito_grupo', rotulo: 'Respeito no grupo' },
];

/** Bimestres disponíveis para consulta. */
const BIMESTRES = [1, 2, 3, 4];

/**
 * Formata um número com duas casas e vírgula (ex.: 0,15).
 *
 * @param {number|string|null} valor Valor numérico.
 * @returns {string} Texto formatado.
 */
function formatar(valor) {
  if (valor === null || valor === undefined || valor === '') return '—';
  return Number(valor).toFixed(2).replace('.', ',');
}

/**
 * Tela de um grupo para o Avaliador da banca.
 * Mostra a logo, o líder e o vice e o formulário de AVALIAÇÃO DA BANCA
 * (4 blocos da ficha + comentário, por bimestre), além das notas que o
 * líder/vice deram aos integrantes (somente leitura), os arquivos do projeto
 * e o atalho para o histórico de alterações.
 *
 * @returns {JSX.Element} Tela do grupo para o avaliador.
 */
export default function AvaliadorGrupo() {
  const { grupoId } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const token = session?.token;

  const [grupo, setGrupo] = useState(null);
  const [bimestre, setBimestre] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

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
        <Button variant="outline" onClick={() => navigate('/dashboard')}>
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
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
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
              <p className="text-xs text-text-muted">Avaliação, notas, arquivos e histórico do grupo</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(`/grupos/${grupoId}/historico`)}>
              <Clock className="h-4 w-4" /> Histórico
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
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
              {grupo.media_geral === null ? '—' : `${formatar(grupo.media_geral)} / 1,00`}
            </p>
          </Card>
        </div>

        {/* Avaliação da banca (o avaliador preenche; usa o bimestre escolhido acima) */}
        <div className="mb-10">
          <AvaliacaoBanca grupoId={grupoId} bimestre={bimestre} />
        </div>

        {/* Notas por integrante */}
        <h2 className="mb-4 font-display text-xl font-bold text-text">Notas dos integrantes</h2>
        {grupo.integrantes.length === 0 ? (
          <Card className="p-8 text-center text-text-muted">Nenhum integrante neste grupo.</Card>
        ) : (
          <div className="space-y-3">
            {grupo.integrantes.map((integrante) => (
              <LinhaNota key={integrante.id} integrante={integrante} grupo={grupo} />
            ))}
          </div>
        )}

        {/* Arquivos do projeto (somente visualização) */}
        <h2 className="mb-4 mt-10 font-display text-xl font-bold text-text">Arquivos do projeto</h2>
        <ProjetoArquivos grupoId={grupoId} />
      </main>
    </div>
  );
}

/**
 * Cartão de um integrante com a nota do bimestre (somente leitura):
 * critérios, total, quem avaliou, ajuste do professor e comentário.
 *
 * @param {Object} props Propriedades.
 * @param {Object} props.integrante Integrante com a avaliação do bimestre.
 * @param {Object} props.grupo Grupo (para identificar líder e vice).
 * @returns {JSX.Element} Cartão do integrante.
 */
function LinhaNota({ integrante, grupo }) {
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
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={integrante.nome_aluno} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-text">
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
              {avaliadorNome ? `Avaliado por ${avaliadorNome}` : 'Avaliado'}
              {av.alterado_por_professor ? ' · ajustada pelo professor' : ''}
            </p>
          ) : (
            <p className="text-sm text-text-muted">Ainda não avaliado neste bimestre.</p>
          )}
        </div>
        {av && (
          <span className="rounded-full bg-primary-soft px-3 py-1 text-sm font-bold text-primary">
            {formatar(av.nota_total)} / 1,00
          </span>
        )}
      </div>

      {av && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {CRITERIOS.map((c) => (
            <div key={c.key} className="rounded-lg border border-border bg-surface-muted px-3 py-2">
              <p className="text-xs text-text-muted">{c.rotulo}</p>
              <p className="font-semibold text-text">{formatar(av[c.key])}</p>
            </div>
          ))}
        </div>
      )}

      {av?.comentario_esclarecimento && (
        <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-sm text-text">
          "{av.comentario_esclarecimento}"
        </p>
      )}
    </Card>
  );
}
