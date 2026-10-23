import { supabaseAdmin, criarClienteAuth } from '../config/supabase.js';
import { AppError } from '../middlewares/error.middleware.js';
import { registrarAuditoria } from '../utils/audit.js';
import {
  exigirNaoBloqueado,
  normalizarEmail,
  registrarFalha,
  registrarSucesso,
} from './loginSeguranca.service.js';

/**
 * Autentica um usuário no Supabase Auth e retorna a sessão JWT
 * juntamente com o perfil ativo do sistema.
 *
 * O login usa um cliente Supabase NOVO e descartável (criarClienteAuth) para
 * que a sessão do usuário nunca "contamine" o supabaseAdmin compartilhado.
 * Se contaminasse, as escritas seguintes seriam feitas como usuário comum
 * (role authenticated) e seriam bloqueadas pelo RLS.
 *
 * Proteção contra força bruta:
 * - Depois de várias senhas erradas seguidas no mesmo e-mail (ou do mesmo IP),
 *   o login é bloqueado temporariamente (erro 429), mesmo que a senha certa
 *   seja digitada durante o bloqueio.
 * - A mensagem de erro é SEMPRE a mesma ("e-mail ou senha incorretos"), exista
 *   a conta ou não, para o atacante não descobrir quais e-mails estão cadastrados.
 *
 * @param {Object} dados Dados de login validados.
 * @param {string} dados.email E-mail do usuário.
 * @param {string} dados.senha Senha do usuário.
 * @param {string} [dados.ip] IP de origem da requisição.
 * @returns {Promise<{session: Object, user: Object}>} Sessão e perfil autenticados.
 * @throws {AppError} 401 (credenciais), 429 (bloqueado) ou 403 (perfil desativado).
 */
export async function login({ email, senha, ip }) {
  const emailNormalizado = normalizarEmail(email);

  await exigirNaoBloqueado({ email: emailNormalizado, ip });

  const clienteAuth = criarClienteAuth();
  const { data, error } = await clienteAuth.auth.signInWithPassword({
    email: emailNormalizado,
    password: senha,
  });

  if (error || !data?.user) {
    // Problema do serviço de autenticação (não é senha errada): não conta como falha
    if (error && (error.status >= 500 || error.name === 'AuthRetryableFetchError')) {
      throw new AppError(503, 'Servico de autenticacao indisponivel. Tente novamente em instantes.');
    }

    const { restantes } = await registrarFalha({ email: emailNormalizado, ip });
    throw new AppError(
      401,
      `E-mail ou senha incorretos. Restam ${restantes} tentativa(s) antes do bloqueio temporario.`
    );
  }

  await registrarSucesso({ email: emailNormalizado, ip });

  const { data: perfil, error: perfilError } = await supabaseAdmin
    .from('profiles')
    .select('id, nome, email, role, is_active')
    .eq('id', data.user.id)
    .maybeSingle();

  if (perfilError || !perfil) {
    throw new AppError(401, 'Usuario sem perfil autorizado no sistema');
  }

  if (perfil.is_active === false) {
    throw new AppError(403, 'Perfil desativado');
  }

  return { session: data.session, user: perfil };
}

/**
 * Retorna o perfil ativo de um usuário pelo seu UUID.
 *
 * @param {string} userId UUID do usuário (auth.users / profiles.id).
 * @returns {Promise<Object>} Perfil do usuário.
 * @throws {AppError} Se o perfil não for encontrado.
 */
export async function obterPerfil(userId) {
  const { data: perfil, error } = await supabaseAdmin
    .from('profiles')
    .select('id, nome, email, role, is_active')
    .eq('id', userId)
    .maybeSingle();

  if (error || !perfil) {
    throw new AppError(404, 'Perfil nao encontrado');
  }

  return perfil;
}

/**
 * Cadastra um novo perfil (Professor, Líder ou Vice-Líder) via auto-registro.
 *
 * O usuário é criado com user_metadata { role, nome }; o trigger do banco
 * (handle_new_user) valida o papel e cria o perfil automaticamente em profiles.
 *
 * - Professor: apenas um permitido (índice único no banco + verificação aqui).
 * - Líder/Vice-Líder: cadastro livre; o Professor designa o grupo depois.
 *
 * @param {Object} dados Dados validados do cadastro.
 * @param {string} dados.nome Nome completo.
 * @param {string} dados.email E-mail.
 * @param {string} dados.senha Senha forte.
 * @param {'professor'|'lider'|'vice_lider'} dados.role Papel a cadastrar.
 * @returns {Promise<{id: string, nome: string, email: string, role: string}>} Perfil criado.
 * @throws {AppError} Se já existir professor ou o e-mail já estiver em uso.
 */
export async function registrarUsuario({ nome, email, senha, role }) {
  if (role === 'professor') {
    const { count, error: countError } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'professor');

    if (countError) {
      throw new AppError(500, 'Falha ao validar cadastro');
    }

    if ((count ?? 0) > 0) {
      throw new AppError(409, 'Ja existe um professor cadastrado no sistema');
    }
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { role, nome },
  });

  if (error || !data?.user) {
    const mensagem = error?.message || '';
    if (/already|registered|duplicate|exist/i.test(mensagem)) {
      throw new AppError(400, 'Este e-mail ja esta cadastrado.');
    }
    if (/professor|single|unique/i.test(mensagem)) {
      throw new AppError(409, 'Ja existe um professor cadastrado no sistema');
    }
    throw new AppError(400, 'Nao foi possivel criar a conta. Verifique os dados e tente novamente.');
  }

  const userId = data.user.id;

  // A trigger já criou o perfil; apenas o buscamos para retornar.
  const { data: perfil, error: perfilError } = await supabaseAdmin
    .from('profiles')
    .select('id, nome, email, role, is_active')
    .eq('id', userId)
    .maybeSingle();

  if (perfilError || !perfil) {
    throw new AppError(500, 'Falha ao criar o perfil. Tente novamente.');
  }

  await registrarAuditoria('profiles', userId, 'INSERT', userId, {
    acao: 'cadastro',
    nome,
    email,
    role,
  });

  return { id: perfil.id, nome: perfil.nome, email: perfil.email, role: perfil.role };
}