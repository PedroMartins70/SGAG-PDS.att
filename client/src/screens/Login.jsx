import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, Shield, BarChart3, User } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Input from '../components/ui/Input.jsx';
import ThemeToggle from '../components/ui/ThemeToggle.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import RoboBoasVindas from '../components/RoboBoasVindas.jsx';
import LinkPrivacidade from '../components/PoliticaPrivacidade.jsx';
import TrocarSenhaObrigatoria from '../components/TrocarSenhaObrigatoria.jsx';

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
 * Ilustração decorativa da coluna esquerda do login.
 * Composta por elementos SVG: gráfico, escudo, planta.
 */
function IlustracaoLogin() {
  return (
    <div className="relative hidden w-full md:block">
      <div className="flex h-full flex-col items-center justify-center gap-8 p-8">
        {/* Gráfico de barras */}
        <div className="relative rounded-2xl border border-border bg-surface p-6 shadow-lg">
          <div className="flex items-end gap-3">
            <div className="h-16 w-8 rounded-t-lg bg-primary/80" />
            <div className="h-24 w-8 rounded-t-lg bg-primary" />
            <div className="h-12 w-8 rounded-t-lg bg-primary/60" />
            <div className="h-20 w-8 rounded-t-lg bg-primary/90" />
          </div>
          <div className="mt-3 h-1 w-full rounded-full bg-success" />
        </div>

        {/* Escudo com cadeado */}
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-soft">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-success-soft">
            <Lock className="h-8 w-8 text-success" />
          </div>
        </div>

        {/* Planta decorativa */}
        <svg viewBox="0 0 80 100" className="h-20 w-16" aria-hidden="true">
          <rect x="25" y="60" width="30" height="35" rx="4" fill="#CBD5E1" />
          <path d="M40 60c0-15-12-25-12-40s12-10 12 0c0-10 12-15 12 0s-12 25-12 40Z" fill="#22C55E" />
          <path d="M40 50c-8 0-18-5-20-15 10 2 16 8 20 15Z" fill="#16A34A" />
        </svg>
      </div>
    </div>
  );
}

/**
 * Tela de login (primeira página). Autentica o usuário e redireciona ao painel.
 * Layout dividido: ilustração à esquerda, formulário à direita.
 *
 * Quem entra com uma senha temporária (redefinida pelo professor) vê, no lugar do
 * login, a tela que obriga a criar uma senha própria.
 *
 * @returns {JSX.Element} Tela de login.
 */
export default function Login() {
  const { session, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    // Com senha temporária, não vai ao painel: antes precisa criar uma senha nova
    if (session && !session.user?.senha_temporaria) {
      navigate('/dashboard');
    }
  }, [session, navigate]);

  async function handleSubmit(evento) {
    evento.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await login(email, senha);
    } catch (e) {
      setErro(e.message || 'Nao foi possivel entrar');
    } finally {
      setCarregando(false);
    }
  }

  // Senha temporária (redefinida pelo professor): obriga a criar uma nova antes de usar o sistema
  if (session?.user?.senha_temporaria) {
    return <TrocarSenhaObrigatoria />;
  }

  return (
    <div className="relative flex min-h-screen bg-canvas">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      {/* Coluna esquerda — ilustração e branding
          (lg:pb-44 reserva espaço embaixo para o robô não tampar nada) */}
      <div className="hidden w-1/2 flex-col items-center justify-center bg-primary/5 lg:flex lg:pb-44">
        <div className="flex flex-col items-center gap-6 px-8 text-center">
          <div className="flex items-center gap-3">
            <LogoIcon className="h-10 w-10" />
            <div className="text-left">
              <h2 className="font-display text-xl font-bold text-primary">SGAG-PDS</h2>
              <p className="text-xs text-text-muted">Sistema de Gestão e Avaliação</p>
            </div>
          </div>
          <IlustracaoLogin />
          <div className="max-w-xs">
            <h3 className="font-display text-2xl font-bold text-text">
              Organize seus grupos
              <span className="text-primary"> de forma simples.</span>
            </h3>
            <p className="mt-2 text-sm text-text-muted">
              Cadastre-se para acessar o sistema e gerenciar seu projeto de forma simples, organizada e eficiente.
            </p>
          </div>
        </div>
      </div>

      {/* Coluna direita — formulário
          (pb-28 / sm:pb-40 reservam espaço embaixo no celular e tablet para o robô) */}
      <div className="flex w-full items-center justify-center p-4 pb-28 sm:pb-40 lg:w-1/2 lg:pb-4">
        <Card className="w-full max-w-md p-6 sm:p-8">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft">
              <User className="h-7 w-7 text-primary" />
            </div>
            <h1 className="font-display text-2xl font-bold text-text">Bem-vindo!</h1>
            <p className="text-text-muted">Acesse sua conta para continuar.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="E-mail"
              type="email"
              icon={Mail}
              placeholder="seunome@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div className="relative">
              <Input
                label="Senha"
                type={mostrar ? 'text' : 'password'}
                icon={Lock}
                placeholder="Sua senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setMostrar((v) => !v)}
                aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-3.5 top-10 text-text-muted transition-colors hover:text-text"
              >
                {mostrar ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            {erro && (
              <div className="rounded-lg border border-danger-soft bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
                {erro}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={carregando || !email || !senha}>
              {carregando ? 'Entrando...' : 'Entrar'}
            </Button>

            <div className="flex items-center justify-center gap-1 pt-1">
              <span className="text-sm text-text-muted">Ainda não tem conta?</span>
              <Button variant="ghost" size="sm" onClick={() => navigate('/cadastro/professor')}>
                Cadastre-se
              </Button>
            </div>
          </form>

          <p className="mt-4 text-center text-xs text-text-muted">
            Ao usar o sistema, você declara ter lido a <LinkPrivacidade />.
          </p>
        </Card>
      </div>

      {/* Robô de boas-vindas (canto inferior esquerdo) */}
      <RoboBoasVindas />
    </div>
  );
}
