import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middlewares/error.middleware.js';
import { registrarAuditoria } from '../utils/audit.js';

/** Ordena objetos pelo campo nome (pt-BR). */
const porNome = (a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR');

/**
 * Garante que todas as turmas informadas existem e que há pelo menos uma.
 *
 * @param {string[]} turmaIds UUIDs das turmas escolhidas.
 * @returns {Promise<Array<{id: string, nome: string}>>} Turmas encontradas (sem repetição).
 * @throws {AppError} 400 se não houver turma ou se alguma for inválida.
 */
export async function validarTurmas(turmaIds) {
  const ids = [...new Set(turmaIds ?? [])];

  if (ids.length === 0) {
    throw new AppError(400, 'Escolha pelo menos uma turma para o avaliador');
  }

  const { data, error } = await supabaseAdmin.from('turmas').select('id, nome').in('id', ids);

  if (error) {
    throw new AppError(500, 'Falha ao validar as turmas');
  }

  if ((data ?? []).length !== ids.length) {
    throw new AppError(400, 'Uma ou mais turmas escolhidas sao invalidas');
  }

  return [...data].sort(porNome);
}

/**
 * Vincula um avaliador às turmas informadas (sem remover as que já existem).
 *
 * @param {string} avaliadorId UUID do avaliador.
 * @param {string[]} turmaIds UUIDs das turmas.
 * @returns {Promise<void>}
 * @throws {AppError} 500 se a gravação falhar.
 */
export async function vincularTurmas(avaliadorId, turmaIds) {
  const linhas = turmaIds.map((turmaId) => ({ avaliador_id: avaliadorId, turma_id: turmaId }));
  const { error } = await supabaseAdmin.from('avaliador_turmas').insert(linhas);

  if (error) {
    throw new AppError(500, 'Falha ao vincular as turmas do avaliador');
  }
}

/**
 * Lista todos os avaliadores ativos com as turmas em que cada um avalia
 * (quadro "Avaliadores e turmas" do painel do professor).
 *
 * Cada avaliador traz também total_avaliacoes (quantas avaliações de banca ele já
 * registrou), usado no aviso antes de excluí-lo.
 *
 * @returns {Promise<Array<{id: string, nome: string, email: string, total_avaliacoes: number, turmas: Array<{id: string, nome: string}>}>>}
 */
export async function listarAvaliadoresComTurmas() {
  const { data: avaliadores, error } = await supabaseAdmin
    .from('profiles')
    .select('id, nome, email')
    .eq('role', 'avaliador')
    .eq('is_active', true)
    .order('nome');

  if (error) {
    throw new AppError(500, 'Falha ao listar avaliadores');
  }

  const lista = avaliadores ?? [];
  if (lista.length === 0) return [];

  const ids = lista.map((a) => a.id);

  const [vinculos, turmas, banca] = await Promise.all([
    supabaseAdmin.from('avaliador_turmas').select('avaliador_id, turma_id').in('avaliador_id', ids),
    supabaseAdmin.from('turmas').select('id, nome').order('nome'),
    supabaseAdmin.from('avaliacoes_banca').select('avaliador_id').in('avaliador_id', ids),
  ]);

  if (vinculos.error || turmas.error || banca.error) {
    throw new AppError(500, 'Falha ao listar as turmas dos avaliadores');
  }

  const turmasPorId = Object.fromEntries((turmas.data ?? []).map((t) => [t.id, t]));

  return lista.map((avaliador) => ({
    id: avaliador.id,
    nome: avaliador.nome,
    email: avaliador.email,
    total_avaliacoes: (banca.data ?? []).filter((b) => b.avaliador_id === avaliador.id).length,
    turmas: (vinculos.data ?? [])
      .filter((v) => v.avaliador_id === avaliador.id)
      .map((v) => turmasPorId[v.turma_id])
      .filter(Boolean)
      .sort(porNome),
  }));
}

/**
 * Turmas em que o avaliador logado pode avaliar (usado no painel do avaliador).
 *
 * @param {string} avaliadorId UUID do avaliador.
 * @returns {Promise<Array<{id: string, nome: string}>>} Turmas vinculadas.
 */
export async function turmasDoAvaliador(avaliadorId) {
  const { data, error } = await supabaseAdmin
    .from('avaliador_turmas')
    .select('turma:turmas(id, nome)')
    .eq('avaliador_id', avaliadorId);

  if (error) {
    throw new AppError(500, 'Falha ao carregar as turmas do avaliador');
  }

  return (data ?? [])
    .map((vinculo) => vinculo.turma)
    .filter(Boolean)
    .sort(porNome);
}

/**
 * Define o conjunto de turmas de um avaliador já cadastrado (professor).
 *
 * Não apaga e recria: primeiro ADICIONA as turmas novas e só depois REMOVE as
 * desmarcadas, então uma falha no meio nunca deixa o avaliador sem acesso.
 * Avaliações já feitas pelo avaliador não são tocadas.
 *
 * @param {Object} dados Dados da alteração.
 * @param {string} dados.avaliadorId UUID do avaliador.
 * @param {string[]} dados.turmaIds UUIDs das turmas que ele deve ter (pelo menos uma).
 * @param {string} professorId UUID do professor executor.
 * @returns {Promise<{id: string, nome: string, turma_ids: string[], turmas: Array<{id: string, nome: string}>}>}
 * @throws {AppError} 404 se o perfil não existir; 400 se não for avaliador ou turmas inválidas.
 */
export async function definirTurmasDoAvaliador({ avaliadorId, turmaIds }, professorId) {
  const { data: perfil, error: perfilError } = await supabaseAdmin
    .from('profiles')
    .select('id, nome, role')
    .eq('id', avaliadorId)
    .maybeSingle();

  if (perfilError || !perfil) {
    throw new AppError(404, 'Avaliador nao encontrado');
  }

  if (perfil.role !== 'avaliador') {
    throw new AppError(400, 'O perfil indicado nao e um avaliador');
  }

  const turmas = await validarTurmas(turmaIds);
  const novas = turmas.map((t) => t.id);

  const { data: atuaisLinhas, error: atuaisError } = await supabaseAdmin
    .from('avaliador_turmas')
    .select('turma_id')
    .eq('avaliador_id', avaliadorId);

  if (atuaisError) {
    throw new AppError(500, 'Falha ao consultar as turmas atuais do avaliador');
  }

  const atuais = (atuaisLinhas ?? []).map((l) => l.turma_id);
  const aAdicionar = novas.filter((id) => !atuais.includes(id));
  const aRemover = atuais.filter((id) => !novas.includes(id));

  if (aAdicionar.length > 0) {
    await vincularTurmas(avaliadorId, aAdicionar);
  }

  if (aRemover.length > 0) {
    const { error: removerError } = await supabaseAdmin
      .from('avaliador_turmas')
      .delete()
      .eq('avaliador_id', avaliadorId)
      .in('turma_id', aRemover);

    if (removerError) {
      throw new AppError(500, 'Falha ao remover turmas do avaliador');
    }
  }

  await registrarAuditoria('avaliador_turmas', avaliadorId, 'UPDATE', professorId, {
    tipo: 'definir_turmas_avaliador',
    turmas_antes: atuais,
    turmas_depois: novas,
  });

  return { id: perfil.id, nome: perfil.nome, turma_ids: novas, turmas };
}

/**
 * Se quem pede é avaliador, garante que a turma está entre as dele.
 * Professor, líder e vice passam direto (sem consulta ao banco).
 *
 * @param {Object} usuario Usuário autenticado.
 * @param {string} turmaId UUID da turma.
 * @returns {Promise<void>}
 * @throws {AppError} 403 se o avaliador não estiver vinculado à turma.
 */
export async function garantirAvaliadorNaTurma(usuario, turmaId) {
  if (usuario?.role !== 'avaliador') return;

  const { data, error } = await supabaseAdmin
    .from('avaliador_turmas')
    .select('turma_id')
    .eq('avaliador_id', usuario.id)
    .eq('turma_id', turmaId)
    .maybeSingle();

  if (error) {
    throw new AppError(500, 'Falha ao verificar o acesso do avaliador');
  }

  if (!data) {
    throw new AppError(403, 'Voce nao tem acesso aos projetos desta turma');
  }
}

/**
 * Igual a garantirAvaliadorNaTurma, mas a partir do UUID de um grupo.
 *
 * @param {Object} usuario Usuário autenticado.
 * @param {string} grupoId UUID do grupo.
 * @returns {Promise<void>}
 * @throws {AppError} 404 se o grupo não existir; 403 se a turma dele não for do avaliador.
 */
export async function garantirAvaliadorNoGrupo(usuario, grupoId) {
  if (usuario?.role !== 'avaliador') return;

  const { data: grupo, error } = await supabaseAdmin
    .from('grupos')
    .select('turma_id')
    .eq('id', grupoId)
    .maybeSingle();

  if (error || !grupo) {
    throw new AppError(404, 'Grupo nao encontrado');
  }

  await garantirAvaliadorNaTurma(usuario, grupo.turma_id);
}

/**
 * Exclui um avaliador (exclusivo do Professor): remove a conta de acesso e o
 * perfil. Os vínculos com turmas saem junto. As avaliações de banca que ele já
 * registrou são apagadas junto com o perfil (o histórico de auditoria é mantido,
 * sem o nome dele). Só funciona para perfis com o papel 'avaliador'.
 *
 * @param {Object} dados Dados da exclusão.
 * @param {string} dados.avaliadorId UUID do avaliador.
 * @param {string} professorId UUID do professor executor.
 * @returns {Promise<{success: boolean, id: string, nome: string}>} Resultado.
 * @throws {AppError} 404 se não existir; 400 se não for avaliador ou se o banco impedir a exclusão.
 */
export async function excluirAvaliador({ avaliadorId }, professorId) {
  const { data: perfil, error: perfilError } = await supabaseAdmin
    .from('profiles')
    .select('id, nome, email, role')
    .eq('id', avaliadorId)
    .maybeSingle();

  if (perfilError || !perfil) {
    throw new AppError(404, 'Avaliador nao encontrado');
  }

  if (perfil.role !== 'avaliador') {
    throw new AppError(400, 'So e possivel excluir perfis de avaliador por aqui');
  }

  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(avaliadorId);

  if (authError) {
    console.error('Falha ao excluir o avaliador', avaliadorId, authError.message);
    throw new AppError(
      400,
      'Nao foi possivel excluir o avaliador. Verifique se ha registros ligados a ele e tente novamente.'
    );
  }

  // O perfil sai junto com a conta (ON DELETE CASCADE); isto garante que nao sobra linha solta.
  const { error: limparError } = await supabaseAdmin.from('profiles').delete().eq('id', avaliadorId);
  if (limparError) {
    console.error('Falha ao limpar o perfil do avaliador excluido', avaliadorId, limparError.message);
  }

  await registrarAuditoria('profiles', avaliadorId, 'DELETE', professorId, {
    tipo: 'excluir_avaliador',
    nome: perfil.nome,
    email: perfil.email,
  });

  return { success: true, id: perfil.id, nome: perfil.nome };
}