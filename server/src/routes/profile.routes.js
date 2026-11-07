import { Router } from 'express';
import { requireAuth, requireRoles } from '../middlewares/auth.middleware.js';
import {
  criarPerfil,
  definirTurmasDoAvaliador,
  excluirAvaliador,
  listarAvaliadores,
  listarPerfis,
  minhasTurmas,
  trocarEmail,
} from '../controllers/profile.controller.js';

const router = Router();

router.post('/', requireAuth, requireRoles('professor'), criarPerfil);
router.get('/', requireAuth, requireRoles('professor'), listarPerfis);
router.put('/:id/email', requireAuth, requireRoles('professor'), trocarEmail);

// Avaliadores e suas turmas
router.get('/avaliadores', requireAuth, requireRoles('professor'), listarAvaliadores);
router.put('/avaliadores/:id/turmas', requireAuth, requireRoles('professor'), definirTurmasDoAvaliador);
router.delete('/avaliadores/:id', requireAuth, requireRoles('professor'), excluirAvaliador);
router.get('/minhas-turmas', requireAuth, requireRoles('avaliador'), minhasTurmas);

export default router;