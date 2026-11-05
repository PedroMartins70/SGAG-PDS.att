/**
 * URL base da API. Em desenvolvimento aponta para o back-end local.
 * Defina VITE_API_URL no .env para trocar.
 *
 * @type {string}
 */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/** Mensagem exibida na tela de login quando a sessão acaba. */
export const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente para continuar.';

/** Função chamada quando a API indica que a sessão acabou (registrada pelo AuthProvider). */
let aoExpirarSessao = null;

/**
 * Registra a função que encerra a sessão quando a API devolve 401 por sessão inválida.
 *
 * @param {Function|null} funcao Função a chamar (ou null para remover).
 */
export function registrarAoExpirarSessao(funcao) {
  aoExpirarSessao = funcao;
}

/**
 * Lê a data de expiração (campo "exp") de dentro do token JWT.
 *
 * @param {string} token Token de acesso (JWT).
 * @returns {number|null} Momento da expiração em milissegundos, ou null se não der para ler.
 */
export function expiracaoDoToken(token) {
  try {
    const parte = token.split('.')[1];
    const base64 = parte.replace(/-/g, '+').replace(/_/g, '/');
    const preenchido = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const { exp } = JSON.parse(window.atob(preenchido));
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Decide se um erro 401 significa "sessão acabou" (e não, por exemplo, "senha atual incorreta").
 *
 * @param {string} token Token usado na requisição.
 * @param {string} [mensagem] Mensagem de erro devolvida pela API.
 * @returns {boolean} true se a sessão deve ser encerrada.
 */
function indicaSessaoInvalida(token, mensagem) {
  const exp = expiracaoDoToken(token);
  if (exp !== null && exp <= Date.now()) return true;
  return /sessao invalida|token de acesso|perfil/i.test(mensagem ?? '');
}

/**
 * Cliente HTTP para a API do back-end (Express).
 * Injeta o token Bearer da sessão Supabase quando informado.
 * Se a API disser que a sessão acabou (401), encerra a sessão e leva ao login.
 *
 * @param {string} caminho Rota da API (ex.: '/auth/login').
 * @param {Object} [opcoes] Opções da requisição.
 * @param {string} [opcoes.method] Método HTTP (GET, POST, PUT, DELETE).
 * @param {Object} [opcoes.body] Corpo da requisição (JSON).
 * @param {string} [opcoes.token] Token de acesso (Bearer).
 * @returns {Promise<Object>} Corpo JSON da resposta.
 * @throws {Error} Lança erro com a mensagem retornada pela API.
 */
export async function api(caminho, { method = 'GET', body, token } = {}) {
  const resposta = await fetch(`${API_URL}/api${caminho}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    if (resposta.status === 401 && token && indicaSessaoInvalida(token, dados.error)) {
      aoExpirarSessao?.();
      const erroSessao = new Error(MENSAGEM_SESSAO_EXPIRADA);
      erroSessao.status = 401;
      erroSessao.sessaoExpirada = true;
      throw erroSessao;
    }

    const erro = new Error(
      dados.issues?.[0]?.message || dados.error || 'Erro na requisicao'
    );
    erro.status = resposta.status;
    throw erro;
  }

  return dados;
}