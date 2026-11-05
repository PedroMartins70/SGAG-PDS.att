import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middlewares/error.middleware.js';
import { registrarAuditoria } from '../utils/audit.js';

/** Papéis cujo e-mail de acesso o professor pode alterar. */
const PAPEIS_COM_EMAIL_EDITAVEL = ['lider', 'vice_lider', 'avaliador'];

/**
 * Cria a conta de acesso (auth.users) e o perfil (profiles) de um
 * Líder ou Vice-Líder. Executado apenas pelo Professor.
 *
 * O usuário é criado com user_metadata { role, nome }; a trigger do banco
 * valida o papel e cria o perfil automaticamente em profiles.
 *
 * Bloqueios de segurança aplicados:
 * - Segundo professor: rejeitado (role === 'professor').
 * - Aluno comum: rejeitado (role === 'aluno') — alunos não possuem conta.
 *
 * @param {Object} dados Dados validados do novo perfil.
 * @param {string} dados.nome Nome completo.
 * @param {string} dados.email E-mail único.
 * @param {string} dados.senha Senha de acesso.
 * @param {'lider'|'vice_lider'} dados.role Papel do novo perfil.
 * @param {string} professorId UUID do professor executor.
 * @returns {Promise<{id: string, nome: string, email: string, role: string}>} Perfil criado.
 * @throws {AppError} Em caso de tentativa de segundo professor, aluno comum ou falha de criação.
 */
export async function criarPerfil({ nome, email, senha, role }, professorId) {
  if (role === 'professor') {
    throw new AppError(400, 'Nao e permitido criar um segundo professor');
  }

  if (role === 'aluno') {
    throw new AppError(400, 'Alunos comuns nao possuem conta de acesso no sistema');
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
    throw new AppError(400, 'Nao foi possivel criar o perfil. Verifique os dados e tente novamente.');
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

  await registrarAuditoria('profiles', userId, 'INSERT', professorId, { nome, email, role });

  return { id: perfil.id, nome: perfil.nome, email: perfil.email, role: perfil.role };
}

/**
 * Lista perfis de Líder e Vice-Líder (útil para o Professor escolher papéis).
 *
 * @param {'lider'|'vice_lider'|undefined} role Filtro opcional por papel.
 * @returns {Promise<Array<Object>>} Lista de perfis ativos.
 */
export async function listarPerfis(role) {
  let query = supabaseAdmin
    .from('profiles')
    .select('id, nome, email, role, is_active')
    .eq('is_active', true)
    .in('role', ['lider', 'vice_lider'])
    .order('nome');

  if (role) {
    query = query.eq('role', role);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError(500, 'Falha ao listar perfis');
  }

  return data;
}

/**
 * Troca o e-mail de acesso de uma conta (Líder, Vice-Líder ou Avaliador).
 * Executado apenas pelo Professor.
 *
 * O e-mail de login fica em dois lugares (Supabase Auth e tabela profiles), então
 * os dois são atualizados. Se a atualização do perfil falhar, o login volta ao
 * e-mail antigo para os dois não ficarem diferentes. A senha não muda e não é
 * enviado e-mail de confirmação.
 *
 * @param {Object} dados Dados da troca.
 * @param {string} dados.perfilId UUID do perfil que terá o e-mail trocado.
 * @param {string} dados.novoEmail Novo e-mail (já validado, sem espaços e em minúsculas).
 * @param {string} professorId UUID do professor executor.
 * @returns {Promise<{id: string, nome: string, email: string, role: string}>} Perfil atualizado.
 * @throws {AppError} Perfil inexistente, papel não permitido, e-mail igual ou já em uso.
 */
export async function trocarEmail({ perfilId, novoEmail }, professorId) {
  const { data: perfil, error: buscaError } = await supabaseAdmin
    .from('profiles')
    .select('id, nome, email, role')
    .eq('id', perfilId)
    .maybeSingle();

  if (buscaError || !perfil) {
    throw new AppError(404, 'Conta nao encontrada');
  }

  if (!PAPEIS_COM_EMAIL_EDITAVEL.includes(perfil.role)) {
    throw new AppError(400, 'So e possivel trocar o e-mail de lider, vice-lider ou avaliador');
  }

  const emailAntigo = String(perfil.email || '').toLowerCase();
  if (emailAntigo === novoEmail) {
    throw new AppError(400, 'O novo e-mail e igual ao atual');
  }

  const { data: emUso, error: usoError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', novoEmail)
    .neq('id', perfilId)
    .maybeSingle();

  if (usoError) {
    throw new AppError(500, 'Falha ao validar o novo e-mail');
  }

  if (emUso) {
    throw new AppError(409, 'Este e-mail ja esta cadastrado em outra conta');
  }

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(perfilId, {
    email: novoEmail,
    email_confirm: true,
  });

  if (authError) {
    if (/already|registered|duplicate|exist/i.test(authError.message || '')) {
      throw new AppError(409, 'Este e-mail ja esta cadastrado em outra conta');
    }
    throw new AppError(400, 'Nao foi possivel alterar o e-mail. Tente novamente.');
  }

  const { error: perfilError } = await supabaseAdmin
    .from('profiles')
    .update({ email: novoEmail })
    .eq('id', perfilId);

  if (perfilError) {
    // Desfaz a troca no login para o Auth e o perfil continuarem iguais
    const { error: desfazerError } = await supabaseAdmin.auth.admin.updateUserById(perfilId, {
      email: perfil.email,
      email_confirm: true,
    });
    if (desfazerError) {
      console.error('Falha ao desfazer a troca de e-mail', perfilId, desfazerError.message);
    }
    throw new AppError(500, 'Falha ao atualizar o e-mail. Tente novamente.');
  }

  await registrarAuditoria('profiles', perfilId, 'UPDATE', professorId, {
    tipo: 'alterar_email',
    email_antigo: perfil.email,
    email_novo: novoEmail,
  });

  return { id: perfil.id, nome: perfil.nome, email: novoEmail, role: perfil.role };
}