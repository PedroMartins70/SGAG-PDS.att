import { asyncHandler } from '../middlewares/error.middleware.js';
import {
  avaliacaoSchema,
  excluirAvaliacaoSchema,
  listarAvaliacoesQuerySchema,
} from '../validations/schemas.js';
import * as avaliacaoService from '../services/avaliacao.service.js';

/**
 * GET /api/grupos/:grupoId/avaliacoes?bimestre=1 — Lista avaliações do grupo
 * em um bimestre específico, com permissão de edição. Se o bimestre não for
 * informado, assume o 1º bimestre.
 */
export const listarAvaliacoes = asyncHandler(async (req, res) => {
  const { grupoId } = req.params;
  const { bimestre } = listarAvaliacoesQuerySchema.parse(req.query);
  const resultado = await avaliacaoService.listarAvaliacoes(grupoId, req.user, bimestre);
  res.json(resultado);
});

/**
 * PUT /api/grupos/:grupoId/avaliacoes/:integranteId — Submete avaliação de
 * um integrante em um bimestre específico (vem no corpo da requisição).
 * Aplica a trava Líder/Vice-Líder, a trava pós-professor e a exigência de
 * esclarecimento do Professor.
 */
export const submeterAvaliacao = asyncHandler(async (req, res) => {
  const { grupoId, integranteId } = req.params;
  const { bimestre, ...notas } = avaliacaoSchema.parse(req.body);
  const avaliacao = await avaliacaoService.submeterAvaliacao({
    grupoId,
    integranteId,
    bimestre,
    notas,
    usuario: req.user,
  });
  res.status(201).json({ avaliacao });
});

/**
 * DELETE /api/grupos/:grupoId/avaliacoes/:integranteId — Exclui avaliação
 * de um bimestre específico (professor).
 */
export const excluirAvaliacao = asyncHandler(async (req, res) => {
  const { grupoId, integranteId } = req.params;
  const dados = excluirAvaliacaoSchema.parse(req.body);
  const resultado = await avaliacaoService.excluirAvaliacao({
    grupoId,
    integranteId,
    bimestre: dados.bimestre,
    comentario: dados.comentario_esclarecimento,
    professorId: req.user.id,
  });
  res.json(resultado);
});

/**
 * GET /api/grupos/:grupoId/avaliacoes/historico — Lista o histórico de
 * alterações das avaliações do grupo (todos os bimestres), mais recente
 * primeiro. Acesso: professor, líder e vice-líder do grupo.
 */
export const listarHistorico = asyncHandler(async (req, res) => {
  const { grupoId } = req.params;
  const historico = await avaliacaoService.listarHistorico(grupoId, req.user);
  res.json({ historico });
});
