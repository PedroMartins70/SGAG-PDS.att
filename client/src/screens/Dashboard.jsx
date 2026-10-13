import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Loader2, LogOut } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import Avatar from '../components/ui/Avatar.jsx';
import Mascot from '../components/ui/Mascot.jsx';
import ThemeToggle from '../components/ui/ThemeToggle.jsx';
import { api } from '../services/api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import Avaliacao from './Avaliacao.jsx';

/**
 * Painel principal.
 * - Professor: turmas (3A-3D) com até 5 grupos cada, com gestão e avaliação.
 * - Avaliador da banca: as mesmas turmas e grupos, em modo consulta.
 * - Líder/Vice-Líder: avaliação e arquivos do próprio grupo.
 *
 * @returns {JSX.Element} Painel principal.
 */
export default function Dashboard() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const token = session?.token;
  const role = session?.user?.role;
  const verTurmas = role === 'professor' || role === 'avaliador';

  useEffect(() => {
    if (!verTurmas) return;

    let ativo = true;
    async function carregarTurmas() {
      setCarregando(true);
      setErro('');
      try {
        const { turmas } = await api('/turmas', { token });
        const gruposPorTurma = {};
        for (const turma of turmas) {
          const { grupos } = await api(`/turmas/${turma.id}/grupos`, { token });
          gruposPorTurma[turma.id] = grupos;
        }
        if (ativo) setDados({ turmas, gruposPorTurma });
      } catch (e) {
        if (ativo) setErro(e.message || 'Falha ao carregar dados');
      } finally {
        if (ativo) setCarregando(false);
      }
    }
    carregarTurmas();
    return () => {
      ativo = false;
    };
  }, [verTurmas, token]);

  function sair() {
    logout();
    navigate('/login');
  }

  const titulo =
    role === 'professor' ? 'Painel do Professor' : role === 'avaliador' ? 'Painel do Avaliador' : 'Avaliação do Grupo';

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Mascot className="h-9 w-9" />
            <div className="leading-tight">
              <h1 className="font-display text-lg font-bold text-text">{titulo}</h1>
              <p className="text-xs text-text-muted">{session?.user?.nome}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {role === 'professor' && (
              <Button variant="secondary" size="sm" onClick={() => navigate('/grupos')}>
                <ClipboardList className="h-4 w-4" /> Cadastro de Grupos
              </Button>
            )}
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={sair}>
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {verTurmas ? (
          carregando ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : erro ? (
            <Card className="p-8 text-center text-danger">{erro}</Card>
          ) : (
            <VisaoTurmas dados={dados} avaliador={role === 'avaliador'} />
          )
        ) : (
          <Avaliacao />
        )}
      </main>
    </div>
  );
}

/**
 * Visão de turmas 3A-3D, cada uma com até 5 grupos. Cada grupo mostra a logo
 * enviada pelo líder/vice (ou a inicial do nome). O clique leva à tela de
 * detalhe do professor ou à tela de consulta do avaliador.
 *
 * @param {Object} props Propriedades da visão.
 * @param {Object} props.dados Dados carregados (turmas e grupos por turma).
 * @param {boolean} props.avaliador true se quem está vendo é o avaliador da banca.
 * @returns {JSX.Element} Grade de turmas.
 */
function VisaoTurmas({ dados, avaliador }) {
  const navigate = useNavigate();
  const turmas = dados?.turmas ?? [];

  return (
    <div>
      <h2 className="mb-1 font-display text-2xl font-bold text-text">Turmas</h2>
      <p className="mb-6 text-text-muted">
        {avaliador
          ? 'Clique em um grupo para ver as notas, os arquivos e o histórico.'
          : 'Clique em um grupo para ver detalhes e avaliações.'}
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        {turmas.map((turma) => {
          const grupos = dados?.gruposPorTurma?.[turma.id] ?? [];
          return (
            <Card key={turma.id} className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-xl font-bold text-primary">Turma {turma.nome}</h3>
                <Badge tone="professor">{grupos.length} grupos</Badge>
              </div>
              <ul className="space-y-2">
                {grupos.length === 0 && (
                  <li className="text-sm text-text-muted">Nenhum grupo criado ainda.</li>
                )}
                {grupos.map((grupo) => (
                  <li
                    key={grupo.id}
                    onClick={() => navigate(avaliador ? `/avaliador/grupos/${grupo.id}` : `/grupos/${grupo.id}`)}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm font-medium text-text transition-colors hover:border-primary hover:bg-primary-soft"
                  >
                    {grupo.logo_url ? (
                      <img
                        src={grupo.logo_url}
                        alt={`Logo do grupo ${grupo.nome}`}
                        className="h-8 w-8 shrink-0 rounded-md border border-border object-cover"
                      />
                    ) : (
                      <Avatar name={grupo.nome} className="h-8 w-8 text-xs" />
                    )}
                    <span className="truncate">{grupo.nome}</span>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
