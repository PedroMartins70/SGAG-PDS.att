import { randomInt } from 'node:crypto';
import { supabaseAdmin, criarClienteAuth } from '../config/supabase.js';
import { AppError } from '../middlewares/error.middleware.js';
import { registrarAuditoria } from '../utils/audit.js';
import {
  exigirNaoBloqueado,
  liberarBloqueio,
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
    .select('id, nome, email, role, is_active, senha_temporaria')
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

// ============================================================================
// REDEFINIÇÃO DE SENHA
// ============================================================================

/** Perfis cujas senhas o professor pode redefinir (nunca a do próprio professor). */
const PERFIS_REDEFINIVEIS = ['lider', 'vice_lider', 'avaliador'];

// Sem caracteres confusos (0/O, 1/l/I) para facilitar a leitura e o repasse
const MAIUSCULAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MINUSCULAS = 'abcdefghijkmnpqrstuvwxyz';
const NUMEROS = '23456789';
const SIMBOLOS = '!@#$%&*?';

/**
 * Gera uma senha temporária aleatória de 12 caracteres (3 maiúsculas,
 * 5 minúsculas, 3 números e 1 símbolo), usando o gerador seguro do Node.
 *
 * @returns {string} Senha temporária.
 */
export function gerarSenhaTemporaria() {
  const sortear = (conjunto, quantidade) =>
    Array.from({ length: quantidade }, () => conjunto[randomInt(conjunto.length)]);

  const caracteres = [
    ...sortear(MAIUSCULAS, 3),
    ...sortear(MINUSCULAS, 5),
    ...sortear(NUMEROS, 3),
    ...sortear(SIMBOLOS, 1),
  ];

  // Embaralha (Fisher-Yates) para o símbolo e os números não ficarem em posição fixa
  for (let i = caracteres.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join('');
}

/** Só o professor passa. */
function exigirProfessor(usuario) {
  if (usuario?.role !== 'professor') {
    throw new AppError(403, 'Apenas o professor pode fazer isso');
  }
}

/**
 * Lista as contas que o professor pode redefinir (líder, vice-líder e avaliador).
 *
 * @param {Object} usuario Usuário autenticado (precisa ser o professor).
 * @returns {Promise<Object[]>} Contas, em ordem alfabética.
 */
export async function listarUsuariosRedefiniveis(usuario) {
  exigirProfessor(usuario);

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, nome, email, role, is_active, senha_temporaria')
    .in('role', PERFIS_REDEFINIVEIS)
    .order('nome', { ascending: true });

  if (error) {
    throw new AppError(500, 'Falha ao listar as contas');
  }
  return data ?? [];
}

/**
 * O professor redefine a senha de uma conta: o sistema gera uma senha temporária,
 * troca a senha no Supabase, marca a conta para exigir uma senha nova no próximo
 * login e libera o login caso a conta estivesse bloqueada por senhas erradas.
 * A senha temporária é devolvida UMA vez, para o professor repassar; ela não é
 * guardada em lugar nenhum (nem no log de auditoria).
 *
 * @param {Object} params Parâmetros.
 * @param {string} params.perfilId UUID da conta a redefinir.
 * @param {Object} params.usuario Professor autenticado.
 * @returns {Promise<{perfil: Object, senha_temporaria: string}>} Conta e senha temporária.
 * @throws {AppError} 403 se não for professor ou a conta não puder ser redefinida; 404 se não existir.
 */
export async function redefinirSenhaPorProfessor({ perfilId, usuario }) {
  exigirProfessor(usuario);

  const { data: alvo } = await supabaseAdmin
    .from('profiles')
    .select('id, nome, email, role, senha_temporaria')
    .eq('id', perfilId)
    .maybeSingle();

  if (!alvo) {
    throw new AppError(404, 'Conta nao encontrada');
  }
  if (!PERFIS_REDEFINIVEIS.includes(alvo.role)) {
    throw new AppError(403, 'So e possivel redefinir a senha de lider, vice-lider ou avaliador');
  }

  const senha = gerarSenhaTemporaria();

  // Primeiro marca a conta; se isso falhar, nada mudou.
  const { error: erroMarca } = await supabaseAdmin
    .from('profiles')
    .update({ senha_temporaria: true })
    .eq('id', alvo.id);
  if (erroMarca) {
    console.error('Erro ao marcar senha temporaria:', erroMarca);
    throw new AppError(500, 'Nao foi possivel redefinir a senha');
  }

  const { error: erroSenha } = await supabaseAdmin.auth.admin.updateUserById(alvo.id, { password: senha });
  if (erroSenha) {
    console.error('Erro ao redefinir senha:', erroSenha);
    await supabaseAdmin.from('profiles').update({ senha_temporaria: alvo.senha_temporaria }).eq('id', alvo.id);
    throw new AppError(400, 'Nao foi possivel redefinir a senha');
  }

  await liberarBloqueio({ email: normalizarEmail(alvo.email) });

  await registrarAuditoria('profiles', alvo.id, 'UPDATE', usuario.id, {
    acao: 'redefinicao_senha_pelo_professor',
    nome: alvo.nome,
    email: alvo.email,
    role: alvo.role,
  });

  return {
    perfil: { id: alvo.id, nome: alvo.nome, email: alvo.email, role: alvo.role },
    senha_temporaria: senha,
  };
}

/**
 * O próprio usuário troca a senha (obrigatório depois de uma senha temporária).
 * Confere a senha atual primeiro, com a mesma proteção contra força bruta do login.
 *
 * @param {Object} params Parâmetros.
 * @param {Object} params.usuario Usuário autenticado.
 * @param {string} params.senhaAtual Senha atual.
 * @param {string} params.novaSenha Nova senha (já validada).
 * @param {string} [params.ip] IP de origem.
 * @returns {Promise<{success: boolean}>} Resultado.
 * @throws {AppError} 401 se a senha atual estiver errada; 429 se bloqueado.
 */
export async function trocarSenha({ usuario, senhaAtual, novaSenha, ip }) {
  const perfil = await obterPerfil(usuario.id);
  const email = normalizarEmail(perfil.email);

  await exigirNaoBloqueado({ email, ip });

  const { data, error } = await criarClienteAuth().auth.signInWithPassword({
    email,
    password: senhaAtual,
  });

  if (error || !data?.user) {
    if (error && (error.status >= 500 || error.name === 'AuthRetryableFetchError')) {
      throw new AppError(503, 'Servico de autenticacao indisponivel. Tente novamente em instantes.');
    }
    const { restantes } = await registrarFalha({ email, ip });
    throw new AppError(
      401,
      `Senha atual incorreta. Restam ${restantes} tentativa(s) antes do bloqueio temporario.`
    );
  }

  const { error: erroSenha } = await supabaseAdmin.auth.admin.updateUserById(usuario.id, {
    password: novaSenha,
  });
  if (erroSenha) {
    console.error('Erro ao trocar senha:', erroSenha);
    throw new AppError(400, 'Nao foi possivel alterar a senha. Tente outra senha.');
  }

  const { error: erroMarca } = await supabaseAdmin
    .from('profiles')
    .update({ senha_temporaria: false })
    .eq('id', usuario.id);
  if (erroMarca) {
    console.error('Erro ao limpar marca de senha temporaria:', erroMarca);
  }

  await registrarSucesso({ email, ip });
  await registrarAuditoria('profiles', usuario.id, 'UPDATE', usuario.id, { acao: 'troca_de_senha' });
  return { success: true };
}