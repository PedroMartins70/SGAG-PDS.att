import { Router } from 'express';
import { requireAuth, requireRoles } from '../middlewares/auth.middleware.js';
import {
  atualizarRelatorio,
  criarRelatorio,
  excluirRelatorio,
  listarRelatorios,
} from '../controllers/relatorios.controller.js';

const router = Router();

// Professor, líder e vice-líder veem os relatórios
router.get('/relatorios', requireAuth, requireRoles('professor', 'lider', 'vice_lider'), listarRelatorios);
// Só o professor cadastra, edita e exclui
router.post('/relatorios', requireAuth, requireRoles('professor'), criarRelatorio);
router.put('/relatorios/:relatorioId', requireAuth, requireRoles('professor'), atualizarRelatorio);
router.delete('/relatorios/:relatorioId', requireAuth, requireRoles('professor'), excluirRelatorio);

export default router;