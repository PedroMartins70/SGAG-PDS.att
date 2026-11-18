import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middlewares/error.middleware.js';
import { registrarAuditoria } from '../utils/audit.js';
import { obterPeriodo } from './periodoBanca.service.js';
import { garantirAvaliadorNaTurma } from './avaliador.service.js';
import { ROTULO_AVALIADOR_REMOVIDO, mapaRotulosAvaliadores } from './rotulosAvaliador.service.js';

/** Separador entre os comentários juntos: 5 quebras de linha (4 linhas em branco no meio). */
const SEPARADOR_COMENTARIOS = '\n\n\n\n\n';

/**
 * Junta os comentários de todos os avaliadores em um único texto, para o líder
 * e o vice lerem sem saber quem escreveu cada um.
 *
 * Os comentários saem em ORDEM ALFABÉTICA, e não na ordem de "Avaliador 1, 2, 3".
 * Se saíssem na ordem dos avaliadores, a posição de cada comentário entregaria
 * quem o escreveu. Comentários vazios ficam de fora.
 *
 * @param {Array<string|null|undefined>} comentarios Comentários de cada avaliação.
 * @returns {string} Texto único (vazio se ninguém comentou).
 */
function juntarComentarios(comentarios) {
  return comentarios
    .map((texto) => String(texto ?? '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .join(SEPARADOR_COMENTARIOS);
}

/** Bloco da ficha -> coluna da tabela avaliacoes_banca. */
const COLUNAS = {
  topicos: 'nota_topicos',
  abnt_coerencia: 'nota_abnt_coerencia',
  apresentacao_oral: 'nota_apresentacao_oral',
  pitch: 'nota_pitch',
};

/**
 * Quem está olhando decide o que enxerga sobre os avaliadores:
 * - 'professor': nome real + nome genérico ("Avaliador 2"), para saber quem é quem.
 * - 'avaliador': o próprio nome (só vê a própria avaliação).
 * - 'grupo' (líder e vice): SOMENTE o nome genérico. O nome real e o id do
 *   avaliador nunca saem do servidor para este perfil.
 *
 * @param {Object} usuario Usuário autenticado.
 * @param {Object} grupo Grupo consultado.
 * @returns {'professor'|'avaliador'|'grupo'} Tipo de visão.
 */
function visaoDoUsuario(usuario, grupo) {
  if (usuario.role === 'professor') return 'professor';
  if (usuario.role === 'avaliador') return 'avaliador';
  if (usuario.id === grupo.lider_id || usuario.id === grupo.vice_lider_id) return 'grupo';
  return null;
}

/**
 * Monta a identificação do avaliador conforme a visão.
 *
 * @param {string} avaliadorId UUID do avaliador.
 * @param {Object} contexto Contexto da montagem.
 * @param {'professor'|'avaliador'|'grupo'} contexto.visao Visão de quem consulta.
 * @param {Object} contexto.nomes Mapa id -> { id, nome } (vazio na visão 'grupo').
 * @param {Object} contexto.rotulos Mapa id -> { numero, rotulo }.
 * @returns {{id?: string, nome: string|null, rotulo: string|null}} Identificação.
 */
function identificarAvaliador(avaliadorId, { visao, nomes, rotulos }) {
  const rotulo = rotulos[avaliadorId]?.rotulo ?? ROTULO_AVALIADOR_REMOVIDO;

  if (visao === 'professor') {
    return { id: avaliadorId, nome: nomes[avaliadorId]?.nome ?? null, rotulo };
  }
  if (visao === 'avaliador') {
    return { id: avaliadorId, nome: nomes[avaliadorId]?.nome ?? null, rotulo: null };
  }
  return { nome: rotulo, rotulo };
}

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
 * @param {Object} avaliador Identificação já pronta do avaliador (ver identificarAvaliador).
 * @returns {Object} Avaliação formatada.
 */
function formatar(linha, avaliador) {
  return {
    id: linha.id,
    avaliador,
    notas: {
      topicos: Number(linha.nota_topicos),
      abnt_coerencia: Number(linha.nota_abnt_coerencia),
      apresentacao_oral: Number(linha.nota_apresentacao_oral),
      pitch: Number(linha.nota_pitch),
    },
    // Nota de cada tópico (null nas avaliações antigas, feitas com uma nota por bloco)
    itens: linha.itens ?? null,
    comentario: linha.comentario ?? '',
    nota_total: Number(linha.nota_total),
    updated_at: linha.updated_at,
  };
}

/**
 * Lista as avaliações da banca de um grupo em um bimestre.
 *
 * Quem vê o quê:
 * - Avaliador: apenas a própria avaliação (e pode editar), e somente em
 *   grupos das turmas às quais foi vinculado.
 * - Professor: todas as avaliações (somente leitura), com o nome real de cada
 *   avaliador e o nome genérico ao lado ("Avaliador 2").
 * - Líder e Vice-Líder: todas as avaliações do SEU grupo (somente leitura),
 *   mas os avaliadores aparecem ANÔNIMOS ("Avaliador 1", "Avaliador 2"...).
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

  const visao = visaoDoUsuario(usuario, grupo);
  if (!visao) {
    throw new AppError(403, 'Sem permissao para ver as avaliacoes da banca deste grupo');
  }
  const ehAvaliador = visao === 'avaliador';

  await garantirAvaliadorNaTurma(usuario, grupo.turma_id);

  const periodo = await obterPeriodo(bimestreValido);

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

  // Os nomes reais só são buscados para quem pode vê-los (professor e o próprio avaliador).
  let nomes = {};
  if (visao !== 'grupo') {
    const ids = [...new Set(linhas.map((l) => l.avaliador_id))];
    const { data: perfis } = ids.length
      ? await supabaseAdmin.from('profiles').select('id, nome').in('id', ids)
      : { data: [] };
    nomes = Object.fromEntries((perfis ?? []).map((p) => [p.id, { id: p.id, nome: p.nome }]));
  }

  const rotulos = ehAvaliador ? {} : await mapaRotulosAvaliadores();

  // Professor e líder/vice veem a lista sempre na mesma ordem: Avaliador 1, 2, 3...
  const numeroDe = (linha) => rotulos[linha.avaliador_id]?.numero ?? Number.MAX_SAFE_INTEGER;
  const linhasOrdenadas = ehAvaliador ? linhas : [...linhas].sort((a, b) => numeroDe(a) - numeroDe(b));

  const avaliacoes = linhasOrdenadas.map((linha) =>
    formatar(linha, identificarAvaliador(linha.avaliador_id, { visao, nomes, rotulos }))
  );

  const soma = avaliacoes.reduce((acc, a) => acc + a.nota_total, 0);

  // Líder e vice: os comentários saem de cada avaliação (assim não dá para ligar um
  // comentário a um "Avaliador N") e vão juntos em um campo só. Professor e avaliador
  // recebem tudo como sempre, com o comentário em cada avaliação.
  let avaliacoesVisiveis = avaliacoes;
  let comentariosAgrupados = null;
  if (visao === 'grupo') {
    comentariosAgrupados = juntarComentarios(avaliacoes.map((a) => a.comentario));
    avaliacoesVisiveis = avaliacoes.map((a) => ({ ...a, comentario: '' }));
  }

  return {
    grupo: { id: grupo.id, nome: grupo.nome },
    bimestre: bimestreValido,
    periodo,
    permissao: { ehAvaliador, podeEditar: ehAvaliador && periodo.aberto },
    avaliacoes: avaliacoesVisiveis,
    comentarios_agrupados: comentariosAgrupados,
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
 * O avaliador só pode avaliar grupos das turmas às quais foi vinculado.
 *
 * @param {Object} params Parâmetros.
 * @param {string} params.grupoId UUID do grupo.
 * @param {number} params.bimestre Bimestre (1 a 4).
 * @param {{topicos: number, abnt_coerencia: number, apresentacao_oral: number, pitch: number}} params.notas Notas dos 4 blocos (soma dos tópicos, calculada na validação).
 * @param {Object<string, Object<string, number>>} params.itens Nota de cada tópico, por bloco.
 * @param {string} [params.comentario] Observações (até 2500 caracteres).
 * @param {Object} params.usuario Usuário autenticado.
 * @returns {Promise<Object>} Avaliação salva.
 * @throws {AppError} 403 se não for avaliador ou se a turma não for dele.
 */
export async function salvarAvaliacaoBanca({ grupoId, bimestre, notas, itens, comentario, usuario }) {
  if (usuario.role !== 'avaliador') {
    throw new AppError(403, 'Apenas avaliadores da banca podem registrar esta avaliacao');
  }

  const bimestreValido = validarBimestre(bimestre);
  const grupo = await buscarGrupo(grupoId);

  await garantirAvaliadorNaTurma(usuario, grupo.turma_id);

  // Trava de segurança: só avalia dentro do período definido pelo professor
  const periodo = await obterPeriodo(bimestreValido);
  if (!periodo.aberto) {
    throw new AppError(403, periodo.mensagem);
  }

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
    itens,
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
    itens,
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
    itens_anteriores: existente?.itens ?? null,
  });

  return formatar(data, { id: usuario.id, nome: usuario.nome ?? null, rotulo: null });
}

/**
 * Lista o histórico (auditoria) das avaliações da banca de um grupo,
 * mais recente primeiro.
 *
 * Quem vê o quê:
 * - Avaliador: apenas as próprias alterações, e somente de grupos das
 *   turmas às quais foi vinculado.
 * - Professor: todas, com o nome real de quem avaliou e o nome genérico.
 * - Líder e Vice-Líder: todas as do SEU grupo, com os avaliadores ANÔNIMOS.
 *
 * @param {string} grupoId UUID do grupo.
 * @param {Object} usuario Usuário autenticado.
 * @returns {Promise<Object[]>} Eventos de histórico da banca.
 * @throws {AppError} 403 se o usuário não puder ver este grupo.
 */
export async function listarHistoricoBanca(grupoId, usuario) {
  const grupo = await buscarGrupo(grupoId);

  const visao = visaoDoUsuario(usuario, grupo);
  if (!visao) {
    throw new AppError(403, 'Sem permissao para consultar o historico da banca deste grupo');
  }
  const ehAvaliador = visao === 'avaliador';

  await garantirAvaliadorNaTurma(usuario, grupo.turma_id);

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

  // Os nomes reais só são buscados para quem pode vê-los (professor e o próprio avaliador).
  let nomes = {};
  if (visao !== 'grupo') {
    const ids = [...new Set(logs.map((l) => l.usuario_id).filter(Boolean))];
    const { data: perfis } = ids.length
      ? await supabaseAdmin.from('profiles').select('id, nome').in('id', ids)
      : { data: [] };
    nomes = Object.fromEntries((perfis ?? []).map((p) => [p.id, { id: p.id, nome: p.nome }]));
  }

  const rotulos = ehAvaliador ? {} : await mapaRotulosAvaliadores();

  return logs.map((log) => {
    const identificacao = identificarAvaliador(log.usuario_id, { visao, nomes, rotulos });
    return {
      id: log.id,
      tipo: 'banca',
      acao: log.acao,
      data: log.created_at,
      bimestre: log.detalhes?.bimestre ?? null,
      usuario: { nome: identificacao.nome, rotulo: identificacao.rotulo, role: 'avaliador' },
      notas: log.detalhes?.notas ?? null,
      notas_anteriores: log.detalhes?.notas_anteriores ?? null,
      nota_total: log.detalhes?.nota_total ?? null,
      nota_total_anterior: log.detalhes?.nota_total_anterior ?? null,
      // Líder e vice não veem o comentário de cada avaliador (eles leem os comentários
      // juntos, na tela de notas da banca). Professor e avaliador veem como sempre.
      comentario: visao === 'grupo' ? null : (log.detalhes?.comentario ?? null),
    };
  });
}