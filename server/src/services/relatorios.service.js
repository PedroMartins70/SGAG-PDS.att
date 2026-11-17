import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middlewares/error.middleware.js';
import { registrarAuditoria } from '../utils/audit.js';

const COLUNAS = 'id, titulo, descricao, url, created_at, updated_at';

/**
 * Registra a auditoria sem nunca derrubar a operação principal.
 */
async function auditar(id, acao, professorId, detalhes) {
  try {
    await registrarAuditoria('relatorios', id, acao, professorId, detalhes);
  } catch {
    // A auditoria é complementar: falhar aqui não deve impedir o professor de salvar.
  }
}

/**
 * Lista todos os relatórios (valem para todas as turmas), do mais novo para o mais antigo.
 *
 * @returns {Promise<Object[]>} Relatórios.
 * @throws {AppError} 500 se a consulta falhar.
 */
export async function listarRelatorios() {
  const { data, error } = await supabaseAdmin
    .from('relatorios')
    .select(COLUNAS)
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError(500, 'Falha ao listar os relatorios');
  }
  return data ?? [];
}

/**
 * Cria um relatório (exclusivo do Professor).
 *
 * @param {Object} params Parâmetros.
 * @param {string} params.titulo Título.
 * @param {string} params.descricao Descrição (pode ser vazia).
 * @param {string} params.url Link https do relatório.
 * @param {string} params.professorId UUID do professor.
 * @returns {Promise<Object>} Relatório criado.
 */
export async function criarRelatorio({ titulo, descricao, url, professorId }) {
  const { data, error } = await supabaseAdmin
    .from('relatorios')
    .insert({ titulo, descricao, url, criado_por: professorId })
    .select(COLUNAS)
    .single();

  if (error) {
    throw new AppError(400, `Falha ao criar o relatorio: ${error.message}`);
  }

  await auditar(data.id, 'INSERT', professorId, { tipo: 'criar_relatorio', titulo });
  return data;
}

/**
 * Atualiza título, descrição e link de um relatório (exclusivo do Professor).
 *
 * @param {Object} params Parâmetros.
 * @param {string} params.id UUID do relatório.
 * @returns {Promise<Object>} Relatório atualizado.
 * @throws {AppError} 404 se não existir.
 */
export async function atualizarRelatorio({ id, titulo, descricao, url, professorId }) {
  const { data, error } = await supabaseAdmin
    .from('relatorios')
    .update({ titulo, descricao, url, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(COLUNAS)
    .maybeSingle();

  if (error) {
    throw new AppError(400, `Falha ao atualizar o relatorio: ${error.message}`);
  }
  if (!data) {
    throw new AppError(404, 'Relatorio nao encontrado');
  }

  await auditar(id, 'UPDATE', professorId, { tipo: 'editar_relatorio', titulo });
  return data;
}

/**
 * Exclui um relatório (exclusivo do Professor).
 *
 * @param {Object} params Parâmetros.
 * @param {string} params.id UUID do relatório.
 * @returns {Promise<{id: string, excluido: boolean}>} Resultado.
 * @throws {AppError} 404 se não existir.
 */
export async function excluirRelatorio({ id, professorId }) {
  const { data, error } = await supabaseAdmin
    .from('relatorios')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new AppError(400, `Falha ao excluir o relatorio: ${error.message}`);
  }
  if (!data) {
    throw new AppError(404, 'Relatorio nao encontrado');
  }

  await auditar(id, 'DELETE', professorId, { tipo: 'excluir_relatorio' });
  return { id, excluido: true };
}