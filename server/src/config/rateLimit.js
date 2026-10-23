import rateLimit from 'express-rate-limit';

/**
 * Limita tentativas de login por IP para mitigar ataques de força bruta.
 * Só conta as tentativas que FALHAM (skipSuccessfulRequests): assim, vários
 * alunos entrando pela mesma rede da escola não bloqueiam uns aos outros.
 * O bloqueio por conta (e-mail) fica em loginSeguranca.service.js.
 * Configurável via RATE_LIMIT_LOGIN (default 20 falhas por janela de 15 min).
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_LOGIN) || 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Tente novamente mais tarde.' },
});

/**
 * Limita tentativas de cadastro de professor para evitar abuso.
 * Configurável via RATE_LIMIT_REGISTER (default 10 por hora).
 */
export const registroLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_REGISTER) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de cadastro. Tente novamente mais tarde.' },
});