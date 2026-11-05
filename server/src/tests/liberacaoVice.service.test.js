import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseMock } from '../test/supabaseMock.js';
import { definirLiberacaoVice, viceEstaLiberado } from '../services/liberacaoVice.service.js';

const holder = vi.hoisted(() => ({ supabase: null }));

vi.mock('../config/supabase.js', () => ({
  get supabaseAdmin() {
    return holder.supabase;
  },
}));

beforeEach(() => {
  holder.supabase = createSupabaseMock();
});

describe('liberacaoViceService.viceEstaLiberado', () => {
  it('retorna true quando existe liberacao para o grupo e bimestre', async () => {
    holder.supabase.queue('liberacoes_vice', { data: { grupo_id: 'g1' }, error: null });

    expect(await viceEstaLiberado('g1', 2)).toBe(true);
  });

  it('retorna false quando nao existe liberacao', async () => {
    holder.supabase.queue('liberacoes_vice', { data: null, error: null });

    expect(await viceEstaLiberado('g1', 2)).toBe(false);
  });

  it('lanca HTTP 500 quando a consulta falha', async () => {
    holder.supabase.queue('liberacoes_vice', { data: null, error: { message: 'falhou' } });

    await expect(viceEstaLiberado('g1', 2)).rejects.toMatchObject({ statusCode: 500 });
  });
});

describe('liberacaoViceService.definirLiberacaoVice', () => {
  it('libera a avaliacao do vice e registra auditoria', async () => {
    const supabase = holder.supabase;

    supabase.queue('grupos', { data: { id: 'g1', vice_lider_id: 'vice-1' }, error: null });
    supabase.queue('liberacoes_vice', { data: null, error: null });
    supabase.queue('audit_logs', { data: null, error: null });

    const resultado = await definirLiberacaoVice({
      grupoId: 'g1',
      bimestre: 2,
      liberado: true,
      professorId: 'prof-1',
    });

    expect(resultado).toEqual({ grupo_id: 'g1', bimestre: 2, liberado: true });
  });

  it('retira a liberacao sem apagar notas', async () => {
    const supabase = holder.supabase;

    supabase.queue('grupos', { data: { id: 'g1', vice_lider_id: 'vice-1' }, error: null });
    supabase.queue('liberacoes_vice', { data: null, error: null });
    supabase.queue('audit_logs', { data: null, error: null });

    const resultado = await definirLiberacaoVice({
      grupoId: 'g1',
      bimestre: 2,
      liberado: false,
      professorId: 'prof-1',
    });

    expect(resultado.liberado).toBe(false);
  });

  it('BLOQUEIA liberar um grupo que ainda nao tem vice-lider (HTTP 400)', async () => {
    holder.supabase.queue('grupos', { data: { id: 'g1', vice_lider_id: null }, error: null });

    await expect(
      definirLiberacaoVice({ grupoId: 'g1', bimestre: 1, liberado: true, professorId: 'prof-1' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('lanca HTTP 404 quando o grupo nao existe', async () => {
    holder.supabase.queue('grupos', { data: null, error: null });

    await expect(
      definirLiberacaoVice({ grupoId: 'nao-existe', bimestre: 1, liberado: true, professorId: 'prof-1' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('rejeita bimestre fora de 1 a 4 (HTTP 400)', async () => {
    await expect(
      definirLiberacaoVice({ grupoId: 'g1', bimestre: 5, liberado: true, professorId: 'prof-1' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});