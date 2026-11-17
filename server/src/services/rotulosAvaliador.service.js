import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middlewares/error.middleware.js';

/** Rótulo usado quando a conta do avaliador não existe mais (ex.: foi excluída). */
export const ROTULO_AVALIADOR_REMOVIDO = 'Avaliador removido';

/**
 * Gera o nome genérico de cada avaliador ("Avaliador 1", "Avaliador 2", ...).
 *
 * A numeração segue a ORDEM DE CADASTRO das contas de avaliador (a mais antiga
 * é o Avaliador 1). Em caso de empate de data, desempata pelo id, então o
 * resultado é sempre o mesmo: o mesmo avaliador mantém o mesmo número em todas
 * as telas, grupos e bimestres.
 *
 * Todos os avaliadores entram na contagem (ativos ou não), para o número de
 * ninguém mudar por causa de uma desativação. Excluir uma conta renumera os
 * avaliadores que foram cadastrados depois dela.
 *
 * @returns {Promise<Object<string, {numero: number, rotulo: string}>>} Mapa id do avaliador -> número e rótulo.
 * @throws {AppError} 500 se a consulta falhar.
 */
export async function mapaRotulosAvaliadores() {
  let { data, error } = await supabaseAdmin.from('profiles').select('id, created_at').eq('role', 'avaliador');

  // Se a tabela não tiver created_at, ordena só pelo id (ainda é estável).
  if (error) {
    ({ data, error } = await supabaseAdmin.from('profiles').select('id').eq('role', 'avaliador'));
  }

  if (error) {
    throw new AppError(500, 'Falha ao identificar os avaliadores');
  }

  const ordenados = [...(data ?? [])].sort((a, b) => {
    const tempoA = a.created_at ? Date.parse(a.created_at) : 0;
    const tempoB = b.created_at ? Date.parse(b.created_at) : 0;
    if (tempoA !== tempoB) return tempoA - tempoB;
    return String(a.id).localeCompare(String(b.id));
  });

  return Object.fromEntries(
    ordenados.map((perfil, indice) => [perfil.id, { numero: indice + 1, rotulo: `Avaliador ${indice + 1}` }])
  );
}