import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Pencil, PlusCircle, Trash2, UserX } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import ThemeToggle from '../components/ui/ThemeToggle.jsx';
import { api } from '../services/api.js';
import { useAuth } from '../auth/AuthContext.jsx';

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
 * Acessível para Professor, Líder e Vice-Líder do grupo.
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
      try {
        const { historico } = await api(`/grupos/${grupoId}/avaliacoes/historico`, { token });
        if (ativo) setHistorico(historico);
      } catch (e) {
        if (ativo) setErro(e.message || 'Falha ao carregar o histórico.');
      } finally {
        if (ativo) setCarregando(false);
      }
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
            {historico.map((evento) => {
              const config = ACOES[evento.acao] ?? ACOES.UPDATE;
              const Icone = config.icone;
              return (
                <Card key={evento.id} className="p-4">
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
                        <p className="mt-1 text-xs font-semibold text-warning">
                          Alteração feita pelo professor
                        </p>
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
            })}
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * Traduz o papel do usuário para um rótulo legível.
 *
 * @param {string} role Papel do usuário (professor, lider, vice_lider).
 * @returns {string} Rótulo em português.
 */
function rotuloRole(role) {
  if (role === 'professor') return 'Professor';
  if (role === 'lider') return 'Líder';
  if (role === 'vice_lider') return 'Vice-Líder';
  return role;
}
