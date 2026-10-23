import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middlewares/error.middleware.js';
import { registrarAuditoria } from '../utils/audit.js';

const FUSO = 'America/Sao_Paulo';
const TABELA = 'periodos_avaliacao_banca';

/**
 * Data de hoje no horário de Brasília, no formato AAAA-MM-DD.
 * (O servidor pode estar em outro fuso; as datas do professor valem para Brasília.)
 *
 * @returns {string} Data de hoje.
 */
export function hojeISO() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Converte AAAA-MM-DD em dd/mm/aaaa. */
function formatarBR(dataISO) {
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

/**
 * Situação do período em relação a hoje. As duas datas são INCLUSIVAS
 * (abre no início do dia de abertura e fecha no fim do dia de fechamento).
 *
 * @param {{abre_em?: string, fecha_em?: string}|null} periodo Período do bimestre.
 * @param {string} [hoje] Data de hoje (AAAA-MM-DD).
 * @returns {'aberto'|'nao_iniciado'|'encerrado'|'nao_definido'} Situação.
 */
export function calcularSituacao(periodo, hoje = hojeISO()) {
  if (!periodo?.abre_em || !periodo?.fecha_em) return 'nao_definido';
  if (hoje < periodo.abre_em) return 'nao_iniciado';
  if (hoje > periodo.fecha_em) return 'encerrado';
  return 'aberto';
}

/**
 * Monta o objeto de período que vai para o front-end.
 *
 * @param {number} bimestre Bimestre (1 a 4).
 * @param {Object|null} linha Linha da tabela, se existir.
 * @returns {Object} Período com situação e mensagem.
 */
function montar(bimestre, linha) {
  const abre = linha?.abre_em ?? null;
  const fecha = linha?.fecha_em ?? null;
  const situacao = calcularSituacao(linha);

  const mensagens = {
    aberto: `Avaliacao aberta ate ${fecha ? formatarBR(fecha) : ''}`,
    nao_iniciado: `A avaliacao deste bimestre abre em ${abre ? formatarBR(abre) : ''}`,
    encerrado: `O periodo de avaliacao deste bimestre encerrou em ${fecha ? formatarBR(fecha) : ''}`,
    nao_definido: 'A avaliacao deste bimestre ainda nao foi liberada pelo professor',
  };

  return {
    bimestre,
    abre_em: abre,
    fecha_em: fecha,
    situacao,
    aberto: situacao === 'aberto',
    mensagem: mensagens[situacao],
  };
}

/**
 * Busca a linha do período de um bimestre (ou null se não houver).
 *
 * @param {number} bimestre Bimestre (1 a 4).
 * @returns {Promise<Object|null>} Linha da tabela.
 */
async function buscarLinha(bimestre) {
  const { data, error } = await supabaseAdmin.from(TABELA).select('*').eq('bimestre', bimestre).maybeSingle();
  if (error) {
    console.error('Erro em buscarLinha:', error);
    throw new AppError(500, 'Falha ao consultar o periodo de avaliacao');
  }
  return data;
}

/**
 * Período de UM bimestre, já com a situação (aberto, encerrado...).
 *
 * @param {number} bimestre Bimestre (1 a 4).
 * @returns {Promise<Object>} Período do bimestre.
 */
export async function obterPeriodo(bimestre) {
  return montar(bimestre, await buscarLinha(bimestre));
}

/**
 * Períodos dos 4 bimestres (os sem datas vêm como "nao_definido").
 *
 * @returns {Promise<Object[]>} Lista com 4 períodos.
 */
export async function listarPeriodos() {
  const { data, error } = await supabaseAdmin.from(TABELA).select('*');
  if (error) {
    console.error('Erro em listarPeriodos:', error);
    throw new AppError(500, 'Falha ao listar os periodos de avaliacao');
  }
  return [1, 2, 3, 4].map((bimestre) => montar(bimestre, (data ?? []).find((l) => l.bimestre === bimestre)));
}

/**
 * Define (ou altera) o período de um bimestre. Exclusivo do professor.
 *
 * @param {Object} params Parâmetros.
 * @param {number} params.bimestre Bimestre (1 a 4).
 * @param {string} params.abre_em Data de abertura (AAAA-MM-DD).
 * @param {string} params.fecha_em Data de fechamento (AAAA-MM-DD).
 * @param {Object} params.usuario Professor autenticado.
 * @returns {Promise<Object>} Período salvo.
 */
export async function definirPeriodo({ bimestre, abre_em, fecha_em, usuario }) {
  const anterior = await buscarLinha(bimestre);

  const { data, error } = await supabaseAdmin
    .from(TABELA)
    .upsert(
      { bimestre, abre_em, fecha_em, atualizado_por: usuario.id, updated_at: new Date().toISOString() },
      { onConflict: 'bimestre' }
    )
    .select()
    .single();

  if (error) {
    throw new AppError(400, `Falha ao salvar o periodo: ${error.message}`);
  }

  await registrarAuditoria(TABELA, data.id, anterior ? 'UPDATE' : 'INSERT', usuario.id, {
    bimestre,
    abre_em,
    fecha_em,
    anterior: anterior ? { abre_em: anterior.abre_em, fecha_em: anterior.fecha_em } : null,
  });

  return montar(bimestre, data);
}

/**
 * Remove o período de um bimestre (a avaliação volta a ficar bloqueada).
 *
 * @param {Object} params Parâmetros.
 * @param {number} params.bimestre Bimestre (1 a 4).
 * @param {Object} params.usuario Professor autenticado.
 * @returns {Promise<Object>} Período do bimestre (agora "nao_definido").
 */
export async function removerPeriodo({ bimestre, usuario }) {
  const existente = await buscarLinha(bimestre);
  if (!existente) {
    return montar(bimestre, null);
  }

  const { error } = await supabaseAdmin.from(TABELA).delete().eq('bimestre', bimestre);
  if (error) {
    throw new AppError(400, `Falha ao remover o periodo: ${error.message}`);
  }

  await registrarAuditoria(TABELA, existente.id, 'DELETE', usuario.id, {
    bimestre,
    anterior: { abre_em: existente.abre_em, fecha_em: existente.fecha_em },
  });

  return montar(bimestre, null);
}