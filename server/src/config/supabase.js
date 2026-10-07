import { createClient } from '@supabase/supabase-js';

import 'dotenv/config';

let client = null;

/**
 * Obtém (e inicializa sob demanda) o cliente Supabase Admin usando exclusivamente
 * as variáveis de ambiente do servidor (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY).
 *
 * A inicialização é "lazy" para permitir que a aplicação suba e rode os testes
 * sem exigir credenciais válidas, e a Service Role Key nunca é exposta ao /client.
 *
 * @returns {import('@supabase/supabase-js').SupabaseClient} Cliente Admin do Supabase.
 */
function getClient() {
  if (client) return client;

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Variaveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorias (veja server/.env.example).'
    );
  }

  client = createClient(supabaseUrl, serviceRoleKey);
  console.log('URL USADA:', supabaseUrl);
  console.log('CHAVE USADA (início):', serviceRoleKey.slice(0, 25));
  console.log('CHAVE USADA (tamanho total):', serviceRoleKey.length);
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
