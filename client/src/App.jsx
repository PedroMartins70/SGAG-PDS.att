import { Routes, Route, Navigate } from 'react-router-dom';
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
 * Componente raiz: provedores de tema/autenticação e rotas da aplicação.
 *
 * @returns {JSX.Element} Aplicação.
 */
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
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