import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middlewares/error.middleware.js';
import { registrarAuditoria } from '../utils/audit.js';

/** Bloco da ficha -> coluna da tabela avaliacoes_banca. */
const COLUNAS = {
  topicos: 'nota_topicos',
  abnt_coerencia: 'nota_abnt_coerencia',
  apresentacao_oral: 'nota_apresentacao_oral',
  pitch: 'nota_pitch',
};

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
    .select('id, nome, lider_id, vice_lider_id')
    .eq('id', grupoId)
    .maybeSingle();

  if (error || !grupo) {
    throw new AppError(404, 'Grupo nao encontrado');
  }
  return grupo;
}

/**
 * Valida o bimestre (1 a 4).
 *
 * @param {number} bimestre Bimestre informado.
 * @returns {number} Bimestre como número.
 * @throws {AppError} 400 se for inválido.
 */
function validarBimestre(bimestre) {
  const valor = Number(bimestre);
  if (!valor || valor < 1 || valor > 4) {
    throw new AppError(400, 'Bimestre invalido (deve ser um numero entre 1 e 4)');
  }
  return valor;
}

/**
 * Converte uma linha do banco no formato usado pelo front-end.
 *
 * @param {Object} linha Linha da tabela avaliacoes_banca.
 * @param {Object} nomesPorId Mapa id do avaliador -> { id, nome }.
 * @returns {Object} Avaliação formatada.
 */
function formatar(linha, nomesPorId = {}) {
  return {
    id: linha.id,
    avaliador: nomesPorId[linha.avaliador_id] ?? { id: linha.avaliador_id, nome: null },
    notas: {
      topicos: Number(linha.nota_topicos),
      abnt_coerencia: Number(linha.nota_abnt_coerencia),
      apresentacao_oral: Number(linha.nota_apresentacao_oral),
      pitch: Number(linha.nota_pitch),
    },
    comentario: linha.comentario ?? '',
    nota_total: Number(linha.nota_total),
    updated_at: linha.updated_at,
  };
}

/**
 * Lista as avaliações da banca de um grupo em um bimestre.
 *
 * Quem vê o quê:
 * - Avaliador: apenas a própria avaliação (e pode editar).
 * - Professor: todas as avaliações (somente leitura).
 * - Líder e Vice-Líder: todas as avaliações do SEU grupo (somente leitura).
 *
 * @param {string} grupoId UUID do grupo.
 * @param {Object} usuario Usuário autenticado.
 * @param {number} [bimestre=1] Bimestre consultado.
 * @returns {Promise<Object>} Grupo, permissão, avaliações e resumo.
 * @throws {AppError} 403 se o usuário não puder ver este grupo.
 */
export async function listarAvaliacoesBanca(grupoId, usuario, bimestre = 1) {
  const bimestreValido = validarBimestre(bimestre);
  const grupo = await buscarGrupo(grupoId);

  const ehProfessor = usuario.role === 'professor';
  const ehAvaliador = usuario.role === 'avaliador';
  const ehDoGrupo = usuario.id === grupo.lider_id || usuario.id === grupo.vice_lider_id;

  if (!ehProfessor && !ehAvaliador && !ehDoGrupo) {
    throw new AppError(403, 'Sem permissao para ver as avaliacoes da banca deste grupo');
  }

  let consulta = supabaseAdmin
    .from('avaliacoes_banca')
    .select('*')
    .eq('grupo_id', grupoId)
    .eq('bimestre', bimestreValido)
    .order('updated_at', { ascending: false });

  if (ehAvaliador) {
    consulta = consulta.eq('avaliador_id', usuario.id);
  }

  const { data: linhas, error } = await consulta;
  if (error) {
    throw new AppError(500, 'Falha ao listar avaliacoes da banca');
  }

  const ids = [...new Set(linhas.map((l) => l.avaliador_id))];
  const { data: perfis } = ids.length
    ? await supabaseAdmin.from('profiles').select('id, nome').in('id', ids)
    : { data: [] };
  const nomesPorId = Object.fromEntries((perfis ?? []).map((p) => [p.id, { id: p.id, nome: p.nome }]));

  const avaliacoes = linhas.map((linha) => formatar(linha, nomesPorId));
  const soma = avaliacoes.reduce((acc, a) => acc + a.nota_total, 0);

  return {
    grupo: { id: grupo.id, nome: grupo.nome },
    bimestre: bimestreValido,
    permissao: { podeEditar: ehAvaliador },
    avaliacoes,
    resumo: {
      quantidade: avaliacoes.length,
      media_total: avaliacoes.length ? Math.round((soma / avaliacoes.length) * 100) / 100 : null,
    },
  };
}

/**
 * Cria ou atualiza a avaliação da banca do avaliador logado para um grupo
 * em um bimestre. Cada avaliador tem exatamente uma avaliação por grupo/bimestre.
 * O total é calculado pelo próprio banco de dados.
 *
 * @param {Object} params Parâmetros.
 * @param {string} params.grupoId UUID do grupo.
 * @param {number} params.bimestre Bimestre (1 a 4).
 * @param {{topicos: number, abnt_coerencia: number, apresentacao_oral: number, pitch: number}} params.notas Notas dos 4 blocos.
 * @param {string} [params.comentario] Observações (até 2500 caracteres).
 * @param {Object} params.usuario Usuário autenticado.
 * @returns {Promise<Object>} Avaliação salva.
 * @throws {AppError} 403 se não for avaliador.
 */
export async function salvarAvaliacaoBanca({ grupoId, bimestre, notas, comentario, usuario }) {
  if (usuario.role !== 'avaliador') {
    throw new AppError(403, 'Apenas avaliadores da banca podem registrar esta avaliacao');
  }

  const bimestreValido = validarBimestre(bimestre);
  await buscarGrupo(grupoId);

  const { data: existente } = await supabaseAdmin
    .from('avaliacoes_banca')
    .select('*')
    .eq('grupo_id', grupoId)
    .eq('bimestre', bimestreValido)
    .eq('avaliador_id', usuario.id)
    .maybeSingle();

  const payload = {
    grupo_id: grupoId,
    bimestre: bimestreValido,
    avaliador_id: usuario.id,
    comentario: comentario?.trim() || null,
    updated_at: new Date().toISOString(),
  };
  for (const [bloco, coluna] of Object.entries(COLUNAS)) {
    payload[coluna] = notas[bloco];
  }

  const { data, error } = await supabaseAdmin
    .from('avaliacoes_banca')
    .upsert(payload, { onConflict: 'grupo_id,bimestre,avaliador_id' })
    .select()
    .single();

  if (error) {
    throw new AppError(400, `Falha ao salvar avaliacao da banca: ${error.message}`);
  }

  await registrarAuditoria('avaliacoes_banca', data.id, existente ? 'UPDATE' : 'INSERT', usuario.id, {
    grupo_id: grupoId,
    bimestre: bimestreValido,
    notas,
    nota_total: Number(data.nota_total),
    comentario: payload.comentario,
    notas_anteriores: existente
      ? {
          topicos: Number(existente.nota_topicos),
          abnt_coerencia: Number(existente.nota_abnt_coerencia),
          apresentacao_oral: Number(existente.nota_apresentacao_oral),
          pitch: Number(existente.nota_pitch),
        }
      : null,
    nota_total_anterior: existente ? Number(existente.nota_total) : null,
  });

  return formatar(data, { [usuario.id]: { id: usuario.id, nome: usuario.nome ?? null } });
}

/**
 * Lista o histórico (auditoria) das avaliações da banca de um grupo,
 * mais recente primeiro, com o nome de quem avaliou.
 *
 * Quem vê o quê:
 * - Avaliador: apenas as próprias alterações.
 * - Professor: todas.
 * - Líder e Vice-Líder: todas as do SEU grupo.
 *
 * @param {string} grupoId UUID do grupo.
 * @param {Object} usuario Usuário autenticado.
 * @returns {Promise<Object[]>} Eventos de histórico da banca.
 * @throws {AppError} 403 se o usuário não puder ver este grupo.
 */
export async function listarHistoricoBanca(grupoId, usuario) {
  const grupo = await buscarGrupo(grupoId);

  const ehProfessor = usuario.role === 'professor';
  const ehAvaliador = usuario.role === 'avaliador';
  const ehDoGrupo = usuario.id === grupo.lider_id || usuario.id === grupo.vice_lider_id;

  if (!ehProfessor && !ehAvaliador && !ehDoGrupo) {
    throw new AppError(403, 'Sem permissao para consultar o historico da banca deste grupo');
  }

  let consulta = supabaseAdmin
    .from('audit_logs')
    .select('*')
    .eq('tabela_afetada', 'avaliacoes_banca')
    .contains('detalhes', { grupo_id: grupoId })
    .order('created_at', { ascending: false });

  if (ehAvaliador) {
    consulta = consulta.eq('usuario_id', usuario.id);
  }

  const { data: logs, error } = await consulta;
  if (error) {
    throw new AppError(500, 'Falha ao consultar historico da banca');
  }

  const ids = [...new Set(logs.map((l) => l.usuario_id).filter(Boolean))];
  const { data: perfis } = ids.length
    ? await supabaseAdmin.from('profiles').select('id, nome, role').in('id', ids)
    : { data: [] };
  const perfisPorId = Object.fromEntries((perfis ?? []).map((p) => [p.id, p]));

  return logs.map((log) => ({
    id: log.id,
    tipo: 'banca',
    acao: log.acao,
    data: log.created_at,
    bimestre: log.detalhes?.bimestre ?? null,
    usuario: perfisPorId[log.usuario_id]
      ? { nome: perfisPorId[log.usuario_id].nome, role: perfisPorId[log.usuario_id].role }
      : null,
    notas: log.detalhes?.notas ?? null,
    notas_anteriores: log.detalhes?.notas_anteriores ?? null,
    nota_total: log.detalhes?.nota_total ?? null,
    nota_total_anterior: log.detalhes?.nota_total_anterior ?? null,
    comentario: log.detalhes?.comentario ?? null,
  }));
}