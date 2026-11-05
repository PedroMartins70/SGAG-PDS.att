import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  api,
  expiracaoDoToken,
  MENSAGEM_SESSAO_EXPIRADA,
  registrarAoExpirarSessao,
} from '../services/api.js';

/** Chave usada no localStorage para persistir a sessão. */
const AUTH_KEY = 'sgag-session';

/** Quanto tempo antes de expirar o aviso começa a aparecer (em segundos). */
const AVISO_ANTES_DE_EXPIRAR_SEGUNDOS = 10 * 60;

/**
 * Contexto de autenticação da aplicação.
 *
 * @type {React.Context<Object|null>}
 */
const AuthContext = createContext(null);

/**
 * Lê a sessão salva no navegador. Se o token já estiver vencido, descarta a sessão
 * e informa que ela expirou (para o login mostrar o aviso).
 *
 * @returns {{sessao: Object|null, expirada: boolean}} Sessão válida (ou null) e se estava vencida.
 */
function lerSessaoSalva() {
  try {
    const salva = JSON.parse(window.localStorage.getItem(AUTH_KEY));
    if (!salva?.token) return { sessao: null, expirada: false };

    const exp = expiracaoDoToken(salva.token);
    if (exp !== null && exp <= Date.now()) {
      window.localStorage.removeItem(AUTH_KEY);
      return { sessao: null, expirada: true };
    }
    return { sessao: salva, expirada: false };
  } catch {
    return { sessao: null, expirada: false };
  }
}

/**
 * Provedor de autenticação. Gerencia a sessão (token + perfil), a persistência
 * e o controle de expiração (aviso antes de vencer e saída automática).
 *
 * @param {Object} props Propriedades do provedor.
 * @param {React.ReactNode} props.children Conteúdo da aplicação.
 * @returns {JSX.Element} Provedor de autenticação.
 */
export function AuthProvider({ children }) {
  const [inicial] = useState(lerSessaoSalva);
  const [session, setSession] = useState(inicial.sessao);
  const [avisoLogin, setAvisoLogin] = useState(inicial.expirada ? MENSAGEM_SESSAO_EXPIRADA : '');
  const [segundosRestantes, setSegundosRestantes] = useState(null);

  /**
   * Autentica o usuário e persiste a sessão.
   *
   * @param {string} email E-mail do usuário.
   * @param {string} senha Senha do usuário.
   * @returns {Promise<{token: string, user: Object}>} Sessão criada.
   */
  const login = useCallback(async (email, senha) => {
    const dados = await api('/auth/login', { method: 'POST', body: { email, senha } });
    const novaSessao = { token: dados.session.access_token, user: dados.user };
    setAvisoLogin('');
    setSession(novaSessao);
    try {
      window.localStorage.setItem(AUTH_KEY, JSON.stringify(novaSessao));
    } catch {
      /* armazenamento indisponível */
    }
    return novaSessao;
  }, []);

  /**
   * Encerra a sessão local (saída feita pela própria pessoa).
   */
  const logout = useCallback(() => {
    setSession(null);
    setSegundosRestantes(null);
    try {
      window.localStorage.removeItem(AUTH_KEY);
    } catch {
      /* armazenamento indisponível */
    }
  }, []);

  /**
   * Encerra a sessão porque ela expirou e guarda o aviso para a tela de login.
   */
  const expirarSessao = useCallback(() => {
    logout();
    setAvisoLogin(MENSAGEM_SESSAO_EXPIRADA);
  }, [logout]);

  /**
   * Remove o aviso de sessão expirada da tela de login.
   */
  const limparAvisoLogin = useCallback(() => {
    setAvisoLogin('');
  }, []);

  // Permite que o cliente HTTP (api.js) encerre a sessão quando a API devolver 401.
  useEffect(() => {
    registrarAoExpirarSessao(expirarSessao);
    return () => registrarAoExpirarSessao(null);
  }, [expirarSessao]);

  // Acompanha o tempo restante do token: avisa nos últimos 10 minutos e sai ao chegar em zero.
  const token = session?.token;
  useEffect(() => {
    if (!token) {
      setSegundosRestantes(null);
      return undefined;
    }

    const exp = expiracaoDoToken(token);
    if (exp === null) return undefined;

    function verificar() {
      const restante = Math.ceil((exp - Date.now()) / 1000);
      if (restante <= 0) {
        expirarSessao();
        return;
      }
      setSegundosRestantes(restante <= AVISO_ANTES_DE_EXPIRAR_SEGUNDOS ? restante : null);
    }

    verificar();
    const intervalo = window.setInterval(verificar, 1000);
    document.addEventListener('visibilitychange', verificar);

    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', verificar);
    };
  }, [token, expirarSessao]);

  const valor = useMemo(
    () => ({ session, login, logout, segundosRestantes, avisoLogin, limparAvisoLogin }),
    [session, login, logout, segundosRestantes, avisoLogin, limparAvisoLogin]
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

/**
 * Hook de acesso à autenticação.
 *
 * @returns {{
 *   session: Object|null,
 *   login: Function,
 *   logout: Function,
 *   segundosRestantes: number|null,
 *   avisoLogin: string,
 *   limparAvisoLogin: Function
 * }} Dados de autenticação.
 */
export function useAuth() {
  return useContext(AuthContext);
}