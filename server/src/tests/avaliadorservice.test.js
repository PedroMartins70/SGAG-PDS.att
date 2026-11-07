import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseMock } from '../test/supabaseMock.js';
import {
  definirTurmasDoAvaliador,
  excluirAvaliador,
  garantirAvaliadorNaTurma,
  garantirAvaliadorNoGrupo,
  listarAvaliadoresComTurmas,
  turmasDoAvaliador,
} from '../services/avaliador.service.js';

const holder = vi.hoisted(() => ({ supabase: null }));

vi.mock('../config/supabase.js', () => ({
  get supabaseAdmin() {
    return holder.supabase;
  },
}));

const TURMA_3A = '33333333-3333-4333-8333-333333333333';
const TURMA_3B = '44444444-4444-4444-8444-444444444444';
const TURMA_3C = '55555555-5555-4555-8555-555555555555';

const AVALIADOR = { id: 'aval-1', nome: 'Prof Banca', role: 'avaliador' };

beforeEach(() => {
  holder.supabase = createSupabaseMock();
});

describe('avaliadorService.listarAvaliadoresComTurmas', () => {
  it('lista cada avaliador com as turmas dele', async () => {
    const supabase = holder.supabase;

    supabase.queue('profiles', {
      data: [
        { id: 'aval-1', nome: 'Ana Banca', email: 'ana@escola.com' },
        { id: 'aval-2', nome: 'Beto Banca', email: 'beto@escola.com' },
      ],
      error: null,
    });
    supabase.queue('avaliador_turmas', {
      data: [
        { avaliador_id: 'aval-1', turma_id: TURMA_3A },
        { avaliador_id: 'aval-1', turma_id: TURMA_3B },
        { avaliador_id: 'aval-2', turma_id: TURMA_3B },
      ],
      error: null,
    });
    supabase.queue('turmas', {
      data: [
        { id: TURMA_3A, nome: '3A' },
        { id: TURMA_3B, nome: '3B' },
      ],
      error: null,
    });

    supabase.queue('avaliacoes_banca', {
      data: [{ avaliador_id: 'aval-1' }, { avaliador_id: 'aval-1' }, { avaliador_id: 'aval-2' }],
      error: null,
    });

    const lista = await listarAvaliadoresComTurmas();

    expect(lista).toHaveLength(2);
    expect(lista[0].total_avaliacoes).toBe(2);
    expect(lista[1].total_avaliacoes).toBe(1);
    expect(lista[0].turmas.map((t) => t.nome)).toEqual(['3A', '3B']);
    expect(lista[1].turmas.map((t) => t.nome)).toEqual(['3B']);
  });

  it('devolve lista vazia quando nao ha avaliadores', async () => {
    holder.supabase.queue('profiles', { data: [], error: null });

    expect(await listarAvaliadoresComTurmas()).toEqual([]);
  });
});

describe('avaliadorService.definirTurmasDoAvaliador', () => {
  it('adiciona as turmas novas, remove as desmarcadas e registra auditoria', async () => {
    const supabase = holder.supabase;

    supabase.queue('profiles', { data: AVALIADOR, error: null });
    supabase.queue('turmas', {
      data: [
        { id: TURMA_3A, nome: '3A' },
        { id: TURMA_3B, nome: '3B' },
      ],
      error: null,
    });
    // turmas atuais: 3A e 3C  -> adiciona 3B, remove 3C
    supabase.queue('avaliador_turmas', {
      data: [{ turma_id: TURMA_3A }, { turma_id: TURMA_3C }],
      error: null,
    });
    supabase.queue('avaliador_turmas', { data: null, error: null }); // insert
    supabase.queue('avaliador_turmas', { data: null, error: null }); // delete
    supabase.queue('audit_logs', { data: null, error: null });

    const resultado = await definirTurmasDoAvaliador(
      { avaliadorId: 'aval-1', turmaIds: [TURMA_3A, TURMA_3B] },
      'prof-1'
    );

    expect(resultado.turma_ids).toEqual([TURMA_3A, TURMA_3B]);
    expect(resultado.turmas.map((t) => t.nome)).toEqual(['3A', '3B']);
  });

  it('BLOQUEIA quando nenhuma turma e informada (HTTP 400)', async () => {
    holder.supabase.queue('profiles', { data: AVALIADOR, error: null });

    await expect(
      definirTurmasDoAvaliador({ avaliadorId: 'aval-1', turmaIds: [] }, 'prof-1')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('BLOQUEIA perfil que nao e avaliador (HTTP 400)', async () => {
    holder.supabase.queue('profiles', {
      data: { id: 'lider-1', nome: 'Ana Lider', role: 'lider' },
      error: null,
    });

    await expect(
      definirTurmasDoAvaliador({ avaliadorId: 'lider-1', turmaIds: [TURMA_3A] }, 'prof-1')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('retorna 404 quando o avaliador nao existe', async () => {
    holder.supabase.queue('profiles', { data: null, error: null });

    await expect(
      definirTurmasDoAvaliador({ avaliadorId: 'nao-existe', turmaIds: [TURMA_3A] }, 'prof-1')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('avaliadorService.turmasDoAvaliador', () => {
  it('devolve as turmas vinculadas ao avaliador, em ordem', async () => {
    holder.supabase.queue('avaliador_turmas', {
      data: [{ turma: { id: TURMA_3B, nome: '3B' } }, { turma: { id: TURMA_3A, nome: '3A' } }],
      error: null,
    });

    const turmas = await turmasDoAvaliador('aval-1');

    expect(turmas.map((t) => t.nome)).toEqual(['3A', '3B']);
  });
});

describe('avaliadorService.garantirAvaliadorNaTurma', () => {
  it('deixa o professor passar sem consultar o banco', async () => {
    await expect(garantirAvaliadorNaTurma({ id: 'prof-1', role: 'professor' }, TURMA_3A)).resolves.toBeUndefined();
  });

  it('deixa o avaliador passar quando a turma e dele', async () => {
    holder.supabase.queue('avaliador_turmas', { data: { turma_id: TURMA_3A }, error: null });

    await expect(garantirAvaliadorNaTurma({ id: 'aval-1', role: 'avaliador' }, TURMA_3A)).resolves.toBeUndefined();
  });

  it('BLOQUEIA o avaliador em turma que nao e dele (HTTP 403)', async () => {
    holder.supabase.queue('avaliador_turmas', { data: null, error: null });

    await expect(
      garantirAvaliadorNaTurma({ id: 'aval-1', role: 'avaliador' }, TURMA_3C)
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('avaliadorService.garantirAvaliadorNoGrupo', () => {
  it('BLOQUEIA o avaliador em grupo de turma que nao e dele (HTTP 403)', async () => {
    const supabase = holder.supabase;

    supabase.queue('grupos', { data: { turma_id: TURMA_3C }, error: null });
    supabase.queue('avaliador_turmas', { data: null, error: null });

    await expect(
      garantirAvaliadorNoGrupo({ id: 'aval-1', role: 'avaliador' }, 'g1')
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('retorna 404 quando o grupo nao existe', async () => {
    holder.supabase.queue('grupos', { data: null, error: null });

    await expect(
      garantirAvaliadorNoGrupo({ id: 'aval-1', role: 'avaliador' }, 'g-inexistente')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('avaliadorService.excluirAvaliador', () => {
  it('exclui a conta do avaliador, limpa o perfil e registra auditoria', async () => {
    const supabase = holder.supabase;

    supabase.auth.admin.deleteUser = vi.fn().mockResolvedValue({ data: null, error: null });
    supabase.queue('profiles', {
      data: { id: 'aval-1', nome: 'Prof Banca', email: 'banca@escola.com', role: 'avaliador' },
      error: null,
    });
    supabase.queue('profiles', { data: null, error: null }); // limpeza do perfil
    supabase.queue('audit_logs', { data: null, error: null });

    const resultado = await excluirAvaliador({ avaliadorId: 'aval-1' }, 'prof-1');

    expect(resultado).toEqual({ success: true, id: 'aval-1', nome: 'Prof Banca' });
    expect(supabase.auth.admin.deleteUser).toHaveBeenCalledWith('aval-1');
  });

  it('BLOQUEIA a exclusao de perfil que nao e avaliador (HTTP 400) e nao apaga a conta', async () => {
    const supabase = holder.supabase;

    supabase.auth.admin.deleteUser = vi.fn();
    supabase.queue('profiles', {
      data: { id: 'lider-1', nome: 'Ana Lider', email: 'ana@escola.com', role: 'lider' },
      error: null,
    });

    await expect(excluirAvaliador({ avaliadorId: 'lider-1' }, 'prof-1')).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(supabase.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('retorna 404 quando o avaliador nao existe', async () => {
    holder.supabase.queue('profiles', { data: null, error: null });

    await expect(excluirAvaliador({ avaliadorId: 'nao-existe' }, 'prof-1')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('retorna HTTP 400 quando o banco impede a exclusao da conta', async () => {
    const supabase = holder.supabase;

    supabase.auth.admin.deleteUser = vi.fn().mockResolvedValue({ data: null, error: { message: 'FK violation' } });
    supabase.queue('profiles', {
      data: { id: 'aval-1', nome: 'Prof Banca', email: 'banca@escola.com', role: 'avaliador' },
      error: null,
    });

    await expect(excluirAvaliador({ avaliadorId: 'aval-1' }, 'prof-1')).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});