import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createSupabaseMock } from '../test/supabaseMock.js';
import app from '../app.js';

const holder = vi.hoisted(() => ({ supabase: null }));

vi.mock('../config/supabase.js', () => ({
  get supabaseAdmin() {
    return holder.supabase;
  },
}));

const PERFIL_PROFESSOR = {
  id: 'prof-1',
  nome: 'Professor',
  email: 'prof@escola.com',
  role: 'professor',
  is_active: true,
};

const PERFIL_LIDER = {
  id: 'lider-1',
  nome: 'Ana Lider',
  email: 'lider@escola.com',
  role: 'lider',
  is_active: true,
};

const PERFIL_VICE = {
  id: 'vice-1',
  nome: 'Bia Vice',
  email: 'vice@escola.com',
  role: 'vice_lider',
  is_active: true,
};

const PERFIL_AVALIADOR = {
  id: 'aval-1',
  nome: 'Prof Banca',
  email: 'banca@escola.com',
  role: 'avaliador',
  is_active: true,
};

const TURMA = { id: 'turma-3a', nome: '3A' };

const TURMA_3A_UUID = '33333333-3333-4333-8333-333333333333';
const TURMA_3B_UUID = '44444444-4444-4444-8444-444444444444';
const AVALIADOR_UUID = '55555555-5555-4555-8555-555555555555';

const GRUPO = {
  id: 'g1',
  turma_id: 'turma-3a',
  nome: 'Grupo Alfa',
  lider_id: 'lider-1',
  vice_lider_id: 'vice-1',
};

const INTEGRANTE = { id: 'i1', nome_aluno: 'Carlos' };

const NOTAS = {
  interesse: 0.2,
  entrega_prazo: 0.2,
  participacao: 0.2,
  qualidade_trabalho: 0.2,
  respeito_grupo: 0.2,
};

/**
 * Configura a autenticação mockada (requireAuth) para um perfil específico.
 * A partir daqui, qualquer consulta adicional a `profiles` deve ser enfileirada
 * pelo teste antes da chamada.
 *
 * @param {Object} supabase Cliente mockado.
 * @param {Object} perfil Perfil do usuário autenticado.
 * @returns {string} Token Bearer simulado.
 */
function autenticarComo(supabase, perfil) {
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: perfil.id } }, error: null });
  supabase.queue('profiles', { data: perfil, error: null });
  return `Bearer token-${perfil.id}`;
}

beforeEach(() => {
  holder.supabase = createSupabaseMock();
});

describe('Integracao completa da API /api (TDD)', () => {
  it('POST /api/auth/login autentica com sucesso', async () => {
    const supabase = holder.supabase;
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'prof-1' }, session: { access_token: 'jwt' } },
      error: null,
    });
    supabase.queue('profiles', { data: { id: 'prof-1', email: 'prof@escola.com' }, error: null });
    supabase.queue('profiles', { data: PERFIL_PROFESSOR, error: null });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'prof@escola.com', senha: 'senha123' });

    expect(res.status).toBe(200);
    expect(res.body.session.access_token).toBe('jwt');
    expect(res.body.user.role).toBe('professor');
  });

  it('GET /api/auth/me retorna o perfil autenticado', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_PROFESSOR);

    const res = await request(app).get('/api/auth/me').set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe('prof-1');
  });

  it('POST /api/profiles cria perfil de lider (professor)', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_PROFESSOR);
    supabase.auth.admin.createUser.mockResolvedValue({ data: { user: { id: 'lider-1' } }, error: null });
    supabase.queue('profiles', {
      data: { id: 'lider-1', nome: 'Ana Lider', email: 'lider@escola.com', role: 'lider', is_active: true },
      error: null,
    });
    supabase.queue('audit_logs', { data: null, error: null });

    const res = await request(app)
      .post('/api/profiles')
      .set('Authorization', token)
      .send({ nome: 'Ana Lider', email: 'lider@escola.com', senha: 'senha123', role: 'lider' });

    expect(res.status).toBe(201);
    expect(res.body.perfil.role).toBe('lider');
  });

  it('POST /api/profiles cria avaliador ja vinculado as turmas escolhidas (professor)', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_PROFESSOR);
    supabase.queue('turmas', {
      data: [
        { id: TURMA_3A_UUID, nome: '3A' },
        { id: TURMA_3B_UUID, nome: '3B' },
      ],
      error: null,
    });
    supabase.auth.admin.createUser.mockResolvedValue({ data: { user: { id: 'aval-1' } }, error: null });
    supabase.queue('profiles', { data: PERFIL_AVALIADOR, error: null });
    supabase.queue('avaliador_turmas', { data: null, error: null });
    supabase.queue('audit_logs', { data: null, error: null });

    const res = await request(app)
      .post('/api/profiles')
      .set('Authorization', token)
      .send({
        nome: 'Prof Banca',
        email: 'banca@escola.com',
        senha: 'senha123',
        role: 'avaliador',
        turma_ids: [TURMA_3A_UUID, TURMA_3B_UUID],
      });

    expect(res.status).toBe(201);
    expect(res.body.perfil.role).toBe('avaliador');
    expect(res.body.perfil.turma_ids).toEqual([TURMA_3A_UUID, TURMA_3B_UUID]);
  });

  it('POST /api/profiles recusa avaliador sem turma (HTTP 400)', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_PROFESSOR);

    const res = await request(app)
      .post('/api/profiles')
      .set('Authorization', token)
      .send({ nome: 'Prof Banca', email: 'banca@escola.com', senha: 'senha123', role: 'avaliador' });

    expect(res.status).toBe(400);
    expect(supabase.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it('GET /api/profiles lista lideres e vice-lideres (professor)', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_PROFESSOR);
    supabase.queue('profiles', { data: [PERFIL_LIDER, PERFIL_VICE], error: null });

    const res = await request(app).get('/api/profiles').set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.perfis).toHaveLength(2);
  });

  it('GET /api/profiles/avaliadores lista os avaliadores com as turmas (professor)', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_PROFESSOR);
    supabase.queue('profiles', {
      data: [{ id: 'aval-1', nome: 'Prof Banca', email: 'banca@escola.com' }],
      error: null,
    });
    supabase.queue('avaliador_turmas', {
      data: [{ avaliador_id: 'aval-1', turma_id: TURMA_3A_UUID }],
      error: null,
    });
    supabase.queue('turmas', { data: [{ id: TURMA_3A_UUID, nome: '3A' }], error: null });

    const res = await request(app).get('/api/profiles/avaliadores').set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.avaliadores).toHaveLength(1);
    expect(res.body.avaliadores[0].turmas[0].nome).toBe('3A');
  });

  it('GET /api/profiles/avaliadores e bloqueado para nao-professor (HTTP 403)', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_AVALIADOR);

    const res = await request(app).get('/api/profiles/avaliadores').set('Authorization', token);

    expect(res.status).toBe(403);
  });

  it('PUT /api/profiles/avaliadores/:id/turmas define as turmas de um avaliador ja cadastrado', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_PROFESSOR);
    supabase.queue('profiles', { data: { id: AVALIADOR_UUID, nome: 'Prof Banca', role: 'avaliador' }, error: null });
    supabase.queue('turmas', {
      data: [
        { id: TURMA_3A_UUID, nome: '3A' },
        { id: TURMA_3B_UUID, nome: '3B' },
      ],
      error: null,
    });
    supabase.queue('avaliador_turmas', { data: [{ turma_id: TURMA_3A_UUID }], error: null }); // atuais
    supabase.queue('avaliador_turmas', { data: null, error: null }); // insert da 3B
    supabase.queue('audit_logs', { data: null, error: null });

    const res = await request(app)
      .put(`/api/profiles/avaliadores/${AVALIADOR_UUID}/turmas`)
      .set('Authorization', token)
      .send({ turma_ids: [TURMA_3A_UUID, TURMA_3B_UUID] });

    expect(res.status).toBe(200);
    expect(res.body.avaliador.turma_ids).toEqual([TURMA_3A_UUID, TURMA_3B_UUID]);
  });

  it('PUT /api/profiles/avaliadores/:id/turmas recusa lista vazia (HTTP 400)', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_PROFESSOR);

    const res = await request(app)
      .put(`/api/profiles/avaliadores/${AVALIADOR_UUID}/turmas`)
      .set('Authorization', token)
      .send({ turma_ids: [] });

    expect(res.status).toBe(400);
  });

  it('GET /api/profiles/minhas-turmas devolve so as turmas do avaliador logado', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_AVALIADOR);
    supabase.queue('avaliador_turmas', {
      data: [{ turma: { id: TURMA_3A_UUID, nome: '3A' } }],
      error: null,
    });

    const res = await request(app).get('/api/profiles/minhas-turmas').set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.turmas).toEqual([{ id: TURMA_3A_UUID, nome: '3A' }]);
  });

  it('GET /api/turmas lista as turmas', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_PROFESSOR);
    supabase.queue('turmas', { data: [TURMA], error: null });

    const res = await request(app).get('/api/turmas').set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.turmas[0].nome).toBe('3A');
  });

  it('GET /api/turmas/:turmaId/grupos lista os grupos com integrantes', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_PROFESSOR);
    supabase.queue('turmas', { data: TURMA, error: null });
    supabase.queue('grupos', {
      data: [
        { id: 'g1', nome: 'Grupo Alfa', lider_id: 'lider-1', vice_lider_id: 'vice-1', integrantes: [INTEGRANTE] },
      ],
      error: null,
    });

    const res = await request(app).get('/api/turmas/turma-3a/grupos').set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.grupos[0].integrantes).toHaveLength(1);
  });

  it('GET /api/turmas/:turmaId/grupos bloqueia avaliador de turma que nao e dele (HTTP 403)', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_AVALIADOR);
    supabase.queue('avaliador_turmas', { data: null, error: null });

    const res = await request(app).get('/api/turmas/turma-3a/grupos').set('Authorization', token);

    expect(res.status).toBe(403);
  });

  it('GET /api/turmas/:turmaId/grupos libera avaliador na turma vinculada a ele', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_AVALIADOR);
    supabase.queue('avaliador_turmas', { data: { turma_id: 'turma-3a' }, error: null });
    supabase.queue('turmas', { data: TURMA, error: null });
    supabase.queue('grupos', {
      data: [
        { id: 'g1', nome: 'Grupo Alfa', lider_id: 'lider-1', vice_lider_id: 'vice-1', integrantes: [INTEGRANTE] },
      ],
      error: null,
    });

    const res = await request(app).get('/api/turmas/turma-3a/grupos').set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.grupos).toHaveLength(1);
  });

  it('POST /api/turmas/:turmaId/grupos cria grupo (professor)', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_PROFESSOR);
    supabase.queue('turmas', { data: TURMA, error: null });
    supabase.queue('grupos', { data: [], error: null, count: 2 });
    supabase.queue('grupos', { data: GRUPO, error: null });
    supabase.queue('audit_logs', { data: null, error: null });

    const res = await request(app)
      .post('/api/turmas/turma-3a/grupos')
      .set('Authorization', token)
      .send({ nome: 'Grupo Alfa' });

    expect(res.status).toBe(201);
    expect(res.body.grupo.id).toBe('g1');
  });

  it('POST /api/turmas/:turmaId/grupos permite o 7o grupo (limite e 7)', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_PROFESSOR);
    supabase.queue('turmas', { data: TURMA, error: null });
    supabase.queue('grupos', { data: [], error: null, count: 6 });
    supabase.queue('grupos', { data: { ...GRUPO, nome: 'Grupo Sete' }, error: null });
    supabase.queue('audit_logs', { data: null, error: null });

    const res = await request(app)
      .post('/api/turmas/turma-3a/grupos')
      .set('Authorization', token)
      .send({ nome: 'Grupo Sete' });

    expect(res.status).toBe(201);
  });

  it('POST /api/turmas/:turmaId/grupos bloqueia o 8o grupo (HTTP 400)', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_PROFESSOR);
    supabase.queue('turmas', { data: TURMA, error: null });
    supabase.queue('grupos', { data: [], error: null, count: 7 });

    const res = await request(app)
      .post('/api/turmas/turma-3a/grupos')
      .set('Authorization', token)
      .send({ nome: 'Grupo Extra' });

    expect(res.status).toBe(400);
  });

  it('PUT /api/grupos/:grupoId renomeia grupo (professor)', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_PROFESSOR);
    supabase.queue('grupos', { data: GRUPO, error: null });
    supabase.queue('grupos', { data: { ...GRUPO, nome: 'Grupo Beta' }, error: null });
    supabase.queue('audit_logs', { data: null, error: null });

    const res = await request(app)
      .put('/api/grupos/g1')
      .set('Authorization', token)
      .send({ nome: 'Grupo Beta' });

    expect(res.status).toBe(200);
    expect(res.body.grupo.nome).toBe('Grupo Beta');
  });

  it('DELETE /api/grupos/:grupoId exclui grupo (professor)', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_PROFESSOR);
    supabase.queue('grupos', { data: GRUPO, error: null });
    supabase.queue('grupos', { data: null, error: null });
    supabase.queue('audit_logs', { data: null, error: null });

    const res = await request(app).delete('/api/grupos/g1').set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/grupos/:grupoId/integrantes adiciona integrante (professor)', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_PROFESSOR);
    supabase.queue('grupos', { data: GRUPO, error: null });
    supabase.queue('integrantes', { data: [], error: null, count: 3 });
    supabase.queue('integrantes', { data: INTEGRANTE, error: null });
    supabase.queue('audit_logs', { data: null, error: null });

    const res = await request(app)
      .post('/api/grupos/g1/integrantes')
      .set('Authorization', token)
      .send({ nome_aluno: 'Carlos' });

    expect(res.status).toBe(201);
    expect(res.body.integrante.nome_aluno).toBe('Carlos');
  });

  it('POST /api/grupos/:grupoId/integrantes bloqueia o 8o integrante (HTTP 400)', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_PROFESSOR);
    supabase.queue('grupos', { data: GRUPO, error: null });
    supabase.queue('integrantes', { data: [], error: null, count: 7 });

    const res = await request(app)
      .post('/api/grupos/g1/integrantes')
      .set('Authorization', token)
      .send({ nome_aluno: 'Zeca' });

    expect(res.status).toBe(400);
  });

  it('DELETE /api/grupos/:grupoId/integrantes/:id remove integrante (professor)', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_PROFESSOR);
    supabase.queue('grupos', { data: GRUPO, error: null });
    supabase.queue('integrantes', { data: INTEGRANTE, error: null });
    supabase.queue('integrantes', { data: null, error: null });
    supabase.queue('audit_logs', { data: null, error: null });

    const res = await request(app).delete('/api/grupos/g1/integrantes/i1').set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('PUT /api/grupos/:grupoId/lider designa lider (professor)', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_PROFESSOR);
    const liderUuid = '11111111-1111-4111-8111-111111111111';
    supabase.queue('grupos', { data: { ...GRUPO, lider_id: null, vice_lider_id: null }, error: null });
    supabase.queue('profiles', { data: { id: liderUuid, role: 'lider', is_active: true }, error: null });
    supabase.queue('grupos', { data: null, error: null });
    supabase.queue('audit_logs', { data: null, error: null });

    const res = await request(app)
      .put('/api/grupos/g1/lider')
      .set('Authorization', token)
      .send({ perfil_id: liderUuid });

    expect(res.status).toBe(200);
    expect(res.body.lider_id).toBe(liderUuid);
  });

  it('PUT /api/grupos/:grupoId/vice-lider designa vice-lider (professor)', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_PROFESSOR);
    const viceUuid = '22222222-2222-4222-8222-222222222222';
    supabase.queue('grupos', { data: { ...GRUPO, lider_id: null, vice_lider_id: null }, error: null });
    supabase.queue('profiles', { data: { id: viceUuid, role: 'vice_lider', is_active: true }, error: null });
    supabase.queue('grupos', { data: null, error: null });
    supabase.queue('audit_logs', { data: null, error: null });

    const res = await request(app)
      .put('/api/grupos/g1/vice-lider')
      .set('Authorization', token)
      .send({ perfil_id: viceUuid });

    expect(res.status).toBe(200);
    expect(res.body.vice_lider_id).toBe(viceUuid);
  });

  it('GET /api/grupos/:grupoId/avaliacoes retorna permissao para o lider', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_LIDER);
    supabase.queue('grupos', { data: GRUPO, error: null });
    supabase.queue('integrantes', { data: [INTEGRANTE], error: null });
    supabase.queue('avaliacoes', { data: [], error: null });

    const res = await request(app).get('/api/grupos/g1/avaliacoes').set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.permissao.podeEditar).toBe(true);
    expect(res.body.integrantes).toHaveLength(1);
  });

  it('PUT /api/grupos/:grupoId/avaliacoes/:id submete avaliacao (lider)', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_LIDER);
    supabase.queue('grupos', { data: GRUPO, error: null });
    supabase.queue('integrantes', { data: INTEGRANTE, error: null });
    supabase.queue('avaliacoes', { data: null, error: null });
    supabase.queue('avaliacoes', { data: { id: 'av1', integrante_id: 'i1' }, error: null });
    supabase.queue('audit_logs', { data: null, error: null });

    const res = await request(app)
      .put('/api/grupos/g1/avaliacoes/i1')
      .set('Authorization', token)
      .send(NOTAS);

    expect(res.status).toBe(201);
    expect(res.body.avaliacao.integrante_id).toBe('i1');
  });

  it('PUT avaliacao rejeita criterio acima de 0.20 (validação Zod)', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_LIDER);

    const res = await request(app)
      .put('/api/grupos/g1/avaliacoes/i1')
      .set('Authorization', token)
      .send({ ...NOTAS, interesse: 0.5 });

    expect(res.status).toBe(400);
  });

  it('DELETE /api/grupos/:grupoId/avaliacoes/:id exclui avaliacao (professor)', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_PROFESSOR);
    supabase.queue('avaliacoes', { data: { id: 'av1', integrante_id: 'i1' }, error: null });
    supabase.queue('avaliacoes', { data: null, error: null });
    supabase.queue('audit_logs', { data: null, error: null });

    const res = await request(app)
      .delete('/api/grupos/g1/avaliacoes/i1')
      .set('Authorization', token)
      .send({ comentario_esclarecimento: 'Nota excluida pela banca' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/dashboard retorna metricas globais', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_PROFESSOR);
    supabase.queue('turmas', { data: [], error: null, count: 4 });
    supabase.queue('grupos', { data: [], error: null, count: 5 });
    supabase.queue('integrantes', { data: [], error: null, count: 20 });
    supabase.queue('avaliacoes', { data: [], error: null, count: 15 });

    const res = await request(app).get('/api/dashboard').set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.total_turmas).toBe(4);
    expect(res.body.avaliacoes.pendentes).toBe(5);
  });

  it('GET /api/dashboard filtra metricas por turma', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_PROFESSOR);
    supabase.queue('turmas', { data: [], error: null, count: 4 });
    supabase.queue('grupos', { data: [], error: null, count: 2 });
    supabase.queue('grupos', { data: [{ id: 'g1' }, { id: 'g2' }], error: null });
    supabase.queue('integrantes', { data: [], error: null, count: 10 });
    supabase.queue('avaliacoes', { data: [], error: null, count: 4 });

    const res = await request(app).get('/api/dashboard?turmaId=turma-3a').set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.total_grupos).toBe(2);
  });

  it('GET /api/audit-logs retorna historico (professor)', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_PROFESSOR);
    supabase.queue('audit_logs', { data: [], error: null });

    const res = await request(app).get('/api/audit-logs').set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.logs).toEqual([]);
  });

  it('GET /api/grupos/:grupoId retorna detalhe do grupo (professor)', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_PROFESSOR);
    supabase.queue('grupos', {
      data: {
        id: 'g1',
        turma_id: 'turma-3a',
        nome: 'Grupo Alfa',
        lider: { id: 'lider-1', nome: 'Ana Lider', email: 'lider@escola.com' },
        vice: { id: 'vice-1', nome: 'Bia Vice', email: 'vice@escola.com' },
      },
      error: null,
    });
    supabase.queue('integrantes', { data: [INTEGRANTE], error: null });
    supabase.queue('avaliacoes', {
      data: [{ id: 'av1', integrante_id: 'i1', nota_total: 0.85, alterado_por_professor: false }],
      error: null,
    });
    supabase.queue('liberacoes_vice', { data: null, error: null });

    const res = await request(app).get('/api/grupos/g1').set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.grupo.lider.nome).toBe('Ana Lider');
    expect(res.body.grupo.media_geral).toBe(0.85);
    expect(res.body.grupo.vice_liberado).toBe(false);
  });

  it('GET /api/grupos/:grupoId e bloqueado para nao-professor com HTTP 403', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_LIDER);

    const res = await request(app).get('/api/grupos/g1').set('Authorization', token);

    expect(res.status).toBe(403);
  });

  it('GET /api/grupos/me retorna o grupo do lider autenticado', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_LIDER);
    supabase.queue('grupos', {
      data: { id: 'g1', turma_id: 'turma-3a', nome: 'Grupo Alfa', lider_id: 'lider-1', vice_lider_id: 'vice-1' },
      error: null,
    });
    supabase.queue('turmas', { data: { id: 'turma-3a', nome: '3A' }, error: null });
    supabase.queue('integrantes', { data: [INTEGRANTE], error: null });

    const res = await request(app).get('/api/grupos/me').set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.grupo.turma_nome).toBe('3A');
    expect(res.body.grupo.integrantes).toHaveLength(1);
  });

  it('GET /api/grupos/:grupoId mostra vice_liberado=true quando o professor liberou o bimestre', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_PROFESSOR);
    supabase.queue('grupos', {
      data: {
        id: 'g1',
        turma_id: 'turma-3a',
        nome: 'Grupo Alfa',
        lider: { id: 'lider-1', nome: 'Ana Lider', email: 'lider@escola.com' },
        vice: { id: 'vice-1', nome: 'Bia Vice', email: 'vice@escola.com' },
      },
      error: null,
    });
    supabase.queue('integrantes', { data: [INTEGRANTE], error: null });
    supabase.queue('avaliacoes', { data: [], error: null });
    supabase.queue('liberacoes_vice', { data: { grupo_id: 'g1' }, error: null });

    const res = await request(app).get('/api/grupos/g1?bimestre=2').set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.grupo.vice_liberado).toBe(true);
  });

  it('PUT /api/grupos/:grupoId/liberacao-vice libera o vice no bimestre (professor)', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_PROFESSOR);
    supabase.queue('grupos', { data: { id: 'g1', vice_lider_id: 'vice-1' }, error: null });
    supabase.queue('liberacoes_vice', { data: null, error: null });
    supabase.queue('audit_logs', { data: null, error: null });

    const res = await request(app)
      .put('/api/grupos/g1/liberacao-vice')
      .set('Authorization', token)
      .send({ bimestre: 2, liberado: true });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ grupo_id: 'g1', bimestre: 2, liberado: true });
  });

  it('PUT /api/grupos/:grupoId/liberacao-vice retira a liberacao (professor)', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_PROFESSOR);
    supabase.queue('grupos', { data: { id: 'g1', vice_lider_id: 'vice-1' }, error: null });
    supabase.queue('liberacoes_vice', { data: null, error: null });
    supabase.queue('audit_logs', { data: null, error: null });

    const res = await request(app)
      .put('/api/grupos/g1/liberacao-vice')
      .set('Authorization', token)
      .send({ bimestre: 2, liberado: false });

    expect(res.status).toBe(200);
    expect(res.body.liberado).toBe(false);
  });

  it('PUT /api/grupos/:grupoId/liberacao-vice e bloqueado para o lider (HTTP 403)', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_LIDER);

    const res = await request(app)
      .put('/api/grupos/g1/liberacao-vice')
      .set('Authorization', token)
      .send({ bimestre: 2, liberado: true });

    expect(res.status).toBe(403);
  });

  it('PUT /api/grupos/:grupoId/liberacao-vice rejeita bimestre invalido (HTTP 400)', async () => {
    const supabase = holder.supabase;
    const token = autenticarComo(supabase, PERFIL_PROFESSOR);

    const res = await request(app)
      .put('/api/grupos/g1/liberacao-vice')
      .set('Authorization', token)
      .send({ bimestre: 9, liberado: true });

    expect(res.status).toBe(400);
  });

  it('rotas inexistentes retornam HTTP 404', async () => {
    const res = await request(app).get('/api/nao-existe');

    expect(res.status).toBe(404);
  });
});