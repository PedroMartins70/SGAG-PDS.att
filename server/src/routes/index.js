import { Router } from 'express';
import authRoutes from './auth.routes.js';
import profileRoutes from './profile.routes.js';
import turmaRoutes from './turma.routes.js';
import grupoRoutes from './grupo.routes.js';
import avaliacaoRoutes from './avaliacao.routes.js';
import arquivoRoutes from './arquivo.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import auditRoutes from './audit.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/profiles', profileRoutes);
router.use('/turmas', turmaRoutes);
router.use(grupoRoutes);
router.use(avaliacaoRoutes);
router.use(arquivoRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/audit-logs', auditRoutes);

export default router;