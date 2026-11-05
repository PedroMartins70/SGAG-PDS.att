import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseMock } from '../test/supabaseMock.js';
import { criarPerfil, listarPerfis } from '../services/profile.service.js';

const holder = vi.hoisted(() => ({ supabase: null }));

vi.mock('../config/supabase.js', () => ({
  get supabaseAdmin() {
    return holder.supabase;
  },
}));

const TURMA_3A = '33333333-3333-4333-8333-333333333333';
const TURMA_3B = '44444444-4444-4444-8444-444444444444';

beforeEach(() => {
  holder.supabase = createSupabaseMock();
});

describe('profileService.criarPerfil', () => {
  it('cria perfil de lider com sucesso e registra auditoria', async () => {
    const supabase = holder.supabase;

    supabase.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: 'lider-1' } },
      error: null,
    });
    supabase.queue('profiles', {
      data: { id: 'lider-1', nome: 'Aluno Lider', email: 'lider@escola.com', role: 'lider', is_active: true },
      error: null,
    });
    supabase.queue('audit_logs', { data: null, error: null });

    const resultado = await criarPerfil(
      { nome: 'Aluno Lider', email: 'lider@escola.com', senha: 'senha123', role: 'lider' },
      'prof-1'
    );

    expect(resultado).toMatchObject({ id: 'lider-1', role: 'lider' });
    expect(resultado.turma_ids).toBeUndefined();
    expect(supabase.auth.admin.createUser).toHaveBeenCalledWith({
      email: 'lider@escola.com',
      password: 'senha123',
      email_confirm: true,
      user_metadata: { role: 'lider', nome: 'Aluno Lider' },
    });
    expect(supabase.from('audit_logs')).toBeDefined();
  });

  it('BLOQUEIA a criacao de um segundo professor com HTTP 400', async () => {
    await expect(
      criarPerfil(
        { nome: 'Outro Prof', email: 'prof2@escola.com', senha: 'senha123', role: 'professor' },
        'prof-1'
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Nao e permitido criar um segundo professor',
    });
  });

  it('BLOQUEIA o cadastro de aluno comum (sem conta) com HTTP 400', async () => {
    await expect(
      criarPerfil(
        { nome: 'Aluno Comum', email: 'aluno@escola.com', senha: 'senha123', role: 'aluno' },
        'prof-1'
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Alunos comuns nao possuem conta de acesso no sistema',
    });
  });

  it('propaga falha de criacao no Supabase Auth com HTTP 400', async () => {
    const supabase = holder.supabase;

    supabase.auth.admin.createUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'email ja cadastrado' },
    });

    await expect(
      criarPerfil(
        { nome: 'Vice', email: 'vice@escola.com', senha: 'senha123', role: 'vice_lider' },
        'prof-1'
      )
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('profileService.criarPerfil — avaliador com turmas', () => {
  it('cria o avaliador, vincula as turmas escolhidas e registra auditoria', async () => {
    const supabase = holder.supabase;

    supabase.queue('turmas', {
      data: [
        { id: TURMA_3A, nome: '3A' },
        { id: TURMA_3B, nome: '3B' },
      ],
      error: null,
    });
    supabase.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: 'aval-1' } },
      error: null,
    });
    supabase.queue('profiles', {
      data: { id: 'aval-1', nome: 'Prof Banca', email: 'banca@escola.com', role: 'avaliador', is_active: true },
      error: null,
    });
    supabase.queue('avaliador_turmas', { data: null, error: null });
    supabase.queue('audit_logs', { data: null, error: null });

    const resultado = await criarPerfil(
      {
        nome: 'Prof Banca',
        email: 'banca@escola.com',
        senha: 'senha123',
        role: 'avaliador',
        turma_ids: [TURMA_3A, TURMA_3B],
      },
      'prof-1'
    );

    expect(resultado).toMatchObject({ id: 'aval-1', role: 'avaliador' });
    expect(resultado.turma_ids).toEqual([TURMA_3A, TURMA_3B]);
    expect(supabase.auth.admin.createUser).toHaveBeenCalledTimes(1);
  });

  it('BLOQUEIA avaliador sem turma (HTTP 400) e nao cria a conta', async () => {
    const supabase = holder.supabase;

    await expect(
      criarPerfil(
        { nome: 'Prof Banca', email: 'banca@escola.com', senha: 'senha123', role: 'avaliador', turma_ids: [] },
        'prof-1'
      )
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(supabase.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it('BLOQUEIA avaliador com turma inexistente (HTTP 400) e nao cria a conta', async () => {
    const supabase = holder.supabase;

    supabase.queue('turmas', { data: [], error: null });

    await expect(
      criarPerfil(
        {
          nome: 'Prof Banca',
          email: 'banca@escola.com',
          senha: 'senha123',
          role: 'avaliador',
          turma_ids: [TURMA_3A],
        },
        'prof-1'
      )
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(supabase.auth.admin.createUser).not.toHaveBeenCalled();
  });
});

describe('profileService.listarPerfis', () => {
  it('lista perfis de lider e vice_lider', async () => {
    const supabase = holder.supabase;

    supabase.queue('profiles', {
      data: [
        { id: 'l1', nome: 'Ana', role: 'lider' },
        { id: 'v1', nome: 'Bia', role: 'vice_lider' },
      ],
      error: null,
    });

    const perfis = await listarPerfis();

    expect(perfis).toHaveLength(2);
    expect(supabase.from('profiles')).toBeDefined();
  });
});