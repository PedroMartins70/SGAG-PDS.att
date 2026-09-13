import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App.jsx';

/** Renderiza a aplicação a partir de uma rota inicial. */
function renderAt(caminho) {
  return render(
    <MemoryRouter initialEntries={[caminho]}>
      <App />
    </MemoryRouter>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  vi.restoreAllMocks();
});

describe('Fluxo de autenticação', () => {
  it('login e a primeira pagina e navega para o cadastro do professor', async () => {
    renderAt('/');

    expect(screen.getByRole('heading', { name: /bem-vindo/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cadastre-se/i }));

    expect(
      await screen.findByRole('heading', { name: /cadastrar nova conta/i })
    ).toBeInTheDocument();
  });

  it('cadastro do professor contem email e senha (sem codigo de verificacao)', () => {
    renderAt('/cadastro/professor');

    expect(screen.getByRole('heading', { name: /cadastrar nova conta/i })).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.queryByLabelText('Código de verificação')).not.toBeInTheDocument();
  });

  it('conclui o cadastro do professor e redireciona para o login', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ perfil: { id: 'p1', role: 'professor' } }),
    });

    renderAt('/cadastro/professor');

    fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'Prof Silva' } });
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'prof@gmail.com' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'Senha123' } });
    fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: 'Senha123' } });

    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(await screen.findByRole('heading', { name: /bem-vindo/i })).toBeInTheDocument();
  });

  it('mostra o motivo do erro ao falhar o login', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Senha incorreta. Verifique e tente novamente.' }),
    });

    renderAt('/login');

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'prof@gmail.com' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'errada' } });

    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByText(/senha incorreta/i)).toBeInTheDocument();
  });

  it('redireciona para o login quando nao ha sessao ao acessar /dashboard', () => {
    renderAt('/dashboard');

    expect(screen.getByRole('heading', { name: /bem-vindo/i })).toBeInTheDocument();
  });

  it('loga o professor e mostra o painel com as turmas', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/auth/login')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            session: { access_token: 'token-teste' },
            user: { id: 'p1', nome: 'Prof', role: 'professor' },
          }),
        });
      }
      if (url.includes('/turmas')) {
        return Promise.resolve({ ok: true, json: async () => ({ turmas: [{ id: 't1', nome: '3A' }] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ grupos: [] }) });
    });

    renderAt('/login');

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'prof@gmail.com' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'Senha123' } });

    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByRole('heading', { name: /painel do professor/i })).toBeInTheDocument();
    expect(await screen.findByText(/turma 3a/i)).toBeInTheDocument();
  });
});

describe('Tema claro/escuro', () => {
  it('alterna entre claro e escuro na tela de login', () => {
    renderAt('/login');

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    fireEvent.click(screen.getByRole('button', { name: /mudar para o tema escuro/i }));

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(screen.getByRole('button', { name: /mudar para o tema claro/i })).toBeInTheDocument();
  });
});
