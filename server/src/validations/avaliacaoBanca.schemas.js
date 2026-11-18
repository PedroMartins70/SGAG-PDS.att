import { z } from 'zod';
import { BLOCOS_BANCA, somarBlocos } from './criteriosBanca.js';

/** Confere se o valor é múltiplo de 0,05 (tolerando erro de ponto flutuante). */
const ehMultiploDeCincoCentavos = (valor) => {
  const centavos = Math.round(valor * 100);
  return Math.abs(valor * 100 - centavos) < 1e-6 && centavos % 5 === 0;
};

/** Nota de um tópico: de 0 até o máximo daquele bloco, de 0,05 em 0,05. */
const notaDoTopico = (maximo) =>
  z
    .number({ invalid_type_error: 'Nota invalida', required_error: 'Preencha a nota de todos os topicos' })
    .min(0, 'A nota nao pode ser negativa')
    .max(maximo, `A nota de cada topico deste bloco vai ate ${maximo.toFixed(2)}`)
    .refine(ehMultiploDeCincoCentavos, 'A nota deve ser multipla de 0.05');

/** Um objeto por bloco, com um campo por tópico (campos desconhecidos são recusados). */
const itensDosBlocos = Object.fromEntries(
  BLOCOS_BANCA.map((bloco) => [
    bloco.id,
    z.object(Object.fromEntries(bloco.itens.map((id) => [id, notaDoTopico(bloco.maximoItem)]))).strict(),
  ])
);

const bimestre = z.coerce.number().int().min(1).max(4);

/**
 * Corpo do PUT /grupos/:grupoId/avaliacoes-banca
 *
 * O navegador manda só a nota de cada tópico ("itens"). A nota de cada bloco
 * ("notas") é calculada AQUI, somando os tópicos, para ninguém poder mandar uma
 * soma diferente da real.
 */
export const avaliacaoBancaSchema = z
  .object({
    bimestre,
    itens: z.object(itensDosBlocos).strict(),
    comentario: z.string().max(2500, 'O comentario pode ter no maximo 2500 caracteres').optional(),
  })
  .transform((dados) => ({ ...dados, notas: somarBlocos(dados.itens) }));

/** Query do GET /grupos/:grupoId/avaliacoes-banca?bimestre=1 */
export const listarAvaliacoesBancaQuerySchema = z.object({
  bimestre: bimestre.default(1),
});

/** Data no formato AAAA-MM-DD e que realmente existe (ex.: recusa 2026-02-31). */
const dataISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data invalida (use AAAA-MM-DD)')
  .refine((valor) => new Date(`${valor}T00:00:00Z`).toISOString().slice(0, 10) === valor, 'Data invalida');

/** Parâmetro :bimestre da URL. */
export const bimestreParamSchema = z.object({ bimestre });

/** Corpo do PUT /avaliacoes-banca/periodos/:bimestre */
export const periodoSchema = z
  .object({ abre_em: dataISO, fecha_em: dataISO })
  .refine((dados) => dados.fecha_em >= dados.abre_em, {
    message: 'A data de fechamento deve ser igual ou posterior a de abertura',
    path: ['fecha_em'],
  });