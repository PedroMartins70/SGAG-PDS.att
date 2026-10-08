import { createClient } from '@supabase/supabase-js';

import 'dotenv/config';

/**
 * Opções que impedem o cliente de guardar/renovar sessões de usuário.
 * Sem sessão guardada, o cliente sempre envia a chave de serviço no header
 * Authorization e portanto sempre age como service_role.
 */
const OPCOES_SEM_SESSAO = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};

let client = null;

/**
 * Lê as credenciais do Supabase das variáveis de ambiente do servidor.
 *
 * @returns {{supabaseUrl: string, serviceRoleKey: string}} Credenciais.
 * @throws {Error} Se alguma variável estiver ausente.
 */
function lerCredenciais() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Variaveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorias (veja server/.env.example).'
    );
  }

  return { supabaseUrl, serviceRoleKey };
}

/**
 * Obtém (e inicializa sob demanda) o cliente Supabase Admin.
 *
 * ATENÇÃO: este cliente é compartilhado por todas as requisições. Nunca use
 * nele métodos que criam sessão de usuário (ex.: auth.signInWithPassword),
 * senão a sessão daquela pessoa "contamina" o cliente e as próximas
 * escritas passam a ser feitas como usuário comum, caindo no RLS.
 * Para login, use criarClienteAuth().
 *
 * @returns {import('@supabase/supabase-js').SupabaseClient} Cliente Admin do Supabase.
 */
function getClient() {
  if (client) return client;

  const { supabaseUrl, serviceRoleKey } = lerCredenciais();
  client = createClient(supabaseUrl, serviceRoleKey, OPCOES_SEM_SESSAO);
  return client;
}

/**
 * Proxy lazy do Supabase Admin. O cliente real só é criado quando um método
 * (ex.: from, auth) é efetivamente acessado.
 *
 * @type {ProxyHandler<object>}
 */
const handler = {
  get(_target, prop) {
    const target = getClient();
    const value = target[prop];
    return typeof value === 'function' ? value.bind(target) : value;
  },
};

export const supabaseAdmin = new Proxy({}, handler);

/**
 * Cria um cliente NOVO e descartável, exclusivo para operações de
 * autenticação (login, etc.). Como é novo a cada chamada, qualquer sessão
 * criada nele some junto com ele e nunca afeta o supabaseAdmin.
 *
 * @returns {import('@supabase/supabase-js').SupabaseClient} Cliente novo, sem sessão.
 */
export function criarClienteAuth() {
  const { supabaseUrl, serviceRoleKey } = lerCredenciais();
  return createClient(supabaseUrl, serviceRoleKey, OPCOES_SEM_SESSAO);
}