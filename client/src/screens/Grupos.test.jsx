import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Grupos from './Grupos.jsx';

vi.mock('../auth/AuthContext.jsx', () => ({
  useAuth: () => ({
    session: { token: 'token-teste', user: { role: 'professor', nome: 'Prof' } },
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

const TURMAS = [
  { id: 't1', nome: '3A' },
  { id: 't2', nome: '3B' },
];

const PERFIS = [
  { id: 'l1', nome: 'Ana Lider', email: 'ana@gmail.com', role: 'lider', is_active: true },
  { id: 'v1', nome: 'Bia Vice', email: 'bia@gmail.com', role: 'vice_lider', is_active: true },
];

function grupo(id, nome, { lideres = [], vices = [] } = {}) {
  return {
    id,
    nome,
    lider_id: lideres[0] ?? null,
    vice_lider_id: vices[0] ?? null,
    lider: lideres[0] ? { id: lideres[0], nome: 'Ana Lider' } : null,
    vice: vices[0] ? { id: vices[0], nome: 'Bia Vice' } : null,
    integrantes: [],
  };
}

/** Configura o mock de fetch com os dados fornecidos. */
function mockFetch({ gruposT1 }) {
  global.fetch = vi.fn((url, opts) => {
    const method = (opts?.method || 'GET').toUpperCase();
    const path = url.replace('http://localhost:5000/api', '');

    if (method === 'POST' && path.includes('/grupos')) {
      return Promise.resolve({
        ok: true,
        status: 201,
        json: async () => ({ grupo: { id: 'g9', nome: JSON.parse(opts.body).nome, lider_id: null, vice_lider_id: null, integrantes: [] } }),
      });
    }
    if (method === 'POST' && path.includes('/profiles')) {
      return Promise.resolve({
        ok: true,
        status: 201,
        json: async () => ({ perfil: { id: 'p9', role: JSON.parse(opts.body).role } }),
      });
    }
    if (path.includes('/profiles')) {
      return Promise.resolve({ ok: true, json: async () => ({ perfis: PERFIS }) });
    }
    if (path.endsWith('/grupos')) {
      const turmaId = path.split('/')[2];
      return Promise.resolve({ ok: true, json: async () => ({ grupos: turmaId === 't1' ? gruposT1 : [] }) });
    }
    if (path.endsWith('/turmas')) {
      return Promise.resolve({ ok: true, json: async () => ({ turmas: TURMAS }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

function renderizar() {
  return render(
    <MemoryRouter>
      <Grupos />
    </MemoryRouter>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('Página de Cadastro de Grupos', () => {
  it('mostra as turmas e os grupos com integrantes e badges de papel', async () => {
    const gruposT1 = [
      {
        ...grupo('g1', 'Grupo 1', { lideres: ['l1'], vices: ['v1'] }),
        integrantes: [
          { id: 'l1', nome_aluno: 'Ana Lider' },
          { id: 'v1', nome_aluno: 'Bia Vice' },
          { id: 'i1', nome_aluno: 'Carlos' },
        ],
      },
    ];
    mockFetch({ gruposT1 });

    renderizar();

    expect(await screen.findByText('Grupo 1')).toBeInTheDocument();
    expect(screen.getByText('Ana Lider')).toBeInTheDocument();
    expect(screen.getByText('Bia Vice')).toBeInTheDocument();
    expect(screen.getByText('Carlos')).toBeInTheDocument();
    expect(screen.getAllByText('Turma 3A').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Turma 3B').length).toBeGreaterThan(0);
  });

  it('desabilita "Novo grupo" e mostra aviso quando a turma atinge 7 grupos', async () => {
    const gruposT1 = [1, 2, 3, 4, 5, 6, 7].map((n) => grupo(`g${n}`, `Grupo ${n}`));
    mockFetch({ gruposT1 });

    renderizar();

    await waitFor(() => expect(screen.getByRole('button', { name: /novo grupo/i })).toBeDisabled());
    expect(screen.getByText(/limite de 7 grupos atingido/i)).toBeInTheDocument();
  });

  it('habilita o botao "Novo grupo" quando a turma tem menos de 7 grupos', async () => {
    const gruposT1 = [grupo('g1', 'Grupo 1')];
    mockFetch({ gruposT1 });

    renderizar();

    expect(await screen.findByRole('button', { name: /novo grupo/i })).toBeEnabled();
  });

  it('professor cadastra um lider/vice pelo modal (gmail, nome e senha)', async () => {
    mockFetch({ gruposT1: [] });

    renderizar();

    fireEvent.click(await screen.findByRole('button', { name: /cadastrar líder \/ vice/i }));

    fireEvent.change(await screen.findByLabelText('Gmail'), { target: { value: 'ana@gmail.com' } });
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ana Lider' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'Senha123' } });
    fireEvent.click(screen.getByRole('button', { name: /vice-líder/i }));
    fireEvent.click(screen.getByRole('button', { name: /^cadastrar$/i }));

    await waitFor(() => {
      const chamada = global.fetch.mock.calls.find(([url, opts]) => opts?.method === 'POST' && url.includes('/profiles'));
      expect(chamada).toBeDefined();
      const corpo = JSON.parse(chamada[1].body);
      expect(corpo.email).toBe('ana@gmail.com');
      expect(corpo.nome).toBe('Ana Lider');
      expect(corpo.role).toBe('vice_lider');
    });
  });
});
