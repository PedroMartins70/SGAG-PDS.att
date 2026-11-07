import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ClipboardList, FolderOpen, Loader2, LogOut } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import Avatar from '../components/ui/Avatar.jsx';
import Mascot from '../components/ui/Mascot.jsx';
import LogoEscola from '../components/LogoEscola.jsx';
import ThemeToggle from '../components/ui/ThemeToggle.jsx';
import PeriodosAvaliacao from '../components/PeriodosAvaliacao.jsx';
import AvaliadoresTurmas from '../components/AvaliadoresTurmas.jsx';
import MateriaisProfessor from '../components/MateriaisProfessor.jsx';
import MateriaisConsulta from '../components/MateriaisConsulta.jsx';
import LinkPrivacidade from '../components/PoliticaPrivacidade.jsx';
import AlterarSenha from '../components/TrocarSenha.jsx';
import { api } from '../services/api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import Avaliacao from './Avaliacao.jsx';

/**
 * Painel principal.
 * - Professor: turmas (3A-3D) com até 7 grupos cada, com gestão e avaliação,
 *   o quadro "Avaliadores e turmas", o painel do período de avaliação da banca
 *   e a área de Materiais (slides das aulas e modelo do trabalho escrito).
 * - Avaliador da banca: só as turmas às quais foi vinculado e seus grupos, em
 *   modo consulta, e o modelo do trabalho escrito.
 * - Líder/Vice-Líder: avaliação, materiais e arquivos do próprio grupo.
 *
 * @returns {JSX.Element} Painel principal.
 */
export default function Dashboard() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [visao, setVisao] = useState('turmas'); // 'turmas' | 'materiais' (só professor)

  const token = session?.token;
  const role = session?.user?.role;
  const professor = role === 'professor';
  const verTurmas = role === 'professor' || role === 'avaliador';
  const mostrandoMateriais = professor && visao === 'materiais';

  useEffect(() => {
    if (!verTurmas) return;

    let ativo = true;
    async function carregarTurmas() {
      setCarregando(true);
      setErro('');
      try {
        // O avaliador só recebe as turmas às quais o professor o vinculou
        const rotaTurmas = role === 'avaliador' ? '/profiles/minhas-turmas' : '/turmas';
        const { turmas } = await api(rotaTurmas, { token });
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
  }, [verTurmas, token, role]);

  function sair() {
    logout();
    navigate('/login');
  }

  // Senha temporária (redefinida pelo professor): precisa criar uma nova antes de usar o sistema
  if (session?.user?.senha_temporaria) {
    return <Navigate to="/login" replace />;
  }

  const titulo =
    role === 'professor' ? 'Painel do Professor' : role === 'avaliador' ? 'Painel do Avaliador' : 'Avaliação do Grupo';

  /** Conteúdo principal, conforme o perfil e a visão escolhida. */
  function conteudo() {
    if (mostrandoMateriais) {
      return <MateriaisProfessor />;
    }

    if (!verTurmas) {
      return <Avaliacao />;
    }

    if (carregando) {
      return (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    if (erro) {
      return <Card className="p-8 text-center text-danger">{erro}</Card>;
    }

    return (
      <>
        <VisaoTurmas dados={dados} avaliador={role === 'avaliador'} />

        {/* Quadro de avaliadores e das turmas de cada um (só o professor define) */}
        {role === 'professor' && (
          <div className="mt-12">
            <AvaliadoresTurmas turmas={dados?.turmas ?? []} />
          </div>
        )}

        {/* Período em que os avaliadores podem avaliar (só o professor define) */}
        {role === 'professor' && (
          <div className="mt-12">
            <PeriodosAvaliacao />
          </div>
        )}

        {/* Modelo do trabalho escrito (o avaliador só consulta) */}
        {role === 'avaliador' && (
          <div className="mt-12">
            <MateriaisConsulta mostrarAulas={false} />
          </div>
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* No celular, o cabeçalho do professor tem duas linhas e por isso não fica preso no topo. */}
      <header
        className={`z-10 border-b border-border bg-surface/80 backdrop-blur ${
          professor ? 'relative sm:sticky sm:top-0' : 'sticky top-0'
        }`}
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <div
            className={`flex min-w-0 items-center gap-3 ${professor ? 'w-full sm:w-auto' : 'flex-1 sm:flex-none'}`}
          >
            <div className="shrink-0">
              <LogoEscola />
            </div>
            <Mascot className="h-9 w-9 shrink-0" />
            <div className="min-w-0 leading-tight">
              <h1 className="font-display text-lg font-bold text-text">{titulo}</h1>
              <p className="truncate text-xs text-text-muted">{session?.user?.nome}</p>
            </div>
          </div>

          <div
            className={`flex items-center gap-2 ${
              professor ? 'w-full flex-wrap sm:w-auto sm:flex-nowrap' : 'shrink-0'
            }`}
          >
            {professor && (
              <>
                <Button
                  variant={mostrandoMateriais ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setVisao(mostrandoMateriais ? 'turmas' : 'materiais')}
                >
                  <FolderOpen className="h-4 w-4" /> {mostrandoMateriais ? 'Turmas' : 'Materiais'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label="Cadastro de Grupos"
                  onClick={() => navigate('/grupos')}
                >
                  <ClipboardList className="h-4 w-4" />
                  <span className="sm:hidden">Grupos</span>
                  <span className="hidden sm:inline">Cadastro de Grupos</span>
                </Button>
              </>
            )}
            <ThemeToggle />
            <Button variant="outline" size="sm" aria-label="Sair" onClick={sair}>
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{conteudo()}</main>

      <footer className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 pb-8 text-center text-xs text-text-muted sm:px-6">
        <LinkPrivacidade />
        <AlterarSenha />
      </footer>
    </div>
  );
}

/**
 * Visão de turmas 3A-3D, cada uma com até 7 grupos. Cada grupo mostra a logo
 * enviada pelo líder/vice (ou a inicial do nome). O clique leva à tela de
 * detalhe do professor ou à tela de consulta do avaliador.
 * O avaliador vê apenas as turmas às quais foi vinculado.
 *
 * No celular os cartões ocupam exatamente a largura da tela e o nome do grupo
 * quebra de linha (no computador, nomes muito longos ficam com "...").
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

      {avaliador && turmas.length === 0 && (
        <Card className="p-8 text-center text-text-muted">
          Você ainda não foi vinculado a nenhuma turma. Fale com o professor para liberar o acesso.
        </Card>
      )}

      {/* grid-cols-1 limita a coluna à largura da tela (sem isso, nomes longos empurram o cartão para fora) */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {turmas.map((turma) => {
          const grupos = dados?.gruposPorTurma?.[turma.id] ?? [];
          return (
            <Card key={turma.id} className="min-w-0 p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
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
                    className="flex min-w-0 cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm font-medium text-text transition-colors hover:border-primary hover:bg-primary-soft"
                  >
                    {grupo.logo_url ? (
                      <img
                        src={grupo.logo_url}
                        alt={`Logo do grupo ${grupo.nome}`}
                        className="h-8 w-8 shrink-0 rounded-md border border-border object-cover"
                      />
                    ) : (
                      <Avatar name={grupo.nome} className="h-8 w-8 shrink-0 text-xs" />
                    )}
                    <span className="min-w-0 flex-1 break-words sm:truncate">{grupo.nome}</span>
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