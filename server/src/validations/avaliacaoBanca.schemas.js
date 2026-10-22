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