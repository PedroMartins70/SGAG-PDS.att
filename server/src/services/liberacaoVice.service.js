import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middlewares/error.middleware.js';
import { registrarAuditoria } from '../utils/audit.js';

/**
 * Valida o bimestre (1 a 4).
 *
 * @param {number} bimestre Bimestre informado.
 * @returns {number} Bimestre como número.
 * @throws {AppError} 400 se for inválido.
 */
function validarBimestre(bimestre) {
  const valor = Number(bimestre);
  if (!Number.isInteger(valor) || valor < 1 || valor > 4) {
    throw new AppError(400, 'Bimestre invalido (deve ser um numero entre 1 e 4)');
  }
  return valor;
}

/**
 * Indica se o Professor liberou a avaliação do Vice-Líder neste grupo e bimestre.
 * Sem liberação, só o Líder avalia.
 *
 * @param {string} grupoId UUID do grupo.
 * @param {number} bimestre Bimestre (1 a 4).
 * @returns {Promise<boolean>} true se o vice está liberado.
 * @throws {AppError} 500 se a consulta falhar.
 */
export async function viceEstaLiberado(grupoId, bimestre) {
  const { data, error } = await supabaseAdmin
    .from('liberacoes_vice')
    .select('grupo_id')
    .eq('grupo_id', grupoId)
    .eq('bimestre', bimestre)
    .maybeSingle();

  if (error) {
    throw new AppError(500, 'Falha ao consultar a liberacao do vice-lider');
  }

  return Boolean(data);
}

/**
 * Libera ou retira a liberação da avaliação do Vice-Líder para um grupo em
 * um bimestre (exclusivo do Professor).
 *
 * Retirar a liberação não apaga as notas que o vice já deu; apenas impede
 * novas notas dele nesse bimestre.
 *
 * @param {Object} params Parâmetros.
 * @param {string} params.grupoId UUID do grupo.
 * @param {number} params.bimestre Bimestre (1 a 4).
 * @param {boolean} params.liberado true para liberar, false para retirar a liberação.
 * @param {string} params.professorId UUID do professor executor.
 * @returns {Promise<{grupo_id: string, bimestre: number, liberado: boolean}>} Estado final.
 * @throws {AppError} 404 se o grupo não existir; 400 se liberar um grupo sem vice-líder.
 */
export async function definirLiberacaoVice({ grupoId, bimestre, liberado, professorId }) {
  const bimestreValido = validarBimestre(bimestre);

  const { data: grupo, error: grupoError } = await supabaseAdmin
    .from('grupos')
    .select('id, vice_lider_id')
    .eq('id', grupoId)
    .maybeSingle();

  if (grupoError || !grupo) {
    throw new AppError(404, 'Grupo nao encontrado');
  }

  if (liberado) {
    if (!grupo.vice_lider_id) {
      throw new AppError(400, 'Este grupo ainda nao tem vice-lider definido');
    }

    const { error } = await supabaseAdmin
      .from('liberacoes_vice')
      .upsert(
        { grupo_id: grupoId, bimestre: bimestreValido, liberado_por: professorId },
        { onConflict: 'grupo_id,bimestre' }
      );

    if (error) {
      throw new AppError(400, `Falha ao liberar a avaliacao do vice-lider: ${error.message}`);
    }
  } else {
    const { error } = await supabaseAdmin
      .from('liberacoes_vice')
      .delete()
      .eq('grupo_id', grupoId)
      .eq('bimestre', bimestreValido);

    if (error) {
      throw new AppError(400, `Falha ao retirar a liberacao do vice-lider: ${error.message}`);
    }
  }

  await registrarAuditoria('liberacoes_vice', grupoId, liberado ? 'INSERT' : 'DELETE', professorId, {
    tipo: liberado ? 'liberar_avaliacao_vice' : 'retirar_liberacao_vice',
    grupo_id: grupoId,
    bimestre: bimestreValido,
  });

  return { grupo_id: grupoId, bimestre: bimestreValido, liberado: Boolean(liberado) };
}