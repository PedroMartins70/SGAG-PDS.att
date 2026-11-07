import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseMock } from '../test/supabaseMock.js';
import { designarLider, designarViceLider } from '../services/grupo.service.js';

const holder = vi.hoisted(() => ({ supabase: null }));

vi.mock('../config/supabase.js', () => ({
  get supabaseAdmin() {
    return holder.supabase;
  },
}));

const LIDER_ANTIGO = { id: 'lider-antigo', nome: 'Lider Antigo' };
const VICE_ANTIGO = { id: 'vice-antigo', nome: 'Vice Antigo' };

const GRUPO = {
  id: 'g1',
  turma_id: 'turma-3a',
  nome: 'Grupo Alfa',
  lider_id: LIDER_ANTIGO.id,
  vice_lider_id: VICE_ANTIGO.id,
};

const NOVO_LIDER = { id: 'lider-novo', nome: 'Ana Lider', email: 'ana@escola.com', role: 'lider', is_active: true };
const NOVO_VICE = { id: 'vice-novo', nome: 'Bia Vice', email: 'bia@escola.com', role: 'vice_lider', is_active: true };

/** Enfileira as gravações de auditoria (uma por operação que grava). */
function auditorias(supabase, quantidade) {
  for (let i = 0; i < quantidade; i += 1) {
    supabase.queue('audit_logs', { data: null, error: null });
  }
}

beforeEach(() => {
  holder.supabase = createSupabaseMock();
});

describe('grupoService.designarLider (troca de lider em grupo ja criado)', () => {
  it('adiciona o novo lider na lista e REMOVE o lider antigo do grupo', async () => {
    const supabase = holder.supabase;

    supabase.queue('grupos', { data: GRUPO, error: null }); // buscarGrupo
    supabase.queue('profiles', { data: NOVO_LIDER, error: null }); // perfil novo
    supabase.queue('grupos', { data: [], error: null }); // nao lidera outro grupo
    supabase.queue('integrantes', {
      data: [
        { id: 'i0', nome_aluno: 'Lider Antigo' },
        { id: 'i1', nome_aluno: 'Carlos' },
      ],
      error: null,
    }); // lista atual
    supabase.queue('profiles', { data: { nome: LIDER_ANTIGO.nome }, error: null }); // perfil antigo
    supabase.queue('integrantes', { data: { id: 'i9', nome_aluno: 'Ana Lider' }, error: null }); // insert
    supabase.queue('grupos', { data: null, error: null }); // update do lider
    supabase.queue('integrantes', { data: null, error: null }); // delete do antigo
    auditorias(supabase, 3);

    const resultado = await designarLider({ grupoId: 'g1', perfilId: NOVO_LIDER.id, professorId: 'prof-1' });

    expect(resultado).toEqual({
      id: 'g1',
      lider_id: 'lider-novo',
      integrante_adicionado: true,
      integrante_removido: true,
    });
  });

  it('nao duplica o integrante quando o nome novo ja esta na lista, mas remove o antigo', async () => {
    const supabase = holder.supabase;

    supabase.queue('grupos', { data: GRUPO, error: null });
    supabase.queue('profiles', { data: NOVO_LIDER, error: null });
    supabase.queue('grupos', { data: [], error: null });
    supabase.queue('integrantes', {
      data: [
        { id: 'i0', nome_aluno: 'Lider Antigo' },
        { id: 'i1', nome_aluno: '  ana lider ' },
      ],
      error: null,
    });
    supabase.queue('profiles', { data: { nome: LIDER_ANTIGO.nome }, error: null });
    supabase.queue('grupos', { data: null, error: null });
    supabase.queue('integrantes', { data: null, error: null }); // delete do antigo
    auditorias(supabase, 2);

    const resultado = await designarLider({ grupoId: 'g1', perfilId: NOVO_LIDER.id, professorId: 'prof-1' });

    expect(resultado.integrante_adicionado).toBe(false);
    expect(resultado.integrante_removido).toBe(true);
  });

  it('permite a troca com o grupo cheio, porque o antigo libera uma vaga', async () => {
    const supabase = holder.supabase;
    const cheio = [
      { id: 'i0', nome_aluno: 'Lider Antigo' },
      ...Array.from({ length: 9 }, (_, i) => ({ id: `i${i + 1}`, nome_aluno: `Aluno ${i + 1}` })),
    ];

    supabase.queue('grupos', { data: GRUPO, error: null });
    supabase.queue('profiles', { data: NOVO_LIDER, error: null });
    supabase.queue('grupos', { data: [], error: null });
    supabase.queue('integrantes', { data: cheio, error: null });
    supabase.queue('profiles', { data: { nome: LIDER_ANTIGO.nome }, error: null });
    supabase.queue('integrantes', { data: { id: 'i9', nome_aluno: 'Ana Lider' }, error: null });
    supabase.queue('grupos', { data: null, error: null });
    supabase.queue('integrantes', { data: null, error: null });
    auditorias(supabase, 3);

    const resultado = await designarLider({ grupoId: 'g1', perfilId: NOVO_LIDER.id, professorId: 'prof-1' });

    expect(resultado.integrante_adicionado).toBe(true);
    expect(resultado.integrante_removido).toBe(true);
  });

  it('BLOQUEIA quando o grupo esta no limite e o antigo nao esta na lista (HTTP 400)', async () => {
    const supabase = holder.supabase;
    const dezIntegrantes = Array.from({ length: 10 }, (_, i) => ({ id: `i${i}`, nome_aluno: `Aluno ${i}` }));

    supabase.queue('grupos', { data: GRUPO, error: null });
    supabase.queue('profiles', { data: NOVO_LIDER, error: null });
    supabase.queue('grupos', { data: [], error: null });
    supabase.queue('integrantes', { data: dezIntegrantes, error: null });
    supabase.queue('profiles', { data: { nome: LIDER_ANTIGO.nome }, error: null });

    await expect(
      designarLider({ grupoId: 'g1', perfilId: NOVO_LIDER.id, professorId: 'prof-1' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('nao remove ninguem quando o lider antigo nao esta na lista de integrantes', async () => {
    const supabase = holder.supabase;

    supabase.queue('grupos', { data: GRUPO, error: null });
    supabase.queue('profiles', { data: NOVO_LIDER, error: null });
    supabase.queue('grupos', { data: [], error: null });
    supabase.queue('integrantes', { data: [{ id: 'i1', nome_aluno: 'Carlos' }], error: null });
    supabase.queue('profiles', { data: { nome: LIDER_ANTIGO.nome }, error: null });
    supabase.queue('integrantes', { data: { id: 'i9', nome_aluno: 'Ana Lider' }, error: null });
    supabase.queue('grupos', { data: null, error: null });
    auditorias(supabase, 2);

    const resultado = await designarLider({ grupoId: 'g1', perfilId: NOVO_LIDER.id, professorId: 'prof-1' });

    expect(resultado.integrante_adicionado).toBe(true);
    expect(resultado.integrante_removido).toBe(false);
  });

  it('em grupo sem lider anterior, so adiciona o novo (nao consulta nem remove ninguem)', async () => {
    const supabase = holder.supabase;

    supabase.queue('grupos', { data: { ...GRUPO, lider_id: null }, error: null });
    supabase.queue('profiles', { data: NOVO_LIDER, error: null });
    supabase.queue('grupos', { data: [], error: null });
    supabase.queue('integrantes', { data: [], error: null });
    supabase.queue('integrantes', { data: { id: 'i9', nome_aluno: 'Ana Lider' }, error: null });
    supabase.queue('grupos', { data: null, error: null });
    auditorias(supabase, 2);

    const resultado = await designarLider({ grupoId: 'g1', perfilId: NOVO_LIDER.id, professorId: 'prof-1' });

    expect(resultado.integrante_adicionado).toBe(true);
    expect(resultado.integrante_removido).toBe(false);
  });

  it('BLOQUEIA perfil que ja lidera ou e vice de OUTRO grupo (HTTP 400)', async () => {
    const supabase = holder.supabase;

    supabase.queue('grupos', { data: GRUPO, error: null });
    supabase.queue('profiles', { data: NOVO_LIDER, error: null });
    supabase.queue('grupos', { data: [{ id: 'g2', nome: 'Grupo Beta' }], error: null });

    await expect(
      designarLider({ grupoId: 'g1', perfilId: NOVO_LIDER.id, professorId: 'prof-1' })
    ).rejects.toMatchObject({ statusCode: 400, message: 'Este perfil ja e lider ou vice-lider do grupo "Grupo Beta"' });
  });

  it('BLOQUEIA perfil que nao tem o papel de lider (HTTP 400)', async () => {
    const supabase = holder.supabase;

    supabase.queue('grupos', { data: GRUPO, error: null });
    supabase.queue('profiles', { data: NOVO_VICE, error: null });

    await expect(
      designarLider({ grupoId: 'g1', perfilId: NOVO_VICE.id, professorId: 'prof-1' })
    ).rejects.toMatchObject({ statusCode: 400, message: 'O perfil indicado nao possui o papel de lider' });
  });

  it('BLOQUEIA perfil desativado (HTTP 400)', async () => {
    const supabase = holder.supabase;

    supabase.queue('grupos', { data: GRUPO, error: null });
    supabase.queue('profiles', { data: { ...NOVO_LIDER, is_active: false }, error: null });

    await expect(
      designarLider({ grupoId: 'g1', perfilId: NOVO_LIDER.id, professorId: 'prof-1' })
    ).rejects.toMatchObject({ statusCode: 400, message: 'Perfil desativado' });
  });
});

describe('grupoService.designarViceLider (troca de vice em grupo ja criado)', () => {
  it('adiciona o novo vice na lista e REMOVE o vice antigo do grupo', async () => {
    const supabase = holder.supabase;

    supabase.queue('grupos', { data: GRUPO, error: null });
    supabase.queue('profiles', { data: NOVO_VICE, error: null });
    supabase.queue('grupos', { data: [], error: null });
    supabase.queue('integrantes', {
      data: [
        { id: 'i0', nome_aluno: 'Vice Antigo' },
        { id: 'i1', nome_aluno: 'Carlos' },
      ],
      error: null,
    });
    supabase.queue('profiles', { data: { nome: VICE_ANTIGO.nome }, error: null });
    supabase.queue('integrantes', { data: { id: 'i9', nome_aluno: 'Bia Vice' }, error: null });
    supabase.queue('grupos', { data: null, error: null });
    supabase.queue('integrantes', { data: null, error: null });
    auditorias(supabase, 3);

    const resultado = await designarViceLider({ grupoId: 'g1', perfilId: NOVO_VICE.id, professorId: 'prof-1' });

    expect(resultado).toEqual({
      id: 'g1',
      vice_lider_id: 'vice-novo',
      integrante_adicionado: true,
      integrante_removido: true,
    });
  });

  it('BLOQUEIA escolher como vice quem ja e o lider deste grupo (HTTP 400)', async () => {
    const supabase = holder.supabase;

    supabase.queue('grupos', { data: { ...GRUPO, lider_id: NOVO_VICE.id }, error: null });
    supabase.queue('profiles', { data: NOVO_VICE, error: null });

    await expect(
      designarViceLider({ grupoId: 'g1', perfilId: NOVO_VICE.id, professorId: 'prof-1' })
    ).rejects.toMatchObject({ statusCode: 400, message: 'O perfil ja e o lider deste grupo' });
  });

  it('BLOQUEIA perfil que nao tem o papel de vice-lider (HTTP 400)', async () => {
    const supabase = holder.supabase;

    supabase.queue('grupos', { data: GRUPO, error: null });
    supabase.queue('profiles', { data: NOVO_LIDER, error: null });

    await expect(
      designarViceLider({ grupoId: 'g1', perfilId: NOVO_LIDER.id, professorId: 'prof-1' })
    ).rejects.toMatchObject({ statusCode: 400, message: 'O perfil indicado nao possui o papel de vice-lider' });
  });

  it('lanca HTTP 404 quando o grupo nao existe', async () => {
    holder.supabase.queue('grupos', { data: null, error: null });

    await expect(
      designarViceLider({ grupoId: 'nao-existe', perfilId: NOVO_VICE.id, professorId: 'prof-1' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});