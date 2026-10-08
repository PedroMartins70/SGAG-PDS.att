import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middlewares/error.middleware.js';
import { registrarAuditoria } from '../utils/audit.js';

/**
 * Busca um grupo e garante que ele existe.
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
 * Busca um integrante e garante que pertence ao grupo informado.
 *
 * @param {string} grupoId UUID do grupo.
 * @param {string} integranteId UUID do integrante.
 * @returns {Promise<Object>} Integrante encontrado.
 * @throws {AppError} 404 se o integrante não pertencer ao grupo.
 */
async function buscarIntegranteDoGrupo(grupoId, integranteId) {
  const { data: integrante, error } = await supabaseAdmin
    .from('integrantes')
    .select('id, nome_aluno')
    .eq('id', integranteId)
    .eq('grupo_id', grupoId)
    .maybeSingle();

  if (error || !integrante) {
    throw new AppError(404, 'Integrante nao encontrado no grupo');
  }

  return integrante;
}

/**
 * Valida se o bimestre informado é válido (1 a 4).
 *
 * @param {number} bimestre Bimestre informado.
 * @throws {AppError} 400 se o bimestre for inválido.
 */
function validarBimestre(bimestre) {
  const valor = Number(bimestre);
  if (!valor || valor < 1 || valor > 4) {
    throw new AppError(400, 'Bimestre invalido (deve ser um numero entre 1 e 4)');
  }
  return valor;
}

/**
 * Calcula a permissão de edição de avaliações para o usuário no grupo,
 * para um bimestre específico.
 *
 * Regras:
 * - Professor: sempre pode editar.
 * - Líder: pode editar (se for o líder do grupo), exceto avaliações já
 *   alteradas pelo professor (controlado individualmente por integrante).
 * - Vice-Líder: pode editar apenas se o Líder ainda não tiver submetido
 *   neste bimestre.
 *
 * @param {Object} grupo Grupo consultado.
 * @param {Object[]} avaliacoesDoBimestre Avaliações existentes do grupo neste bimestre.
 * @param {Object} usuario Usuário autenticado.
 * @returns {{podeEditar: boolean, motivo: string|null, liderSubmeteu: boolean}} Resultado da análise.
 */
function calcularPermissao(grupo, avaliacoesDoBimestre, usuario) {
  const liderSubmeteu = avaliacoesDoBimestre.some((a) => a.avaliador_id === grupo.lider_id);

  let podeEditar = false;
  let motivo = null;

  if (usuario.role === 'professor') {
    podeEditar = true;
  } else if (usuario.role === 'lider') {
    podeEditar = usuario.id === grupo.lider_id;
    if (!podeEditar) motivo = 'Voce nao e o lider deste grupo';
  } else if (usuario.role === 'vice_lider') {
    podeEditar = usuario.id === grupo.vice_lider_id;
    if (!podeEditar) {
      motivo = 'Voce nao e o vice-lider deste grupo';
    } else if (liderSubmeteu) {
      podeEditar = false;
      motivo = 'O lider ja submeteu as notas; formulario em modo somente leitura';
    }
  } else {
    motivo = 'Perfil sem permissao para avaliar';
  }

  return { podeEditar, motivo, liderSubmeteu };
}

/**
 * Lista as avaliações do grupo em um bimestre específico, juntamente com
 * os integrantes e a permissão de edição do usuário autenticado.
 *
 * @param {string} grupoId UUID do grupo.
 * @param {Object} usuario Usuário autenticado.
 * @param {number} [bimestre=1] Bimestre a ser consultado (1 a 4).
 * @returns {Promise<Object>} Grupo, bimestre, integrantes com avaliação e permissão.
 */
export async function listarAvaliacoes(grupoId, usuario, bimestre = 1) {
  const bimestreValido = validarBimestre(bimestre);
  const grupo = await buscarGrupo(grupoId);

  const [resultIntegrantes, resultAvaliacoes] = await Promise.all([
    supabaseAdmin.from('integrantes').select('id, nome_aluno').eq('grupo_id', grupoId).order('nome_aluno'),
    supabaseAdmin.from('avaliacoes').select('*').eq('grupo_id', grupoId).eq('bimestre', bimestreValido),
  ]);

  if (resultIntegrantes.error || resultAvaliacoes.error) {
    throw new AppError(500, 'Falha ao listar avaliacoes');
  }

  const integrantes = resultIntegrantes.data.map((integrante) => ({
    ...integrante,
    avaliacao: resultAvaliacoes.data.find((a) => a.integrante_id === integrante.id) ?? null,
  }));

  return {
    grupo: { id: grupo.id, turma_id: grupo.turma_id, nome: grupo.nome, lider_id: grupo.lider_id, vice_lider_id: grupo.vice_lider_id },
    bimestre: bimestreValido,
    integrantes,
    permissao: calcularPermissao(grupo, resultAvaliacoes.data, usuario),
  };
}

/**
 * Submete (cria ou atualiza) a avaliação individual de um integrante em
 * um bimestre específico.
 *
 * Trava de concorrência Líder vs. Vice-Líder:
 * - O Líder tem prioridade e pode submeter/sobrescrever a qualquer momento
 *   (enquanto o professor não tiver alterado a nota).
 * - O Vice-Líder só pode submeter se o Líder ainda não tiver submetido
 *   neste bimestre.
 * - O Professor sempre pode submeter, exigindo comentário de esclarecimento.
 *
 * Trava pós-professor:
 * - Assim que o professor altera uma avaliação (alterado_por_professor = true),
 *   nem o líder nem o vice-líder podem editá-la novamente; somente o
 *   professor pode fazer novas alterações a partir daí.
 *
 * @param {Object} params Parâmetros da submissão.
 * @param {string} params.grupoId UUID do grupo.
 * @param {string} params.integranteId UUID do integrante avaliado.
 * @param {number} params.bimestre Bimestre da avaliação (1 a 4).
 * @param {Object} params.notas Critérios validados (interesse, entrega_prazo, participacao, qualidade_trabalho, respeito_grupo, comentario_esclarecimento opcional).
 * @param {Object} params.usuario Usuário autenticado.
 * @returns {Promise<Object>} Avaliação persistida.
 * @throws {AppError} 400/403 em violações de permissão ou validação.
 */
export async function submeterAvaliacao({ grupoId, integranteId, bimestre, notas, usuario }) {
  const bimestreValido = validarBimestre(bimestre);
  const grupo = await buscarGrupo(grupoId);
  await buscarIntegranteDoGrupo(grupoId, integranteId);

  const { data: existente } = await supabaseAdmin
    .from('avaliacoes')
    .select('*')
    .eq('grupo_id', grupoId)
    .eq('integrante_id', integranteId)
    .eq('bimestre', bimestreValido)
    .maybeSingle();

  if (usuario.role === 'professor') {
    if (!notas.comentario_esclarecimento?.trim()) {
      throw new AppError(400, 'O comentario de esclarecimento e obrigatorio para o professor');
    }
  } else if (usuario.role === 'lider') {
    if (usuario.id !== grupo.lider_id) {
      throw new AppError(403, 'Apenas o lider do grupo pode submeter as notas');
    }
    if (existente?.alterado_por_professor) {
      throw new AppError(403, 'O professor ja alterou esta avaliacao; somente ele pode edita-la agora');
    }
  } else if (usuario.role === 'vice_lider') {
    if (usuario.id !== grupo.vice_lider_id) {
      throw new AppError(403, 'Apenas o vice-lider do grupo pode submeter as notas');
    }
    if (existente?.alterado_por_professor) {
      throw new AppError(403, 'O professor ja alterou esta avaliacao; somente ele pode edita-la agora');
    }

    const { data: avaliacoesDoBimestre } = await supabaseAdmin
      .from('avaliacoes')
      .select('avaliador_id')
      .eq('grupo_id', grupoId)
      .eq('bimestre', bimestreValido);

    const liderSubmeteu = (avaliacoesDoBimestre ?? []).some((a) => a.avaliador_id === grupo.lider_id);
    if (liderSubmeteu && existente?.avaliador_id === grupo.lider_id) {
      throw new AppError(403, 'O lider ja submeteu as notas; o vice-lider esta em modo somente leitura');
    }
  } else {
    throw new AppError(403, 'Perfil sem permissao para avaliar');
  }

  const alteradoPorProfessor = usuario.role === 'professor';

  const payload = {
    grupo_id: grupoId,
    integrante_id: integranteId,
    bimestre: bimestreValido,
    avaliador_id: usuario.id,
    interesse: notas.interesse,
    entrega_prazo: notas.entrega_prazo,
    participacao: notas.participacao,
    qualidade_trabalho: notas.qualidade_trabalho,
    respeito_grupo: notas.respeito_grupo,
    alterado_por_professor: alteradoPorProfessor,
    comentario_esclarecimento: notas.comentario_esclarecimento?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from('avaliacoes')
    .upsert(payload, { onConflict: 'grupo_id,integrante_id,bimestre' })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new AppError(409, 'Ja existe uma avaliacao para este integrante neste bimestre');
    }
    throw new AppError(400, `Falha ao submeter avaliacao: ${error.message}`);
  }

  await registrarAuditoria('avaliacoes', data.id, existente ? 'UPDATE' : 'INSERT', usuario.id, {
    grupo_id: grupoId,
    integrante_id: integranteId,
    bimestre: bimestreValido,
    criterios: {
      interesse: notas.interesse,
      entrega_prazo: notas.entrega_prazo,
      participacao: notas.participacao,
      qualidade_trabalho: notas.qualidade_trabalho,
      respeito_grupo: notas.respeito_grupo,
    },
    alterado_por_professor: alteradoPorProfessor,
    comentario_esclarecimento: payload.comentario_esclarecimento,
  });

  return data;
}

/**
 * Exclui a avaliação de um integrante em um bimestre específico
 * (exclusivo do Professor), exigindo comentário de esclarecimento para
 * fins de auditoria.
 *
 * @param {Object} params Parâmetros da exclusão.
 * @param {string} params.grupoId UUID do grupo.
 * @param {string} params.integranteId UUID do integrante.
 * @param {number} params.bimestre Bimestre da avaliação (1 a 4).
 * @param {string} params.comentario Justificativa obrigatória.
 * @param {string} params.professorId UUID do professor executor.
 * @returns {Promise<{success: boolean}>} Resultado da operação.
 */
export async function excluirAvaliacao({ grupoId, integranteId, bimestre, comentario, professorId }) {
  const bimestreValido = validarBimestre(bimestre);

  const { data: existente } = await supabaseAdmin
    .from('avaliacoes')
    .select('*')
    .eq('grupo_id', grupoId)
    .eq('integrante_id', integranteId)
    .eq('bimestre', bimestreValido)
    .maybeSingle();

  if (!existente) {
    throw new AppError(404, 'Avaliacao nao encontrada');
  }

  const { error } = await supabaseAdmin
    .from('avaliacoes')
    .delete()
    .eq('grupo_id', grupoId)
    .eq('integrante_id', integranteId)
    .eq('bimestre', bimestreValido);

  if (error) {
    throw new AppError(400, `Falha ao excluir avaliacao: ${error.message}`);
  }

  await registrarAuditoria('avaliacoes', existente.id, 'DELETE', professorId, {
    grupo_id: grupoId,
    integrante_id: integranteId,
    bimestre: bimestreValido,
    nota_antiga: existente,
    comentario_esclarecimento: comentario,
  });

  return { success: true };
}

/**
 * Lista o histórico de alterações (auditoria) das avaliações de um grupo,
 * já com o nome do usuário responsável e do integrante avaliado.
 *
 * Acesso permitido para: professor, líder do grupo e vice-líder do grupo.
 *
 * @param {string} grupoId UUID do grupo.
 * @param {Object} usuario Usuário autenticado.
 * @returns {Promise<Object[]>} Lista de eventos de histórico, mais recente primeiro.
 * @throws {AppError} 403 se o usuário não tiver relação com o grupo.
 */
export async function listarHistorico(grupoId, usuario) {
  const grupo = await buscarGrupo(grupoId);

  const ehProfessor = usuario.role === 'professor';
  const ehLider = usuario.id === grupo.lider_id;
  const ehViceLider = usuario.id === grupo.vice_lider_id;

  if (!ehProfessor && !ehLider && !ehViceLider) {
    throw new AppError(403, 'Sem permissao para consultar o historico deste grupo');
  }

  const { data: logs, error } = await supabaseAdmin
    .from('audit_logs')
    .select('*')
    .eq('tabela_afetada', 'avaliacoes')
    .contains('detalhes', { grupo_id: grupoId })
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError(500, 'Falha ao consultar historico');
  }

  const usuarioIds = [...new Set(logs.map((l) => l.usuario_id).filter(Boolean))];
  const integranteIds = [...new Set(logs.map((l) => l.detalhes?.integrante_id).filter(Boolean))];

  const [resultUsuarios, resultIntegrantes] = await Promise.all([
    usuarioIds.length
      ? supabaseAdmin.from('profiles').select('id, nome, role').in('id', usuarioIds)
      : Promise.resolve({ data: [] }),
    integranteIds.length
      ? supabaseAdmin.from('integrantes').select('id, nome_aluno').in('id', integranteIds)
      : Promise.resolve({ data: [] }),
  ]);

  const usuariosPorId = Object.fromEntries((resultUsuarios.data ?? []).map((u) => [u.id, u]));
  const integrantesPorId = Object.fromEntries((resultIntegrantes.data ?? []).map((i) => [i.id, i]));

  return logs.map((log) => ({
    id: log.id,
    acao: log.acao,
    data: log.created_at,
    bimestre: log.detalhes?.bimestre ?? null,
    usuario: usuariosPorId[log.usuario_id]
      ? { nome: usuariosPorId[log.usuario_id].nome, role: usuariosPorId[log.usuario_id].role }
      : null,
    integrante: integrantesPorId[log.detalhes?.integrante_id]
      ? { nome: integrantesPorId[log.detalhes.integrante_id].nome_aluno }
      : null,
    alterado_por_professor: log.detalhes?.alterado_por_professor ?? false,
    comentario_esclarecimento: log.detalhes?.comentario_esclarecimento ?? null,
    criterios: log.detalhes?.criterios ?? null,
    nota_antiga: log.detalhes?.nota_antiga ?? null,
  }));
}