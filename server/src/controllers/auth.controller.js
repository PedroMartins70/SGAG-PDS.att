import { asyncHandler } from '../middlewares/error.middleware.js';
import { cadastrarSchema, loginSchema } from '../validations/schemas.js';
import * as authService from '../services/auth.service.js';

/**
 * POST /api/auth/login — Autentica o usuário e retorna sessão + perfil.
 * Repassa o IP de origem para a proteção contra força bruta.
 */
export const login = asyncHandler(async (req, res) => {
  const dados = loginSchema.parse(req.body);
  const resultado = await authService.login({ ...dados, ip: req.ip });
  res.json(resultado);
});

/**
 * POST /api/auth/cadastrar — Cadastra Professor, Líder ou Vice-Líder.
 */
export const cadastrar = asyncHandler(async (req, res) => {
  const dados = cadastrarSchema.parse(req.body);
  const perfil = await authService.registrarUsuario(dados);
  res.status(201).json({ perfil });
});

/**
 * GET /api/auth/me — Retorna o perfil do usuário autenticado.
 */
export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});