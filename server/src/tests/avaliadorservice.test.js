import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseMock } from '../test/supabaseMock.js';
import { listarAvaliacoes, submeterAvaliacao, excluirAvaliacao } from '../services/avaliacao.service.js';

const holder = vi.hoisted(() => ({ supabase: null }));

vi.mock('../config/supabase.js', () => ({
  get supabaseAdmin() {
    return holder.supabase;
  },
}));

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

beforeEach(() => {
  holder.supabase = createSupabaseMock();
});

describe('avaliacaoService.listarAvaliacoes', () => {
  it('permite edicao para o lider do grupo', async () => {
    const supabase = holder.supabase;

    supabase.queue('grupos', { data: GRUPO, error: null });
    supabase.queue('integrantes', { data: [INTEGRANTE], error: null });
    supabase.queue('avaliacoes', { data: [], error: null });

    const resultado = await listarAvaliacoes('g1', { id: 'lider-1', role: 'lider' });

    expect(resultado.permissao.podeEditar).toBe(true);
    expect(resultado.integrantes).toHaveLength(1);
  });

  it('coloca o vice-lider em modo somente leitura quando o professor NAO liberou', async () => {
    const supabase = holder.supabase;

    supabase.queue('grupos', { data: GRUPO, error: null });
    supabase.queue('integrantes', { data: [INTEGRANTE], error: null });
    supabase.queue('avaliacoes', { data: [], error: null });
    supabase.queue('liberacoes_vice', { data: null, error: null });

    const resultado = await listarAvaliacoes('g1', { id: 'vice-1', role: 'vice_lider' });

    expect(resultado.permissao.podeEditar).toBe(false);
    expect(resultado.permissao.viceLiberado).toBe(false);
    expect(resultado.permissao.motivo).toContain('somente leitura');
  });

  it('libera a edicao do vice-lider quando o professor liberou o bimestre', async () => {
    const supabase = holder.supabase;

    supabase.queue('grupos', { data: GRUPO, error: null });
    supabase.queue('integrantes', { data: [INTEGRANTE], error: null });
    supabase.queue('avaliacoes', { data: [], error: null });
    supabase.queue('liberacoes_vice', { data: { grupo_id: 'g1' }, error: null });

    const resultado = await listarAvaliacoes('g1', { id: 'vice-1', role: 'vice_lider' }, 2);

    expect(resultado.permissao.podeEditar).toBe(true);
    expect(resultado.permissao.viceLiberado).toBe(true);
    expect(resultado.bimestre).toBe(2);
  });

  it('nao libera um vice-lider que pertence a outro grupo, mesmo com liberacao', async () => {
    const supabase = holder.supabase;

    supabase.queue('grupos', { data: GRUPO, error: null });
    supabase.queue('integrantes', { data: [INTEGRANTE], error: null });
    supabase.queue('avaliacoes', { data: [], error: null });
    supabase.queue('liberacoes_vice', { data: { grupo_id: 'g1' }, error: null });

    const resultado = await listarAvaliacoes('g1', { id: 'outro-vice', role: 'vice_lider' });

    expect(resultado.permissao.podeEditar).toBe(false);
    expect(resultado.permissao.motivo).toBe('Voce nao e o vice-lider deste grupo');
  });
});

describe('avaliacaoService.submeterAvaliacao', () => {
  it('lider submete a avaliacao com sucesso', async () => {
    const supabase = holder.supabase;

    supabase.queue('grupos', { data: GRUPO, error: null });
    supabase.queue('integrantes', { data: INTEGRANTE, error: null });
    supabase.queue('avaliacoes', { data: null, error: null });
    supabase.queue('avaliacoes', { data: { id: 'av1', ...NOTAS, integrante_id: 'i1' }, error: null });
    supabase.queue('audit_logs', { data: null, error: null });

    const resultado = await submeterAvaliacao({
      grupoId: 'g1',
      integranteId: 'i1',
      notas: NOTAS,
      usuario: { id: 'lider-1', role: 'lider' },
    });

    expect(resultado.integrante_id).toBe('i1');
  });

  it('vice-lider submete quando o professor liberou o bimestre', async () => {
    const supabase = holder.supabase;

    supabase.queue('grupos', { data: GRUPO, error: null });
    supabase.queue('integrantes', { data: INTEGRANTE, error: null });
    supabase.queue('avaliacoes', { data: null, error: null });
    supabase.queue('liberacoes_vice', { data: { grupo_id: 'g1' }, error: null });
    supabase.queue('avaliacoes', { data: { id: 'av1', integrante_id: 'i1' }, error: null });
    supabase.queue('audit_logs', { data: null, error: null });

    const resultado = await submeterAvaliacao({
      grupoId: 'g1',
      integranteId: 'i1',
      bimestre: 1,
      notas: NOTAS,
      usuario: { id: 'vice-1', role: 'vice_lider' },
    });

    expect(resultado.integrante_id).toBe('i1');
  });

  it('BLOQUEIA o vice-lider quando o professor NAO liberou o bimestre', async () => {
    const supabase = holder.supabase;

    supabase.queue('grupos', { data: GRUPO, error: null });
    supabase.queue('integrantes', { data: INTEGRANTE, error: null });
    supabase.queue('avaliacoes', { data: null, error: null });
    supabase.queue('liberacoes_vice', { data: null, error: null });

    await expect(
      submeterAvaliacao({
        grupoId: 'g1',
        integranteId: 'i1',
        notas: NOTAS,
        usuario: { id: 'vice-1', role: 'vice_lider' },
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'Somente o lider avalia neste bimestre. O professor pode liberar a avaliacao para o vice-lider.',
    });
  });

  it('BLOQUEIA o vice-lider liberado de sobrescrever a nota que o lider ja deu', async () => {
    const supabase = holder.supabase;

    supabase.queue('grupos', { data: GRUPO, error: null });
    supabase.queue('integrantes', { data: INTEGRANTE, error: null });
    supabase.queue('avaliacoes', { data: { id: 'av1', avaliador_id: 'lider-1' }, error: null });
    supabase.queue('liberacoes_vice', { data: { grupo_id: 'g1' }, error: null });

    await expect(
      submeterAvaliacao({
        grupoId: 'g1',
        integranteId: 'i1',
        notas: NOTAS,
        usuario: { id: 'vice-1', role: 'vice_lider' },
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'O lider ja avaliou este integrante; o vice-lider nao pode sobrescrever a nota',
    });
  });

  it('BLOQUEIA o vice-lider quando o professor ja alterou a nota (mesmo liberado)', async () => {
    const supabase = holder.supabase;

    supabase.queue('grupos', { data: GRUPO, error: null });
    supabase.queue('integrantes', { data: INTEGRANTE, error: null });
    supabase.queue('avaliacoes', {
      data: { id: 'av1', avaliador_id: 'prof-1', alterado_por_professor: true },
      error: null,
    });

    await expect(
      submeterAvaliacao({
        grupoId: 'g1',
        integranteId: 'i1',
        notas: NOTAS,
        usuario: { id: 'vice-1', role: 'vice_lider' },
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('BLOQUEIA vice-lider que nao pertence ao grupo', async () => {
    const supabase = holder.supabase;

    supabase.queue('grupos', { data: GRUPO, error: null });
    supabase.queue('integrantes', { data: INTEGRANTE, error: null });

    await expect(
      submeterAvaliacao({
        grupoId: 'g1',
        integranteId: 'i1',
        notas: NOTAS,
        usuario: { id: 'outro-vice', role: 'vice_lider' },
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'Apenas o vice-lider do grupo pode submeter as notas',
    });
  });

  it('BLOQUEIA lider que nao pertence ao grupo', async () => {
    const supabase = holder.supabase;

    supabase.queue('grupos', { data: GRUPO, error: null });
    supabase.queue('integrantes', { data: INTEGRANTE, error: null });

    await expect(
      submeterAvaliacao({
        grupoId: 'g1',
        integranteId: 'i1',
        notas: NOTAS,
        usuario: { id: 'outro-lider', role: 'lider' },
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'Apenas o lider do grupo pode submeter as notas',
    });
  });

  it('BLOQUEIA perfil sem papel de avaliador', async () => {
    const supabase = holder.supabase;

    supabase.queue('grupos', { data: GRUPO, error: null });
    supabase.queue('integrantes', { data: INTEGRANTE, error: null });

    await expect(
      submeterAvaliacao({
        grupoId: 'g1',
        integranteId: 'i1',
        notas: NOTAS,
        usuario: { id: 'x', role: 'aluno' },
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('professor e bloqueado quando nao informa o comentario de esclarecimento', async () => {
    const supabase = holder.supabase;

    supabase.queue('grupos', { data: GRUPO, error: null });
    supabase.queue('integrantes', { data: INTEGRANTE, error: null });

    await expect(
      submeterAvaliacao({
        grupoId: 'g1',
        integranteId: 'i1',
        notas: { ...NOTAS, comentario_esclarecimento: '  ' },
        usuario: { id: 'prof-1', role: 'professor' },
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'O comentario de esclarecimento e obrigatorio para o professor',
    });
  });

  it('professor sobrescreve nota com esclarecimento e flag alterado_por_professor=true', async () => {
    const supabase = holder.supabase;

    supabase.queue('grupos', { data: GRUPO, error: null });
    supabase.queue('integrantes', { data: INTEGRANTE, error: null });
    supabase.queue('avaliacoes', {
      data: { id: 'av1', avaliador_id: 'lider-1' },
      error: null,
    });
    supabase.queue('avaliacoes', { data: { id: 'av1', alterado_por_professor: true }, error: null });
    supabase.queue('audit_logs', { data: null, error: null });

    const resultado = await submeterAvaliacao({
      grupoId: 'g1',
      integranteId: 'i1',
      notas: { ...NOTAS, comentario_esclarecimento: 'Reavaliacao da banca' },
      usuario: { id: 'prof-1', role: 'professor' },
    });

    expect(resultado.alterado_por_professor).toBe(true);
  });
});

describe('avaliacaoService.excluirAvaliacao', () => {
  it('exclui avaliacao existente com justificativa', async () => {
    const supabase = holder.supabase;

    supabase.queue('avaliacoes', { data: { id: 'av1', integrante_id: 'i1' }, error: null });
    supabase.queue('avaliacoes', { data: null, error: null });
    supabase.queue('audit_logs', { data: null, error: null });

    const resultado = await excluirAvaliacao({
      grupoId: 'g1',
      integranteId: 'i1',
      comentario: 'Nota excluida pela banca',
      professorId: 'prof-1',
    });

    expect(resultado.success).toBe(true);
  });

  it('lanca HTTP 404 quando a avaliacao nao existe', async () => {
    const supabase = holder.supabase;

    supabase.queue('avaliacoes', { data: null, error: null });

    await expect(
      excluirAvaliacao({
        grupoId: 'g1',
        integranteId: 'i1',
        comentario: 'Justificativa',
        professorId: 'prof-1',
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});