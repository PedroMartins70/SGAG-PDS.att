import { Router } from 'express';
import { requireAuth, requireRoles } from '../middlewares/auth.middleware.js';
import {
  listarAvaliacoesBanca,
  listarHistoricoBanca,
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

export default router;