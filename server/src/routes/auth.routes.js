import { Router } from 'express';
import { requireAuth, requireRoles } from '../middlewares/auth.middleware.js';
import { loginLimiter, registroLimiter } from '../config/rateLimit.js';
import {
  cadastrar,
  listarUsuarios,
  login,
  me,
  redefinirSenha,
  trocarSenha,
} from '../controllers/auth.controller.js';

const router = Router();

router.post('/login', loginLimiter, login);
router.post('/cadastrar', registroLimiter, cadastrar);
router.get('/me', requireAuth, me);

// Troca da própria senha (também usada quando a senha é temporária)
router.post('/trocar-senha', requireAuth, loginLimiter, trocarSenha);

// Redefinição de senha pelo professor
router.get('/usuarios', requireAuth, requireRoles('professor'), listarUsuarios);
router.post('/usuarios/:id/redefinir-senha', requireAuth, requireRoles('professor'), redefinirSenha);

export default router;