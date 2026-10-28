import { useState } from 'react';
import { Check, KeyRound } from 'lucide-react';
import Button from './ui/Button.jsx';
import Card from './ui/Card.jsx';
import { FormTrocarSenha } from './TrocarSenha.jsx';
import { useAuth } from '../auth/AuthContext.jsx';

/**
 * Tela cheia mostrada quando a pessoa entra com uma SENHA TEMPORÁRIA
 * (redefinida pelo professor). Ela precisa criar uma senha só dela antes de usar o sistema.
 * Depois de trocar, a sessão é encerrada e ela entra de novo com a senha nova.
 *
 * @returns {JSX.Element} Tela de troca obrigatória.
 */
export default function TrocarSenhaObrigatoria() {
  const { session, logout } = useAuth();
  const [concluida, setConcluida] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft">
            {concluida ? <Check className="h-7 w-7 text-success" /> : <KeyRound className="h-7 w-7 text-primary" />}
          </div>
          <h1 className="font-display text-2xl font-bold text-text">
            {concluida ? 'Senha alterada!' : 'Crie uma nova senha'}
          </h1>
          <p className="text-sm text-text-muted">
            {concluida
              ? 'Agora entre no sistema usando a sua nova senha.'
              : `${session?.user?.nome ? `${session.user.nome}, você` : 'Você'} entrou com uma senha temporária, que o professor conhece. Por segurança, crie uma senha só sua para continuar.`}
          </p>
        </div>

        {concluida ? (
          <Button className="w-full" onClick={logout}>
            Entrar com a nova senha
          </Button>
        ) : (
          <>
            <FormTrocarSenha onSucesso={() => setConcluida(true)} />
            <Button variant="ghost" className="mt-3 w-full" onClick={logout}>
              Sair
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
