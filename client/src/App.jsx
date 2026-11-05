import { Routes, Route, Navigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { ThemeProvider } from './theme/ThemeProvider.jsx';
import { AuthProvider, useAuth } from './auth/AuthContext.jsx';
import Login from './screens/Login.jsx';
import RegisterForm from './screens/RegisterForm.jsx';
import Dashboard from './screens/Dashboard.jsx';
import Grupos from './screens/Grupos.jsx';
import NovoGrupo from './screens/NovoGrupo.jsx';
import DetalheGrupo from './screens/DetalheGrupo.jsx';
import Historico from './screens/Historico.jsx';
import AvaliadorGrupo from './screens/AvaliadorGrupo.jsx';

/**
 * Guarda de rota: exige sessão autenticada; caso contrário redireciona ao login.
 *
 * @param {Object} props Propriedades do guarda.
 * @param {React.ReactNode} props.children Conteúdo protegido.
 * @returns {JSX.Element} Conteúdo ou redirecionamento.
 */
function RequireAuth({ children }) {
  const { session } = useAuth();
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

/**
 * Guarda de rota: apenas Professor.
 *
 * @param {Object} props Propriedades do guarda.
 * @param {React.ReactNode} props.children Conteúdo restrito ao professor.
 * @returns {JSX.Element} Conteúdo ou redirecionamento.
 */
function RequireProfessor({ children }) {
  const { session } = useAuth();
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (session.user.role !== 'professor') {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

/**
 * Guarda de rota: apenas Avaliador da banca.
 *
 * @param {Object} props Propriedades do guarda.
 * @param {React.ReactNode} props.children Conteúdo restrito ao avaliador.
 * @returns {JSX.Element} Conteúdo ou redirecionamento.
 */
function RequireAvaliador({ children }) {
  const { session } = useAuth();
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (session.user.role !== 'avaliador') {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

/**
 * Etiqueta pequena no canto superior esquerdo, mostrada nos últimos 10 minutos
 * da sessão, com contagem regressiva. Fica vermelha no último minuto.
 * Não bloqueia cliques. Ao chegar em zero o sistema sai sozinho e volta para o login.
 *
 * @returns {JSX.Element|null} Etiqueta de aviso ou nada, se ainda falta mais de 10 minutos.
 */
function AvisoSessao() {
  const { segundosRestantes } = useAuth();

  if (segundosRestantes === null) return null;

  const minutos = Math.floor(segundosRestantes / 60);
  const segundos = String(segundosRestantes % 60).padStart(2, '0');
  const urgente = segundosRestantes <= 60;

  return (
    <div
      role="status"
      className={`pointer-events-none fixed left-2 top-2 z-50 flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold shadow-md ${
        urgente
          ? 'border-danger-soft bg-danger-soft text-danger'
          : 'border-warning-soft bg-warning-soft text-warning'
      }`}
    >
      <Clock className="h-3 w-3" aria-hidden="true" />
      Sessão expira em {minutos}:{segundos}
    </div>
  );
}

/**
 * Componente raiz: provedores de tema/autenticação e rotas da aplicação.
 *
 * @returns {JSX.Element} Aplicação.
 */
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AvisoSessao />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Navigate to="/cadastro/professor" replace />} />
          <Route path="/cadastro/professor" element={<RegisterForm />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/grupos"
            element={
              <RequireProfessor>
                <Grupos />
              </RequireProfessor>
            }
          />
          <Route
            path="/grupos/novo/:turmaId"
            element={
              <RequireProfessor>
                <NovoGrupo />
              </RequireProfessor>
            }
          />
          <Route
            path="/grupos/:grupoId"
            element={
              <RequireProfessor>
                <DetalheGrupo />
              </RequireProfessor>
            }
          />
          <Route
            path="/grupos/:grupoId/historico"
            element={
              <RequireAuth>
                <Historico />
              </RequireAuth>
            }
          />
          <Route
            path="/avaliador/grupos/:grupoId"
            element={
              <RequireAvaliador>
                <AvaliadorGrupo />
              </RequireAvaliador>
            }
          />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}