import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import {
  confirmarEnvio,
  gerarUrlDeEnvio,
  listarArquivos,
  salvarLinkPitch,
} from '../controllers/arquivo.controller.js';

const router = Router();

router.get('/grupos/:grupoId/arquivos', requireAuth, listarArquivos);
router.put('/grupos/:grupoId/arquivos/pitch/link', requireAuth, salvarLinkPitch);
router.post('/grupos/:grupoId/arquivos/:tipo/upload-url', requireAuth, gerarUrlDeEnvio);
router.post('/grupos/:grupoId/arquivos/:tipo/confirmar', requireAuth, confirmarEnvio);

export default router;