import { Router } from 'express';
import { requireAuth, requireRoles } from '../middlewares/auth.middleware.js';
import {
  definirPeriodo,
  listarAvaliacoesBanca,
  listarHistoricoBanca,
  listarPeriodos,
  removerPeriodo,
  salvarAvaliacaoBanca,
} from '../controllers/avaliacaoBanca.controller.js';

const router = Router();

router.get('/grupos/:grupoId/avaliacoes-banca', requireAuth, listarAvaliacoesBanca);
router.get('/grupos/:grupoId/avaliacoes-banca/historico', requireAuth, listarHistoricoBanca);
router.put(
  '/grupos/:grupoId/avaliacoes-banca',
  requireAuth,
  requireRoles('avaliador'),
  salvarAvaliacaoBanca
);

router.get('/avaliacoes-banca/periodos', requireAuth, listarPeriodos);
router.put('/avaliacoes-banca/periodos/:bimestre', requireAuth, requireRoles('professor'), definirPeriodo);
router.delete('/avaliacoes-banca/periodos/:bimestre', requireAuth, requireRoles('professor'), removerPeriodo);

export default router;