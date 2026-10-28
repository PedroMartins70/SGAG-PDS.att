import { z } from 'zod';

/** Senha nova: mínimo 8, com maiúscula, minúscula e número (máximo 72 por limite do bcrypt). */
const senhaForte = z
  .string()
  .min(8, 'A nova senha precisa ter pelo menos 8 caracteres')
  .max(72, 'A nova senha pode ter no máximo 72 caracteres')
  .regex(/[a-z]/, 'A nova senha precisa ter uma letra minúscula')
  .regex(/[A-Z]/, 'A nova senha precisa ter uma letra maiúscula')
  .regex(/[0-9]/, 'A nova senha precisa ter um número');

/** POST /auth/trocar-senha */
export const trocarSenhaSchema = z
  .object({
    senha_atual: z.string().min(1, 'Informe a senha atual').max(200),
    nova_senha: senhaForte,
  })
  .refine((dados) => dados.senha_atual !== dados.nova_senha, {
    message: 'A nova senha precisa ser diferente da atual',
    path: ['nova_senha'],
  });

/** Parâmetro :id da URL (UUID do perfil). */
export const perfilIdParamSchema = z.object({ id: z.string().uuid('Identificador inválido') });