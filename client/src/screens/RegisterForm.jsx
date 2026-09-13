import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Mail, User, Shield, CheckCircle } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Input from '../components/ui/Input.jsx';
import ThemeToggle from '../components/ui/ThemeToggle.jsx';
import { api } from '../services/api.js';

/**
 * Ícone de logo do SGAG-PDS (versão inline, sem dependências externas).
 */
function LogoIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill="#2563EB" />
      <path d="M12 20c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8-8-3.6-8-8Z" fill="#FFFFFF" opacity="0.3" />
      <path d="M16 18l3 3 5-5" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/**
 * Tela de cadastro do Professor (único perfil que se cadastra por conta própria).
 * Líderes e Vice-Líderes são cadastrados pelo Professor (POST /profiles).
 * Layout dividido: ilustração à esquerda, formulário à direita.
 *
 * @returns {JSX.Element} Tela de cadastro do professor.
 */
export default function RegisterForm() {
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(evento) {
    evento.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await api('/auth/cadastrar', {
        method: 'POST',
        body: { nome, email, senha, confirmar_senha: confirmar, role: 'professor' },
      });
      navigate('/login', { state: { cadastrado: true } });
    } catch (e) {
      setErro(e.message || 'Nao foi possivel cadastrar');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="relative flex min-h-screen bg-canvas">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      {/* Coluna esquerda — branding e ilustração */}
      <div className="hidden w-1/2 flex-col items-center justify-center bg-primary/5 lg:flex">
        <div className="flex flex-col items-center gap-6 px-8 text-center">
          <div className="flex items-center gap-3">
            <LogoIcon className="h-10 w-10" />
            <div className="text-left">
              <h2 className="font-display text-xl font-bold text-primary">SGAG-PDS</h2>
              <p className="text-xs text-text-muted">Sistema de Gestão e Avaliação</p>
            </div>
          </div>

          <div className="max-w-xs">
            <h3 className="font-display text-2xl font-bold text-text">
              Crie sua conta
              <span className="text-secondary"> e faça parte dessa missão!</span>
            </h3>
            <p className="mt-2 text-sm text-text-muted">
              Cadastre-se para acessar o sistema e gerenciar seu projeto de forma simples, organizada e eficiente.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
              <Shield className="h-8 w-8 text-primary" />
              <div className="text-left">
                <p className="text-sm font-semibold text-text">Acesso seguro</p>
                <p className="text-xs text-text-muted">Seus dados protegidos</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
              <CheckCircle className="h-8 w-8 text-success" />
              <div className="text-left">
                <p className="text-sm font-semibold text-text">Gestão completa</p>
                <p className="text-xs text-text-muted">Avaliações em tempo real</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Coluna direita — formulário */}
      <div className="flex w-full items-center justify-center p-4 lg:w-1/2">
        <Card className="w-full max-w-md p-6 sm:p-8">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft">
              <User className="h-7 w-7 text-primary" />
            </div>
            <h1 className="font-display text-2xl font-bold text-text">Cadastrar nova conta</h1>
            <p className="text-text-muted">Preencha os dados abaixo para criar sua conta</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Nome completo" icon={User} placeholder="Digite seu nome completo" value={nome} onChange={(e) => setNome(e.target.value)} required />
            <Input
              label="E-mail"
              type="email"
              icon={Mail}
              placeholder="Digite seu e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input label="Senha" type="password" icon={Lock} placeholder="Crie sua senha" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            <Input
              label="Confirmar senha"
              type="password"
              icon={Lock}
              placeholder="Confirme sua senha"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              required
            />

            {erro && (
              <div className="rounded-lg border border-danger-soft bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
                {erro}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={carregando}>
              {carregando ? 'Cadastrando...' : 'Criar conta'}
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-center gap-1">
            <span className="text-sm text-text-muted">ou</span>
          </div>
          <div className="flex items-center justify-center gap-1 pt-2">
            <span className="text-sm text-text-muted">Já tem uma conta?</span>
            <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
              Faça login
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
