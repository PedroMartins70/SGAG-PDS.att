import { Router } from 'express';
import { requireAuth, requireRoles } from '../middlewares/auth.middleware.js';
import { criarPerfil, listarPerfis, trocarEmail } from '../controllers/profile.controller.js';

const router = Router();

router.post('/', requireAuth, requireRoles('professor'), criarPerfil);
router.get('/', requireAuth, requireRoles('professor'), listarPerfis);
router.put('/:id/email', requireAuth, requireRoles('professor'), trocarEmail);

export default router;