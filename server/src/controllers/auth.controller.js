import { asyncHandler } from '../middlewares/error.middleware.js';
import { cadastrarSchema, loginSchema } from '../validations/schemas.js';
import { perfilIdParamSchema, trocarSenhaSchema } from '../validations/senha.schemas.js';
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

/**
 * POST /api/auth/trocar-senha — O próprio usuário troca a senha (informa a atual).
 */
export const trocarSenha = asyncHandler(async (req, res) => {
  const { senha_atual: senhaAtual, nova_senha: novaSenha } = trocarSenhaSchema.parse(req.body);
  const resultado = await authService.trocarSenha({
    usuario: req.user,
    senhaAtual,
    novaSenha,
    ip: req.ip,
  });
  res.json(resultado);
});

/**
 * GET /api/auth/usuarios — Contas que o professor pode redefinir (líder, vice, avaliador).
 */
export const listarUsuarios = asyncHandler(async (req, res) => {
  const usuarios = await authService.listarUsuariosRedefiniveis(req.user);
  res.json({ usuarios });
});

/**
 * POST /api/auth/usuarios/:id/redefinir-senha — O professor gera uma senha temporária
 * para a conta. A resposta nunca deve ficar em cache.
 */
export const redefinirSenha = asyncHandler(async (req, res) => {
  const { id } = perfilIdParamSchema.parse(req.params);
  const resultado = await authService.redefinirSenhaPorProfessor({ perfilId: id, usuario: req.user });
  res.set('Cache-Control', 'no-store');
  res.json(resultado);
});