import { z } from 'zod';

/** Notas permitidas pela ficha de avaliação. */
const ESCALA = [0, 0.2, 0.4, 0.6, 0.8, 1];

const nota = z
  .number()
  .refine((valor) => ESCALA.includes(valor), 'Nota invalida (use 0, 0.2, 0.4, 0.6, 0.8 ou 1)');

const bimestre = z.coerce.number().int().min(1).max(4);

/** Corpo do PUT /grupos/:grupoId/avaliacoes-banca */
export const avaliacaoBancaSchema = z.object({
  bimestre,
  notas: z.object({
    topicos: nota,
    abnt_coerencia: nota,
    apresentacao_oral: nota,
    pitch: nota,
  }),
  comentario: z.string().max(2500, 'O comentario pode ter no maximo 2500 caracteres').optional(),
});

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