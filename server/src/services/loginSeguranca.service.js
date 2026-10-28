import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middlewares/error.middleware.js';

const TABELA = 'tentativas_login';
const MINUTO = 60 * 1000;

/** Quantas senhas erradas seguidas (na janela) bloqueiam um e-mail. */
export const LIMITE_POR_EMAIL = Number(process.env.LOGIN_MAX_FALHAS_EMAIL) || 5;
/** Quantas falhas vindas do mesmo IP (qualquer e-mail) bloqueiam o IP. */
export const LIMITE_POR_IP = Number(process.env.LOGIN_MAX_FALHAS_IP) || 30;
/** Janela de contagem (e duração do bloqueio), em minutos. */
export const JANELA_MINUTOS = Number(process.env.LOGIN_JANELA_MINUTOS) || 15;

/**
 * Deixa o e-mail em minúsculas e sem espaços, para contar tentativas
 * "Aluno@x.com" e "aluno@x.com" como a mesma conta.
 *
 * @param {string} email E-mail digitado.
 * @returns {string} E-mail normalizado.
 */
export function normalizarEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

/**
 * Busca as falhas mais recentes de um e-mail ou IP dentro de uma janela.
 *
 * @param {'email'|'ip'} campo Coluna usada no filtro.
 * @param {string} valor Valor procurado.
 * @param {number} desdeMs Início da janela (milissegundos).
 * @param {number} limite Máximo de linhas retornadas.
 * @returns {Promise<{created_at: string}[]>} Falhas, da mais recente para a mais antiga.
 */
async function ultimasFalhas(campo, valor, desdeMs, limite) {
  const { data, error } = await supabaseAdmin
    .from(TABELA)
    .select('created_at')
    .eq(campo, valor)
    .eq('resultado', 'falha')
    .gte('created_at', new Date(desdeMs).toISOString())
    .order('created_at', { ascending: false })
    .limit(limite);

  if (error) {
    console.error('Erro ao consultar tentativas de login:', error);
    throw new AppError(500, 'Falha ao verificar as tentativas de login');
  }
  return data ?? [];
}

/**
 * Momento do último login bem-sucedido OU do último desbloqueio feito pelo
 * professor (os dois zeram a contagem de falhas do e-mail).
 *
 * @param {string} email E-mail normalizado.
 * @returns {Promise<number>} Milissegundos (0 se nunca logou).
 */
async function ultimoSucessoMs(email) {
  const { data, error } = await supabaseAdmin
    .from(TABELA)
    .select('created_at')
    .eq('email', email)
    .in('resultado', ['sucesso', 'desbloqueio'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Erro ao consultar ultimo login:', error);
    throw new AppError(500, 'Falha ao verificar as tentativas de login');
  }
  return data ? new Date(data.created_at).getTime() : 0;
}

/**
 * Minutos que faltam até a falha mais antiga "sair" da janela e liberar o login.
 *
 * @param {{created_at: string}[]} falhas Falhas (mais recente primeiro), já no limite.
 * @param {number} limite Limite que causou o bloqueio.
 * @returns {number} Minutos (mínimo 1).
 */
function minutosParaLiberar(falhas, limite) {
  const decisiva = new Date(falhas[limite - 1].created_at).getTime();
  const liberaEm = decisiva + JANELA_MINUTOS * MINUTO;
  return Math.max(1, Math.ceil((liberaEm - Date.now()) / MINUTO));
}

/**
 * Descobre se o e-mail ou o IP estão bloqueados agora.
 *
 * @param {string} email E-mail normalizado.
 * @param {string} [ip] IP de quem tenta entrar.
 * @returns {Promise<{bloqueado: boolean, minutos: number, falhasEmail: number}>} Situação.
 */
async function avaliarEstado(email, ip) {
  const inicioJanela = Date.now() - JANELA_MINUTOS * MINUTO;

  // +1 ms: só contam as falhas DEPOIS do último login correto
  const desdeEmail = Math.max(inicioJanela, (await ultimoSucessoMs(email)) + 1);
  const falhasEmail = await ultimasFalhas('email', email, desdeEmail, LIMITE_POR_EMAIL);
  if (falhasEmail.length >= LIMITE_POR_EMAIL) {
    return {
      bloqueado: true,
      minutos: minutosParaLiberar(falhasEmail, LIMITE_POR_EMAIL),
      falhasEmail: falhasEmail.length,
    };
  }

  if (ip) {
    const falhasIp = await ultimasFalhas('ip', ip, inicioJanela, LIMITE_POR_IP);
    if (falhasIp.length >= LIMITE_POR_IP) {
      return {
        bloqueado: true,
        minutos: minutosParaLiberar(falhasIp, LIMITE_POR_IP),
        falhasEmail: falhasEmail.length,
      };
    }
  }

  return { bloqueado: false, minutos: 0, falhasEmail: falhasEmail.length };
}

/** Erro padrão de bloqueio (a mesma mensagem para e-mail ou IP). */
function erroBloqueado(minutos) {
  return new AppError(429, `Muitas tentativas de login. Tente novamente em ${minutos} minuto(s).`);
}

/**
 * Grava uma tentativa no banco.
 *
 * @param {string} email E-mail normalizado.
 * @param {string} [ip] IP de origem.
 * @param {'falha'|'sucesso'|'desbloqueio'} resultado Resultado da tentativa.
 * @returns {Promise<Object|null>} Erro do banco, se houver.
 */
async function gravar(email, ip, resultado) {
  const { error } = await supabaseAdmin.from(TABELA).insert({ email, ip: ip ?? null, resultado });
  return error ?? null;
}

/**
 * Chame ANTES de conferir a senha. Se o e-mail ou o IP estiverem bloqueados,
 * lança erro 429 e a senha nem chega a ser testada (nem a certa entra).
 *
 * @param {Object} params Parâmetros.
 * @param {string} params.email E-mail normalizado.
 * @param {string} [params.ip] IP de origem.
 * @throws {AppError} 429 se estiver bloqueado.
 */
export async function exigirNaoBloqueado({ email, ip }) {
  const estado = await avaliarEstado(email, ip);
  if (estado.bloqueado) {
    throw erroBloqueado(estado.minutos);
  }
}

/**
 * Registra uma senha errada. Se essa falha completou o limite, já responde
 * com o bloqueio; senão devolve quantas tentativas ainda restam.
 *
 * @param {Object} params Parâmetros.
 * @param {string} params.email E-mail normalizado.
 * @param {string} [params.ip] IP de origem.
 * @returns {Promise<{restantes: number}>} Tentativas restantes antes do bloqueio.
 * @throws {AppError} 429 se esta falha causou o bloqueio.
 */
export async function registrarFalha({ email, ip }) {
  const erro = await gravar(email, ip, 'falha');
  if (erro) {
    console.error('Erro ao registrar falha de login:', erro);
    throw new AppError(500, 'Falha ao registrar a tentativa de login');
  }

  const estado = await avaliarEstado(email, ip);
  if (estado.bloqueado) {
    throw erroBloqueado(estado.minutos);
  }
  return { restantes: Math.max(0, LIMITE_POR_EMAIL - estado.falhasEmail) };
}

/**
 * Registra um login correto (isso zera a contagem de falhas do e-mail).
 * Se o registro falhar, o login continua: não é uma falha de segurança.
 *
 * @param {Object} params Parâmetros.
 * @param {string} params.email E-mail normalizado.
 * @param {string} [params.ip] IP de origem.
 */
export async function registrarSucesso({ email, ip }) {
  const erro = await gravar(email, ip, 'sucesso');
  if (erro) {
    console.error('Erro ao registrar login bem-sucedido:', erro);
  }
}

/**
 * Libera o login de um e-mail que estava bloqueado por senhas erradas.
 * Usado quando o professor redefine a senha da conta. Não apaga o histórico:
 * só registra um "desbloqueio", e as falhas anteriores deixam de contar.
 *
 * @param {Object} params Parâmetros.
 * @param {string} params.email E-mail normalizado.
 */
export async function liberarBloqueio({ email }) {
  const erro = await gravar(email, null, 'desbloqueio');
  if (erro) {
    console.error('Erro ao registrar desbloqueio de login:', erro);
  }
}