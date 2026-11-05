import { useMemo, useState } from 'react';
import { Check, Copy, KeyRound, Loader2, Mail, Search } from 'lucide-react';
import Button from './ui/Button.jsx';
import Input from './ui/Input.jsx';
import Modal from './ui/Modal.jsx';
import { api } from '../services/api.js';
import { useAuth } from '../auth/AuthContext.jsx';

const ROTULOS = { lider: 'Líder', vice_lider: 'Vice-Líder', avaliador: 'Avaliador' };

/**
 * Botão "Contas e senhas" (só para o professor): lista as contas de líder, vice-líder e
 * avaliador e permite:
 * - gerar uma SENHA TEMPORÁRIA para quem esqueceu a senha;
 * - TROCAR O E-MAIL de acesso da conta.
 *
 * A senha temporária aparece uma única vez, para o professor copiar e passar para a pessoa.
 * No primeiro acesso, a pessoa é obrigada a criar uma senha própria.
 *
 * @param {Object} props
 * @param {string} [props.className] Classes extras para o botão.
 * @returns {JSX.Element} Botão com janela.
 */
export default function ContasSenhas({ className = '' }) {
  const { session } = useAuth();
  const token = session?.token;

  const [aberto, setAberto] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [busca, setBusca] = useState('');
  const [alvo, setAlvo] = useState(null);
  const [resultado, setResultado] = useState(null); // { perfil, senha_temporaria }
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState('');

  // Troca de e-mail
  const [alvoEmail, setAlvoEmail] = useState(null);
  const [novoEmail, setNovoEmail] = useState('');
  const [salvandoEmail, setSalvandoEmail] = useState(false);

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      const { usuarios: lista } = await api('/auth/usuarios', { token });
      setUsuarios(lista);
    } catch (e) {
      setErro(e.message || 'Nao foi possivel carregar as contas.');
    } finally {
      setCarregando(false);
    }
  }

  function abrir() {
    setAberto(true);
    setAlvo(null);
    setAlvoEmail(null);
    setResultado(null);
    setBusca('');
    setCopiado('');
    setErro('');
    setSucesso('');
    carregar();
  }

  function fechar() {
    setAberto(false);
    setAlvo(null);
    setAlvoEmail(null);
    setResultado(null); // a senha some da memória ao fechar
    setCopiado('');
    setSucesso('');
  }

  async function gerar() {
    setGerando(true);
    setErro('');
    try {
      const dados = await api(`/auth/usuarios/${alvo.id}/redefinir-senha`, { method: 'POST', token });
      setResultado(dados);
      setAlvo(null);
      carregar();
    } catch (e) {
      setErro(e.message || 'Nao foi possivel redefinir a senha.');
    } finally {
      setGerando(false);
    }
  }

  function abrirTrocaEmail(usuario) {
    setErro('');
    setSucesso('');
    setNovoEmail(usuario.email);
    setAlvoEmail(usuario);
  }

  async function salvarEmail(evento) {
    evento.preventDefault();
    setSalvandoEmail(true);
    setErro('');
    try {
      const { perfil } = await api(`/profiles/${alvoEmail.id}/email`, {
        method: 'PUT',
        token,
        body: { email: novoEmail.trim() },
      });
      setUsuarios((lista) => lista.map((u) => (u.id === perfil.id ? { ...u, email: perfil.email } : u)));
      setSucesso(`E-mail de ${perfil.nome} alterado para ${perfil.email}.`);
      setAlvoEmail(null);
    } catch (e) {
      setErro(e.message || 'Nao foi possivel alterar o e-mail.');
    } finally {
      setSalvandoEmail(false);
    }
  }

  async function copiar(chave, texto) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(chave);
      setTimeout(() => setCopiado(''), 2500);
    } catch {
      setErro('Nao foi possivel copiar automaticamente. Selecione o texto e copie manualmente.');
    }
  }

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return usuarios;
    return usuarios.filter((u) => `${u.nome} ${u.email}`.toLowerCase().includes(termo));
  }, [usuarios, busca]);

  const emailIgual = alvoEmail ? novoEmail.trim().toLowerCase() === alvoEmail.email.toLowerCase() : false;

  const mensagem = resultado
    ? `Olá, ${resultado.perfil.nome}! Sua senha temporária do SGAG-PDS é: ${resultado.senha_temporaria}\n` +
      `Entre em ${window.location.origin}/login com o e-mail ${resultado.perfil.email} e essa senha. ` +
      'O sistema vai pedir para você criar uma nova senha só sua.'
    : '';

  return (
    <>
      <Button variant="outline" className={className} onClick={abrir}>
        <KeyRound className="h-4 w-4" /> Contas e senhas
      </Button>

      <Modal open={aberto} onClose={fechar} title="Contas e senhas">
        {resultado ? (
          <div className="space-y-4">
            <p className="text-sm text-text-muted">
              Senha temporária de <strong className="text-text">{resultado.perfil.nome}</strong> (
              {ROTULOS[resultado.perfil.role] ?? resultado.perfil.role}):
            </p>

            <div className="flex items-center gap-2">
              <code className="flex-1 select-all break-all rounded-xl border border-border bg-canvas px-4 py-3 text-center font-mono text-xl font-bold tracking-wider text-primary">
                {resultado.senha_temporaria}
              </code>
              <Button variant="outline" onClick={() => copiar('senha', resultado.senha_temporaria)}>
                {copiado === 'senha' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiado === 'senha' ? 'Copiada' : 'Copiar'}
              </Button>
            </div>

            <div className="rounded-lg border border-warning-soft bg-warning-soft px-3 py-2 text-sm font-medium text-warning">
              Esta senha aparece só agora e não fica guardada. Se fechar esta janela sem copiar, será
              preciso gerar outra. A conta já foi desbloqueada, se estava bloqueada.
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold text-text">Mensagem pronta para enviar</p>
              <p className="whitespace-pre-wrap rounded-lg bg-canvas px-3 py-2 text-sm text-text">{mensagem}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => copiar('mensagem', mensagem)}>
                {copiado === 'mensagem' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiado === 'mensagem' ? 'Mensagem copiada' : 'Copiar mensagem'}
              </Button>
              <p className="mt-2 text-xs text-text-muted">
                Envie em conversa privada com a pessoa, e não em grupo.
              </p>
            </div>

            {erro && <p className="text-sm font-medium text-danger">{erro}</p>}
            <Button className="w-full" onClick={fechar}>
              Pronto
            </Button>
          </div>
        ) : alvo ? (
          <div className="space-y-4">
            <p className="text-text-muted">
              Gerar uma nova senha temporária para <strong className="text-text">{alvo.nome}</strong> (
              {alvo.email})? A senha atual dessa conta <strong className="text-text">deixa de funcionar</strong>{' '}
              agora.
            </p>
            {erro && <p className="text-sm font-medium text-danger">{erro}</p>}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setAlvo(null)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={gerar} disabled={gerando}>
                {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                {gerando ? 'Gerando...' : 'Gerar senha'}
              </Button>
            </div>
          </div>
        ) : alvoEmail ? (
          <form onSubmit={salvarEmail} className="space-y-4">
            <p className="text-sm text-text-muted">
              Trocar o e-mail de acesso de <strong className="text-text">{alvoEmail.nome}</strong> (
              {ROTULOS[alvoEmail.role] ?? alvoEmail.role}). E-mail atual:{' '}
              <strong className="text-text">{alvoEmail.email}</strong>
            </p>

            <Input
              label="Novo e-mail"
              type="email"
              icon={Mail}
              placeholder="novoemail@gmail.com"
              value={novoEmail}
              onChange={(e) => setNovoEmail(e.target.value)}
              required
              autoFocus
            />

            <div className="rounded-lg border border-warning-soft bg-warning-soft px-3 py-2 text-sm font-medium text-warning">
              O novo e-mail passa a ser o login da pessoa e o antigo deixa de funcionar. A senha continua a
              mesma. O sistema não envia aviso: avise a pessoa em conversa privada.
            </div>

            {erro && <p className="text-sm font-medium text-danger">{erro}</p>}

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setAlvoEmail(null)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={salvandoEmail || !novoEmail.trim() || emailIgual}
              >
                {salvandoEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {salvandoEmail ? 'Salvando...' : 'Salvar e-mail'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-text-muted">
              Para quem esqueceu a senha: gere uma senha temporária e passe para a pessoa. No primeiro
              acesso, ela cria uma senha própria. Aqui também dá para trocar o e-mail de acesso.
            </p>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome ou e-mail"
                className="h-11 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
              />
            </div>

            {sucesso && <p className="text-sm font-medium text-success">{sucesso}</p>}
            {erro && <p className="text-sm font-medium text-danger">{erro}</p>}

            <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {carregando && usuarios.length === 0 ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : filtrados.length === 0 ? (
                <p className="py-4 text-center text-sm text-text-muted">Nenhuma conta encontrada.</p>
              ) : (
                filtrados.map((usuario) => (
                  <div
                    key={usuario.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text">{usuario.nome}</p>
                      <p className="truncate text-xs text-text-muted">
                        {ROTULOS[usuario.role] ?? usuario.role} · {usuario.email}
                      </p>
                      {usuario.senha_temporaria && (
                        <p className="text-xs font-semibold text-warning">
                          Ainda não criou a senha própria
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => abrirTrocaEmail(usuario)}>
                        <Mail className="h-4 w-4" /> Trocar e-mail
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setErro('');
                          setSucesso('');
                          setAlvo(usuario);
                        }}
                      >
                        <KeyRound className="h-4 w-4" /> Redefinir
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}