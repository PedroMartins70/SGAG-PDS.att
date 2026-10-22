import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardCheck, Loader2, Pencil, PlusCircle, Trash2, UserX } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import ThemeToggle from '../components/ui/ThemeToggle.jsx';
import { api } from '../services/api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { BLOCOS, TOTAL_MAXIMO, formatarNota } from '../lib/criteriosAvaliacao.js';

/** Ícone e rótulo para cada tipo de ação registrada na auditoria. */
const ACOES = {
  INSERT: { icone: PlusCircle, rotulo: 'Nota lançada', cor: 'text-success' },
  UPDATE: { icone: Pencil, rotulo: 'Nota alterada', cor: 'text-warning' },
  DELETE: { icone: Trash2, rotulo: 'Nota excluída', cor: 'text-danger' },
};

/**
 * Formata uma data ISO para o padrão brasileiro (dd/mm/aaaa hh:mm).
 *
 * @param {string} isoDate Data em formato ISO.
 * @returns {string} Data formatada.
 */
function formatarData(isoDate) {
  if (!isoDate) return '—';
  return new Date(isoDate).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Página de histórico de alterações das avaliações de um grupo.
 * Reúne as notas dos integrantes (líder/vice/professor) e as avaliações da
 * banca (avaliadores), da mais recente para a mais antiga.
 * Acessível para Professor, Líder e Vice-Líder do grupo (e Avaliador, que vê
 * apenas as próprias alterações da banca).
 *
 * @returns {JSX.Element} Página de histórico.
 */
export default function Historico() {
  const { grupoId } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const token = session?.token;

  const [historico, setHistorico] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    (async () => {
      setCarregando(true);
      setErro('');

      // As duas listas são buscadas juntas; se uma falhar, a outra ainda aparece.
      const [integrantes, banca] = await Promise.allSettled([
        api(`/grupos/${grupoId}/avaliacoes/historico`, { token }),
        api(`/grupos/${grupoId}/avaliacoes-banca/historico`, { token }),
      ]);

      if (!ativo) return;

      if (integrantes.status === 'rejected' && banca.status === 'rejected') {
        setErro(integrantes.reason?.message || 'Falha ao carregar o histórico.');
        setHistorico([]);
      } else {
        const eventosIntegrantes =
          integrantes.status === 'fulfilled'
            ? integrantes.value.historico.map((e) => ({ ...e, tipo: 'integrante' }))
            : [];
        const eventosBanca = banca.status === 'fulfilled' ? banca.value.historico : [];

        setHistorico(
          [...eventosIntegrantes, ...eventosBanca].sort((a, b) => new Date(b.data) - new Date(a.data))
        );
      }
      setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
  }, [grupoId, token]);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <div className="leading-tight">
              <h1 className="font-display text-lg font-bold text-text">Histórico de alterações</h1>
              <p className="text-xs text-text-muted">Todas as mudanças nas avaliações deste grupo</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {carregando ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : erro ? (
          <div className="rounded-lg border border-danger-soft bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
            {erro}
          </div>
        ) : historico.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 p-8 text-center text-text-muted">
            <UserX className="h-8 w-8" />
            Nenhuma alteração registrada ainda.
          </Card>
        ) : (
          <div className="space-y-3">
            {historico.map((evento) =>
              evento.tipo === 'banca' ? (
                <EventoBanca key={evento.id} evento={evento} />
              ) : (
                <EventoIntegrante key={evento.id} evento={evento} />
              )
            )}
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * Cartão de um evento de nota de integrante (líder/vice/professor).
 *
 * @param {Object} props Propriedades.
 * @param {Object} props.evento Evento do histórico.
 * @returns {JSX.Element} Cartão do evento.
 */
function EventoIntegrante({ evento }) {
  const config = ACOES[evento.acao] ?? ACOES.UPDATE;
  const Icone = config.icone;
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <Icone className={`mt-0.5 h-5 w-5 shrink-0 ${config.cor}`} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-text">
            {config.rotulo}
            {evento.integrante?.nome ? ` — ${evento.integrante.nome}` : ''}
            {evento.bimestre ? ` (${evento.bimestre}º bimestre)` : ''}
          </p>
          <p className="text-xs text-text-muted">
            {formatarData(evento.data)}
            {evento.usuario?.nome ? ` · por ${evento.usuario.nome}` : ''}
            {evento.usuario?.role ? ` (${rotuloRole(evento.usuario.role)})` : ''}
          </p>
          {evento.alterado_por_professor && evento.acao !== 'DELETE' && (
            <p className="mt-1 text-xs font-semibold text-warning">Alteração feita pelo professor</p>
          )}
          {evento.comentario_esclarecimento && (
            <p className="mt-2 rounded-lg bg-canvas px-3 py-2 text-sm text-text">
              "{evento.comentario_esclarecimento}"
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * Cartão de um evento da avaliação da banca: notas dos 4 blocos, total,
 * valores anteriores (quando foi uma alteração) e comentário.
 *
 * @param {Object} props Propriedades.
 * @param {Object} props.evento Evento do histórico da banca.
 * @returns {JSX.Element} Cartão do evento.
 */
function EventoBanca({ evento }) {
  const novo = evento.acao === 'INSERT';
  const anterior = evento.notas_anteriores;

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <ClipboardCheck className={`mt-0.5 h-5 w-5 shrink-0 ${novo ? 'text-success' : 'text-warning'}`} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-text">
            {novo ? 'Avaliação da banca lançada' : 'Avaliação da banca alterada'}
            {evento.bimestre ? ` (${evento.bimestre}º bimestre)` : ''}
          </p>
          <p className="text-xs text-text-muted">
            {formatarData(evento.data)}
            {evento.usuario?.nome ? ` · por ${evento.usuario.nome}` : ''}
            {evento.usuario?.role ? ` (${rotuloRole(evento.usuario.role)})` : ''}
          </p>

          {evento.notas && (
            <>
              <p className="mt-2 text-sm font-semibold text-primary">
                Total: {formatarNota(evento.nota_total ?? 0)} / {formatarNota(TOTAL_MAXIMO)}
                {evento.nota_total_anterior !== null && evento.nota_total_anterior !== undefined && (
                  <span className="font-normal text-text-muted">
                    {' '}
                    (antes: {formatarNota(evento.nota_total_anterior)})
                  </span>
                )}
              </p>

              <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
                {BLOCOS.map((bloco) => {
                  const atual = evento.notas[bloco.id];
                  const antes = anterior?.[bloco.id];
                  const mudou = antes !== undefined && antes !== atual;
                  return (
                    <div
                      key={bloco.id}
                      className="rounded-lg border border-border bg-surface-muted px-3 py-2"
                    >
                      <p className="text-xs text-text-muted">{bloco.titulo}</p>
                      <p className="font-semibold text-text">
                        {atual === undefined ? '—' : formatarNota(atual)}
                        {mudou && (
                          <span className="ml-1 text-xs font-normal text-text-muted">
                            (antes: {formatarNota(antes)})
                          </span>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {evento.comentario && (
            <p className="mt-2 whitespace-pre-wrap rounded-lg bg-canvas px-3 py-2 text-sm text-text">
              "{evento.comentario}"
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * Traduz o papel do usuário para um rótulo legível.
 *
 * @param {string} role Papel do usuário (professor, lider, vice_lider, avaliador).
 * @returns {string} Rótulo em português.
 */
function rotuloRole(role) {
  if (role === 'professor') return 'Professor';
  if (role === 'lider') return 'Líder';
  if (role === 'vice_lider') return 'Vice-Líder';
  if (role === 'avaliador') return 'Avaliador';
  return role;
}
