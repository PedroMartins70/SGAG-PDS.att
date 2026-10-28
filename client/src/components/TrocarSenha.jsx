import { useState } from 'react';
import { Check, Loader2, Lock, X } from 'lucide-react';
import Button from './ui/Button.jsx';
import Input from './ui/Input.jsx';
import Modal from './ui/Modal.jsx';
import { api } from '../services/api.js';
import { useAuth } from '../auth/AuthContext.jsx';

/** Regras da senha nova (iguais às do servidor). */
const REGRAS = [
  { chave: 'tamanho', texto: 'Pelo menos 8 caracteres', ok: (s) => s.length >= 8 },
  { chave: 'maiuscula', texto: 'Uma letra maiúscula', ok: (s) => /[A-Z]/.test(s) },
  { chave: 'minuscula', texto: 'Uma letra minúscula', ok: (s) => /[a-z]/.test(s) },
  { chave: 'numero', texto: 'Um número', ok: (s) => /[0-9]/.test(s) },
];

/**
 * Formulário para o usuário trocar a própria senha.
 * Pede a senha atual (no primeiro acesso, é a temporária que o professor passou).
 *
 * @param {Object} props
 * @param {Function} props.onSucesso Chamado depois que a senha for trocada.
 * @returns {JSX.Element} Formulário.
 */
export function FormTrocarSenha({ onSucesso }) {
  const { session } = useAuth();
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const regrasOk = REGRAS.every((regra) => regra.ok(nova));
  const igual = nova.length > 0 && nova === confirmacao;
  const diferenteDaAtual = nova !== atual;
  const pronto = atual.length > 0 && regrasOk && igual && diferenteDaAtual && !enviando;

  async function enviar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setErro('');
    try {
      await api('/auth/trocar-senha', {
        method: 'POST',
        token: session?.token,
        body: { senha_atual: atual, nova_senha: nova },
      });
      onSucesso();
    } catch (e) {
      setErro(e.message || 'Nao foi possivel trocar a senha.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Input
        label="Senha atual"
        type="password"
        icon={Lock}
        value={atual}
        onChange={(e) => setAtual(e.target.value)}
        autoComplete="current-password"
        required
      />
      <Input
        label="Nova senha"
        type="password"
        icon={Lock}
        value={nova}
        onChange={(e) => setNova(e.target.value)}
        autoComplete="new-password"
        required
      />

      <ul className="space-y-1 text-xs">
        {REGRAS.map((regra) => {
          const cumprida = regra.ok(nova);
          return (
            <li
              key={regra.chave}
              className={`flex items-center gap-1.5 ${cumprida ? 'text-success' : 'text-text-muted'}`}
            >
              {cumprida ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
              {regra.texto}
            </li>
          );
        })}
      </ul>

      <Input
        label="Repita a nova senha"
        type="password"
        icon={Lock}
        value={confirmacao}
        onChange={(e) => setConfirmacao(e.target.value)}
        autoComplete="new-password"
        required
      />

      {confirmacao.length > 0 && !igual && (
        <p className="text-xs font-medium text-danger">As duas senhas não são iguais.</p>
      )}
      {nova.length > 0 && atual.length > 0 && !diferenteDaAtual && (
        <p className="text-xs font-medium text-danger">A nova senha precisa ser diferente da atual.</p>
      )}
      {erro && (
        <div className="rounded-lg border border-danger-soft bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
          {erro}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={!pronto}>
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {enviando ? 'Salvando...' : 'Salvar nova senha'}
      </Button>
    </form>
  );
}

/**
 * Link "Alterar minha senha": abre uma janela com o formulário.
 * Pode ser colocado em qualquer tela (guarda o próprio estado).
 * Coloque FORA de um <form>.
 *
 * @param {Object} props
 * @param {string} [props.className] Classes extras para o botão.
 * @returns {JSX.Element} Botão-link com janela.
 */
export default function AlterarSenha({ className = '' }) {
  const [aberto, setAberto] = useState(false);
  const [concluida, setConcluida] = useState(false);

  function fechar() {
    setAberto(false);
    setConcluida(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={`font-semibold text-primary underline-offset-2 hover:underline ${className}`}
      >
        Alterar minha senha
      </button>

      <Modal open={aberto} onClose={fechar} title="Alterar minha senha">
        {concluida ? (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm font-medium text-success">
              <Check className="h-4 w-4" /> Senha alterada com sucesso!
            </p>
            <p className="text-sm text-text-muted">Use a nova senha na próxima vez que entrar.</p>
            <Button className="w-full" onClick={fechar}>
              Fechar
            </Button>
          </div>
        ) : (
          <FormTrocarSenha onSucesso={() => setConcluida(true)} />
        )}
      </Modal>
    </>
  );
}
