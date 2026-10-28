import { Router } from 'express';
import { requireAuth, requireRoles } from '../middlewares/auth.middleware.js';
import {
  criarAula,
  editarAula,
  excluirAula,
  excluirModelo,
  gerarEnvioAula,
  gerarEnvioModelo,
  linkAula,
  linkModelo,
  listarAulas,
  listarModelos,
  salvarModelo,
} from '../controllers/materiais.controller.js';

const router = Router();

// Slides / materiais das aulas (por turma)
router.get('/materiais/aulas', requireAuth, listarAulas);
router.post('/materiais/aulas/envio', requireAuth, requireRoles('professor'), gerarEnvioAula);
router.post('/materiais/aulas', requireAuth, requireRoles('professor'), criarAula);
router.get('/materiais/aulas/:id/link', requireAuth, linkAula);
router.put('/materiais/aulas/:id', requireAuth, requireRoles('professor'), editarAula);
router.delete('/materiais/aulas/:id', requireAuth, requireRoles('professor'), excluirAula);

// Modelo do trabalho escrito (um por bimestre)
router.get('/materiais/modelos', requireAuth, listarModelos);
router.post('/materiais/modelos/:bimestre/envio', requireAuth, requireRoles('professor'), gerarEnvioModelo);
router.put('/materiais/modelos/:bimestre', requireAuth, requireRoles('professor'), salvarModelo);
router.get('/materiais/modelos/:bimestre/link', requireAuth, linkModelo);
router.delete('/materiais/modelos/:bimestre', requireAuth, requireRoles('professor'), excluirModelo);

export default router;