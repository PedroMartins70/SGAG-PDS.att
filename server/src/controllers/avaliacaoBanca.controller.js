import { asyncHandler } from '../middlewares/error.middleware.js';
import {
  avaliacaoBancaSchema,
  listarAvaliacoesBancaQuerySchema,
} from '../validations/avaliacaoBanca.schemas.js';
import * as avaliacaoBancaService from '../services/avaliacaoBanca.service.js';

/**
 * GET /api/grupos/:grupoId/avaliacoes-banca?bimestre=1
 * Lista as avaliações da banca (o avaliador vê só a sua; professor, líder e
 * vice do grupo veem todas).
 */
export const listarAvaliacoesBanca = asyncHandler(async (req, res) => {
  const { grupoId } = req.params;
  const { bimestre } = listarAvaliacoesBancaQuerySchema.parse(req.query);
  const resultado = await avaliacaoBancaService.listarAvaliacoesBanca(grupoId, req.user, bimestre);
  res.json(resultado);
});

/**
 * PUT /api/grupos/:grupoId/avaliacoes-banca
 * Cria ou atualiza a avaliação da banca do avaliador logado.
 */
export const salvarAvaliacaoBanca = asyncHandler(async (req, res) => {
  const { grupoId } = req.params;
  const { bimestre, notas, comentario } = avaliacaoBancaSchema.parse(req.body);
  const avaliacao = await avaliacaoBancaService.salvarAvaliacaoBanca({
    grupoId,
    bimestre,
    notas,
    comentario,
    usuario: req.user,
  });
  res.json({ avaliacao });
});

/**
 * GET /api/grupos/:grupoId/avaliacoes-banca/historico
 * Histórico de alterações das avaliações da banca (todos os bimestres).
 */
export const listarHistoricoBanca = asyncHandler(async (req, res) => {
  const { grupoId } = req.params;
  const historico = await avaliacaoBancaService.listarHistoricoBanca(grupoId, req.user);
  res.json({ historico });
});