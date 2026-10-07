import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middlewares/error.middleware.js';
import { registrarAuditoria } from '../utils/audit.js';

/** Limite máximo de grupos por turma (regra de negócio). */
export const LIMITE_GRUPOS_POR_TURMA = 5;

/** Limite máximo de integrantes por grupo (regra de negócio). */
export const LIMITE_INTEGRANTES_POR_GRUPO = 7;

/**
 * Busca uma turma pelo UUID e garante que ela existe.
 *
 * @param {string} turmaId UUID da turma.
 * @returns {Promise<Object>} Turma encontrada.
 * @throws {AppError} 404 se a turma não existir.
 */
async function buscarTurma(turmaId) {
  const { data: turma, error } = await supabaseAdmin
    .from('turmas')
    .select('id, nome')
    .eq('id', turmaId)
    .maybeSingle();

  if (error || !turma) {
    throw new AppError(404, 'Turma nao encontrada');
  }

  return turma;
}

/**
 * Busca um grupo pelo UUID e garante que ele existe.
 *
 * @param {string} grupoId UUID do grupo.
 * @returns {Promise<Object>} Grupo encontrado.
 * @throws {AppError} 404 se o grupo não existir.
 */
async function buscarGrupo(grupoId) {
  const { data: grupo, error } = await supabaseAdmin
    .from('grupos')
    .select('id, turma_id, nome, lider_id, vice_lider_id')
    .eq('id', grupoId)
    .maybeSingle();

  if (error || !grupo) {
    throw new AppError(404, 'Grupo nao encontrado');
  }

  return grupo;
}

/**
 * Busca um perfil pelo UUID.
 *
 * @param {string} perfilId UUID do perfil.
 * @returns {Promise<Object>} Perfil encontrado.
 * @throws {AppError} 404 se o perfil não existir.
 */
async function buscarPerfil(perfilId) {
  const { data: perfil, error } = await supabaseAdmin
    .from('profiles')
    .select('id, nome, email, role, is_active')
    .eq('id', perfilId)
    .maybeSingle();

  if (error || !perfil) {
    throw new AppError(404, 'Perfil nao encontrado');
  }

  return perfil;
}

/**
 * Lista os grupos de uma turma com líder, vice-líder e integrantes.
 *
 * @param {string} turmaId UUID da turma.
 * @returns {Promise<Array<Object>>} Lista de grupos.
 */
export async function listarGruposDaTurma(turmaId) {
  await buscarTurma(turmaId);

  const { data, error } = await supabaseAdmin
    .from('grupos')
    .select(
      'id, nome, lider_id, vice_lider_id, ' +
        'lider:profiles!lider_id(id, nome), ' +
        'vice:profiles!vice_lider_id(id, nome), ' +
        'integrantes(id, nome_aluno)'
    )
    .eq('turma_id', turmaId)
    .order('nome');

  if (error) {
    throw new AppError(500, 'Falha ao listar grupos');
  }

  return data;
}

/**
 * Cria um novo grupo na turma, respeitando o limite máximo de 5 grupos.
 *
 * @param {Object} params Parâmetros de criação.
 * @param {string} params.turmaId UUID da turma.
 * @param {string} params.nome Nome do grupo.
 * @param {string} params.professorId UUID do professor executor.
 * @returns {Promise<Object>} Grupo criado.
 * @throws {AppError} 400 se a turma já atingir o limite de grupos.
 */
export async function criarGrupo({ turmaId, nome, professorId }) {
  await buscarTurma(turmaId);

  const { count, error: countError } = await supabaseAdmin
    .from('grupos')
    .select('id', { count: 'exact', head: true })
    .eq('turma_id', turmaId);

  const total = count ?? 0;

  if (countError) {
    throw new AppError(500, 'Falha ao validar limite de grupos');
  }

  if (total >= LIMITE_GRUPOS_POR_TURMA) {
    throw new AppError(
      400,
      `A turma ja atingiu o limite maximo de ${LIMITE_GRUPOS_POR_TURMA} grupos`
    );
  }

  const { data, error } = await supabaseAdmin
    .from('grupos')
    .insert({ turma_id: turmaId, nome })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new AppError(409, 'Ja existe um grupo com esse nome nesta turma');
    }
    throw new AppError(400, `Falha ao criar grupo: ${error.message}`);
  }

  await registrarAuditoria('grupos', data.id, 'INSERT', professorId, { turma_id: turmaId, nome });

  return data;
}

/**
 * Renomeia um grupo existente.
 *
 * @param {Object} params Parâmetros de renomeação.
 * @param {string} params.grupoId UUID do grupo.
 * @param {string} params.nome Novo nome do grupo.
 * @param {string} params.professorId UUID do professor executor.
 * @returns {Promise<Object>} Grupo atualizado.
 */
export async function renomearGrupo({ grupoId, nome, professorId }) {
  await buscarGrupo(grupoId);

  const { data, error } = await supabaseAdmin
    .from('grupos')
    .update({ nome })
    .eq('id', grupoId)
    .select()
    .single();

  if (error) {
    throw new AppError(400, `Falha ao renomear grupo: ${error.message}`);
  }

  await registrarAuditoria('grupos', grupoId, 'UPDATE', professorId, { tipo: 'renomear', novo_nome: nome });

  return data;
}

/**
 * Exclui um grupo e todos os seus integrantes/avaliações (ON DELETE CASCADE).
 *
 * @param {Object} params Parâmetros de exclusão.
 * @param {string} params.grupoId UUID do grupo.
 * @param {string} params.professorId UUID do professor executor.
 * @returns {Promise<{success: boolean}>} Resultado da operação.
 */
export async function excluirGrupo({ grupoId, professorId }) {
  const grupo = await buscarGrupo(grupoId);

  const { error } = await supabaseAdmin.from('grupos').delete().eq('id', grupoId);

  if (error) {
    throw new AppError(400, `Falha ao excluir grupo: ${error.message}`);
  }

  await registrarAuditoria('grupos', grupoId, 'DELETE', professorId, { nome: grupo.nome, turma_id: grupo.turma_id });

  return { success: true };
}

/**
 * Adiciona um integrante (aluno comum, sem conta) ao grupo,
 * respeitando o limite máximo de 7 integrantes.
 *
 * @param {Object} params Parâmetros de adição.
 * @param {string} params.grupoId UUID do grupo.
 * @param {string} params.nomeAluno Nome do aluno.
 * @param {string} params.professorId UUID do professor executor.
 * @returns {Promise<Object>} Integrante criado.
 * @throws {AppError} 400 se o grupo já atingir o limite de integrantes.
 */
export async function adicionarIntegrante({ grupoId, nomeAluno, professorId }) {
  await buscarGrupo(grupoId);

  const { count, error: countError } = await supabaseAdmin
    .from('integrantes')
    .select('id', { count: 'exact', head: true })
    .eq('grupo_id', grupoId);

  const total = count ?? 0;

  if (countError) {
    throw new AppError(500, 'Falha ao validar limite de integrantes');
  }

  if (total >= LIMITE_INTEGRANTES_POR_GRUPO) {
    throw new AppError(
      400,
      `O grupo ja atingiu o limite maximo de ${LIMITE_INTEGRANTES_POR_GRUPO} integrantes`
    );
  }

  const { data, error } = await supabaseAdmin
    .from('integrantes')
    .insert({ grupo_id: grupoId, nome_aluno: nomeAluno })
    .select()
    .single();

  if (error) {
    throw new AppError(400, `Falha ao adicionar integrante: ${error.message}`);
  }

  await registrarAuditoria('integrantes', data.id, 'INSERT', professorId, {
    grupo_id: grupoId,
    nome_aluno: nomeAluno,
  });

  return data;
}

/**
 * Remove um integrante do grupo.
 *
 * @param {Object} params Parâmetros de remoção.
 * @param {string} params.grupoId UUID do grupo.
 * @param {string} params.integranteId UUID do integrante.
 * @param {string} params.professorId UUID do professor executor.
 * @returns {Promise<{success: boolean}>} Resultado da operação.
 */
export async function removerIntegrante({ grupoId, integranteId, professorId }) {
  await buscarGrupo(grupoId);

  const { data: integrante, error: buscaError } = await supabaseAdmin
    .from('integrantes')
    .select('id, nome_aluno')
    .eq('id', integranteId)
    .eq('grupo_id', grupoId)
    .maybeSingle();

  if (buscaError || !integrante) {
    throw new AppError(404, 'Integrante nao encontrado no grupo');
  }

  const { error } = await supabaseAdmin
    .from('integrantes')
    .delete()
    .eq('id', integranteId)
    .eq('grupo_id', grupoId);

  if (error) {
    throw new AppError(400, `Falha ao remover integrante: ${error.message}`);
  }

  await registrarAuditoria('integrantes', integranteId, 'DELETE', professorId, {
    grupo_id: grupoId,
    nome_aluno: integrante.nome_aluno,
  });

  return { success: true };
}

/**
 * Designa o Líder de um grupo (exclusivo do Professor).
 * Valida que o perfil possui o papel 'lider' e está ativo.
 *
 * @param {Object} params Parâmetros de designação.
 * @param {string} params.grupoId UUID do grupo.
 * @param {string} params.perfilId UUID do perfil designado.
 * @param {string} params.professorId UUID do professor executor.
 * @returns {Promise<{id: string, lider_id: string}>} Grupo atualizado.
 */
export async function designarLider({ grupoId, perfilId, professorId }) {
  const grupo = await buscarGrupo(grupoId);
  const perfil = await buscarPerfil(perfilId);

  if (perfil.role !== 'lider') {
    throw new AppError(400, 'O perfil indicado nao possui o papel de lider');
  }

  if (perfil.is_active === false) {
    throw new AppError(400, 'Perfil desativado');
  }

  if (grupo.vice_lider_id === perfilId) {
    throw new AppError(400, 'O perfil ja e o vice-lider deste grupo');
  }

  const { error } = await supabaseAdmin.from('grupos').update({ lider_id: perfilId }).eq('id', grupoId);

  if (error) {
    throw new AppError(400, `Falha ao designar lider: ${error.message}`);
  }

  await registrarAuditoria('grupos', grupoId, 'UPDATE', professorId, {
    tipo: 'designar_lider',
    perfil_id: perfilId,
  });

  return { id: grupoId, lider_id: perfilId };
}

/**
 * Designa o Vice-Líder de um grupo (exclusivo do Professor).
 * Valida que o perfil possui o papel 'vice_lider' e está ativo.
 *
 * @param {Object} params Parâmetros de designação.
 * @param {string} params.grupoId UUID do grupo.
 * @param {string} params.perfilId UUID do perfil designado.
 * @param {string} params.professorId UUID do professor executor.
 * @returns {Promise<{id: string, vice_lider_id: string}>} Grupo atualizado.
 */
export async function designarViceLider({ grupoId, perfilId, professorId }) {
  const grupo = await buscarGrupo(grupoId);
  const perfil = await buscarPerfil(perfilId);

  if (perfil.role !== 'vice_lider') {
    throw new AppError(400, 'O perfil indicado nao possui o papel de vice-lider');
  }

  if (perfil.is_active === false) {
    throw new AppError(400, 'Perfil desativado');
  }

  if (grupo.lider_id === perfilId) {
    throw new AppError(400, 'O perfil ja e o lider deste grupo');
  }

  const { error } = await supabaseAdmin
    .from('grupos')
    .update({ vice_lider_id: perfilId })
    .eq('id', grupoId);

  if (error) {
    throw new AppError(400, `Falha ao designar vice-lider: ${error.message}`);
  }

  await registrarAuditoria('grupos', grupoId, 'UPDATE', professorId, {
    tipo: 'designar_vice_lider',
    perfil_id: perfilId,
  });

  return { id: grupoId, vice_lider_id: perfilId };
}

/**
 * Obtém o detalhe completo de um grupo (página de expansão do Professor):
 * líder, vice-líder, integrantes com avaliação e média geral do grupo,
 * em um bimestre específico.
 *
 * @param {string} grupoId UUID do grupo.
 * @param {number} [bimestre=1] Bimestre a ser consultado (1 a 4).
 * @returns {Promise<Object>} Detalhe do grupo.
 * @throws {AppError} 404 se o grupo não existir.
 */
export async function obterGrupoDetalhado(grupoId, bimestre = 1) {
  const { data: grupo, error } = await supabaseAdmin
    .from('grupos')
    .select(
      'id, turma_id, nome, lider_id, vice_lider_id, ' +
        'lider:profiles!lider_id(id, nome, email), ' +
        'vice:profiles!vice_lider_id(id, nome, email)'
    )
    .eq('id', grupoId)
    .maybeSingle();

  if (error || !grupo) {
    throw new AppError(404, 'Grupo nao encontrado');
  }

  const [resultIntegrantes, resultAvaliacoes] = await Promise.all([
    supabaseAdmin.from('integrantes').select('id, nome_aluno').eq('grupo_id', grupoId).order('nome_aluno'),
    supabaseAdmin.from('avaliacoes').select('*').eq('grupo_id', grupoId).eq('bimestre', bimestre),
  ]);

  if (resultIntegrantes.error || resultAvaliacoes.error) {
    throw new AppError(500, 'Falha ao carregar detalhes do grupo');
  }

  const integrantes = resultIntegrantes.data.map((integrante) => {
    const avaliacao = resultAvaliacoes.data.find((a) => a.integrante_id === integrante.id) ?? null;
    return {
      id: integrante.id,
      nome_aluno: integrante.nome_aluno,
      avaliacao: avaliacao
        ? {
            id: avaliacao.id,
            avaliador_id: avaliacao.avaliador_id,
            bimestre: avaliacao.bimestre,
            interesse: avaliacao.interesse,
            entrega_prazo: avaliacao.entrega_prazo,
            participacao: avaliacao.participacao,
            qualidade_trabalho: avaliacao.qualidade_trabalho,
            respeito_grupo: avaliacao.respeito_grupo,
            nota_total: avaliacao.nota_total,
            alterado_por_professor: avaliacao.alterado_por_professor,
            comentario_esclarecimento: avaliacao.comentario_esclarecimento,
          }
        : null,
    };
  });

  const notas = resultAvaliacoes.data.map((a) => Number(a.nota_total)).filter((n) => !Number.isNaN(n));
  const mediaGeral = notas.length > 0 ? notas.reduce((soma, n) => soma + n, 0) / notas.length : null;

  return {
    id: grupo.id,
    turma_id: grupo.turma_id,
    nome: grupo.nome,
    lider: grupo.lider,
    vice: grupo.vice,
    bimestre,
    integrantes,
    media_geral: mediaGeral === null ? null : Number(mediaGeral.toFixed(2)),
  };
}

/**
 * Retorna o grupo do qual o usuário autenticado é Líder ou Vice-Líder.
 * Usado pela visão de Líder/Vice-Líder (mostra apenas o seu grupo).
 *
 * @param {string} userId UUID do usuário autenticado.
 * @returns {Promise<Object>} Grupo do usuário com a turma e integrantes.
 * @throws {AppError} 404 se o usuário não liderar nenhum grupo.
 */
export async function obterMeuGrupo(userId) {
  const { data: grupo, error } = await supabaseAdmin
    .from('grupos')
    .select('id, turma_id, nome, lider_id, vice_lider_id')
    .or(`lider_id.eq.${userId},vice_lider_id.eq.${userId}`)
    .maybeSingle();

  if (error || !grupo) {
    throw new AppError(404, 'Nenhum grupo encontrado para o seu perfil');
  }

  const [turma, integrantes] = await Promise.all([
    supabaseAdmin.from('turmas').select('id, nome').eq('id', grupo.turma_id).maybeSingle(),
    supabaseAdmin.from('integrantes').select('id, nome_aluno').eq('grupo_id', grupo.id).order('nome_aluno'),
  ]);

  if (turma.error || integrantes.error) {
    throw new AppError(500, 'Falha ao carregar o grupo');
  }

  return {
    id: grupo.id,
    turma_id: grupo.turma_id,
    turma_nome: turma.data?.nome ?? null,
    nome: grupo.nome,
    lider_id: grupo.lider_id,
    vice_lider_id: grupo.vice_lider_id,
    integrantes: integrantes.data,
  };
}

/**
 * Cria um grupo de forma completa: define Líder, Vice-Líder e adiciona
 * os integrantes de uma única vez (fluxo "Novo Grupo").
 *
 * Respeita os limites: máx. 5 grupos por turma e máx. 7 integrantes por grupo.
 * O Líder e o Vice-Líder devem ser perfis já cadastrados com os papéis corretos.
 *
 * @param {Object} params Parâmetros da criação.
 * @param {string} params.turmaId UUID da turma.
 * @param {string} params.nome Nome do grupo.
 * @param {string} params.liderId UUID do perfil Líder.
 * @param {string} params.viceLiderId UUID do perfil Vice-Líder.
 * @param {string[]} params.integrantes Nomes dos integrantes.
 * @param {string} params.professorId UUID do professor executor.
 * @returns {Promise<Object>} Grupo criado com seus integrantes.
 * @throws {AppError} Em caso de limites atingidos ou perfis inválidos.
 */
export async function criarGrupoCompleto({
  turmaId,
  nome,
  liderId,
  viceLiderId,
  integrantes,
  professorId,
}) {
  await buscarTurma(turmaId);

  const { count, error: countError } = await supabaseAdmin
    .from('grupos')
    .select('id', { count: 'exact', head: true })
    .eq('turma_id', turmaId);

  if (countError) {
    throw new AppError(500, 'Falha ao validar limite de grupos');
  }

  if ((count ?? 0) >= LIMITE_GRUPOS_POR_TURMA) {
    throw new AppError(400, `A turma ja atingiu o limite maximo de ${LIMITE_GRUPOS_POR_TURMA} grupos`);
  }

  const lider = await buscarPerfil(liderId);
  if (lider.role !== 'lider') {
    throw new AppError(400, 'O perfil escolhido como lider nao possui o papel de lider');
  }

  const vice = await buscarPerfil(viceLiderId);
  if (vice.role !== 'vice_lider') {
    throw new AppError(400, 'O perfil escolhido como vice-lider nao possui o papel de vice_lider');
  }

  if (liderId === viceLiderId) {
    throw new AppError(400, 'O lider e o vice-lider devem ser pessoas diferentes');
  }

  // Líder e Vice-Líder contam como integrantes do grupo (roster máximo 7).
  const membros = [lider.nome, vice.nome].map((n) => String(n).trim()).filter(Boolean);

  const nomesAlunos = (integrantes || []).map((n) => String(n).trim()).filter(Boolean);
  for (const aluno of nomesAlunos) {
    if (!membros.includes(aluno)) {
      membros.push(aluno);
    }
  }

  if (membros.length > LIMITE_INTEGRANTES_POR_GRUPO) {
    throw new AppError(400, `Maximo de ${LIMITE_INTEGRANTES_POR_GRUPO} integrantes por grupo (incluindo lider e vice-lider)`);
  }

  const { data: grupo, error } = await supabaseAdmin
    .from('grupos')
    .insert({ turma_id: turmaId, nome, lider_id: liderId, vice_lider_id: viceLiderId })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new AppError(409, 'Ja existe um grupo com esse nome nesta turma');
    }
    throw new AppError(400, `Falha ao criar grupo: ${error.message}`);
  }

  await registrarAuditoria('grupos', grupo.id, 'INSERT', professorId, {
    turma_id: turmaId,
    nome,
    lider_id: liderId,
    vice_lider_id: viceLiderId,
  });

  const integrantesCriados = [];
  for (const nomeMembro of membros) {
    const { data: integrante, error: integranteError } = await supabaseAdmin
      .from('integrantes')
      .insert({ grupo_id: grupo.id, nome_aluno: nomeMembro })
      .select()
      .single();

    if (integranteError) {
      throw new AppError(400, `Falha ao adicionar integrante: ${integranteError.message}`);
    }

    integrantesCriados.push(integrante);
    await registrarAuditoria('integrantes', integrante.id, 'INSERT', professorId, {
      grupo_id: grupo.id,
      nome_aluno: nomeMembro,
    });
  }

  return {
    id: grupo.id,
    turma_id: turmaId,
    nome,
    lider_id: liderId,
    vice_lider_id: viceLiderId,
    integrantes: integrantesCriados.map((i) => i.nome_aluno),
  };
}

/**
 * Renomeia um integrante do grupo.
 *
 * @param {Object} params Parâmetros da operação.
 * @param {string} params.grupoId UUID do grupo.
 * @param {string} params.integranteId UUID do integrante.
 * @param {string} params.nomeAluno Novo nome do integrante.
 * @param {string} params.professorId UUID do professor executor.
 * @returns {Promise<Object>} Integrante atualizado.
 */
export async function renomearIntegrante({ grupoId, integranteId, nomeAluno, professorId }) {
  await buscarGrupo(grupoId);

  const { data: integrante, error: buscaError } = await supabaseAdmin
    .from('integrantes')
    .select('id, nome_aluno')
    .eq('id', integranteId)
    .eq('grupo_id', grupoId)
    .maybeSingle();

  if (buscaError || !integrante) {
    throw new AppError(404, 'Integrante nao encontrado no grupo');
  }

  const nome = String(nomeAluno).trim();
  if (!nome) {
    throw new AppError(400, 'O nome do aluno e obrigatorio');
  }

  const { data, error } = await supabaseAdmin
    .from('integrantes')
    .update({ nome_aluno: nome })
    .eq('id', integranteId)
    .eq('grupo_id', grupoId)
    .select()
    .single();

  if (error) {
    throw new AppError(400, `Falha ao renomear integrante: ${error.message}`);
  }

  await registrarAuditoria('integrantes', integranteId, 'UPDATE', professorId, {
    grupo_id: grupoId,
    nome_antigo: integrante.nome_aluno,
    nome_novo: nome,
  });

  return data;
}
