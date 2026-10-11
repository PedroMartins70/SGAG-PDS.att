import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Download, ExternalLink, FileText, Image as ImageIcon, Loader2, Save, Upload, Video, X } from 'lucide-react';
import Button from './ui/Button.jsx';
import Card from './ui/Card.jsx';
import { api } from '../services/api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { getSupabase } from '../lib/supabaseClient.js';

const MB = 1024 * 1024;

/** Tipos de arquivo do projeto, na ordem em que aparecem na tela. */
const TIPOS = [
  {
    key: 'trabalho',
    rotulo: 'Trabalho escrito',
    dica: 'Arquivo PDF de até 10 MB.',
    icone: FileText,
    accept: 'application/pdf,.pdf',
    extensoes: ['pdf'],
    limite: 10 * MB,
  },
  {
    key: 'pitch',
    rotulo: 'Pitch',
    dica: 'Vídeo (MP4, MOV, AVI, WEBM, MKV, 3GP, M4V ou WMV) de até 30 MB.',
    icone: Video,
    accept: 'video/*,.mp4,.mov,.m4v,.avi,.mkv,.webm,.3gp,.wmv',
    extensoes: ['mp4', 'mov', 'm4v', 'avi', 'mkv', 'webm', '3gp', 'wmv'],
    limite: 30 * MB,
  },
  {
    key: 'logo',
    rotulo: 'Logo',
    dica: 'Imagem PNG, JPG ou WEBP de até 5 MB.',
    icone: ImageIcon,
    accept: 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp',
    extensoes: ['png', 'jpg', 'jpeg', 'webp'],
    limite: 5 * MB,
  },
];

/** Ordem de envio ao salvar (do menor para o maior arquivo). */
const ORDEM_DE_ENVIO = ['logo', 'trabalho', 'pitch'];

const estiloBotaoLink =
  'inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-text transition-colors hover:bg-surface-muted';

/**
 * Formata um tamanho em bytes para KB/MB.
 *
 * @param {number|null} bytes Tamanho em bytes.
 * @returns {string} Texto formatado.
 */
function formatarTamanho(bytes) {
  if (!bytes) return '';
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / MB).toFixed(1).replace('.', ',')} MB`;
}

/**
 * Confere (de forma rápida, no navegador) se o texto é um link https do
 * YouTube ou do Google Drive. O servidor confere de novo, de forma definitiva.
 *
 * @param {string} texto Link digitado.
 * @returns {boolean} true se parece válido.
 */
function linkPareceValido(texto) {
  try {
    const url = new URL(texto.trim());
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return /(^|\.)youtube\.com$/.test(host) || /(^|\.)youtu\.be$/.test(host) || host === 'drive.google.com';
  } catch {
    return false;
  }
}

/**
 * Seção "Arquivos do projeto" de um grupo (trabalho escrito, pitch e logo).
 * O pitch pode ser um arquivo de vídeo ou um link do YouTube/Google Drive.
 * O servidor diz se o usuário pode enviar (líder/vice do grupo). Para os
 * demais (professor), a tela só mostra o que foi enviado, sem controles.
 *
 * @param {Object} props Propriedades.
 * @param {string} props.grupoId UUID do grupo.
 * @returns {JSX.Element} Seção de arquivos do projeto.
 */
export default function ProjetoArquivos({ grupoId }) {
  const { session } = useAuth();
  const token = session?.token;

  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [pendentes, setPendentes] = useState({});
  const [modoPitch, setModoPitch] = useState('arquivo');
  const [linkPitch, setLinkPitch] = useState('');
  const [errosTipo, setErrosTipo] = useState({});
  const [enviando, setEnviando] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const carregar = useCallback(async () => {
    setErro('');
    try {
      const resposta = await api(`/grupos/${grupoId}/arquivos`, { token });
      setDados(resposta);
    } catch (e) {
      setErro(e.message || 'Falha ao carregar os arquivos.');
    } finally {
      setCarregando(false);
    }
  }, [grupoId, token]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const previaLogo = useMemo(
    () => (pendentes.logo ? URL.createObjectURL(pendentes.logo) : null),
    [pendentes.logo]
  );

  useEffect(
    () => () => {
      if (previaLogo) URL.revokeObjectURL(previaLogo);
    },
    [previaLogo]
  );

  /** Valida e guarda o arquivo escolhido (ainda sem enviar). */
  function escolher(cfg, evento) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = '';
    if (!arquivo) return;

    setResultado(null);
    const extensao = arquivo.name.includes('.') ? arquivo.name.split('.').pop().toLowerCase() : '';

    if (!cfg.extensoes.includes(extensao)) {
      setErrosTipo((atual) => ({
        ...atual,
        [cfg.key]: `Formato não aceito. Use: ${cfg.extensoes.join(', ').toUpperCase()}.`,
      }));
      return;
    }

    if (arquivo.size > cfg.limite) {
      setErrosTipo((atual) => ({
        ...atual,
        [cfg.key]: `O arquivo tem ${formatarTamanho(arquivo.size)} e o limite é ${cfg.limite / MB} MB. Se o vídeo for maior, use a opção "Colar link".`,
      }));
      return;
    }

    setErrosTipo((atual) => ({ ...atual, [cfg.key]: '' }));
    setPendentes((atual) => ({ ...atual, [cfg.key]: arquivo }));
  }

  /** Descarta um arquivo escolhido que ainda não foi salvo. */
  function descartar(tipo) {
    setPendentes((atual) => {
      const novo = { ...atual };
      delete novo[tipo];
      return novo;
    });
  }

  /** Alterna o pitch entre "enviar arquivo" e "colar link" (descarta o que estava pendente do outro modo). */
  function trocarModoPitch(modo) {
    if (modo === modoPitch) return;
    setModoPitch(modo);
    setResultado(null);
    setErrosTipo((atual) => ({ ...atual, pitch: '' }));
    if (modo === 'link') descartar('pitch');
    else setLinkPitch('');
  }

  /** Envia tudo que está pendente (arquivos e link do pitch) e registra no grupo. */
  async function salvar() {
    setSalvando(true);
    setResultado(null);
    const falhas = [];

    for (const tipo of ORDEM_DE_ENVIO) {
      const arquivo = pendentes[tipo];
      if (!arquivo) continue;
      const cfg = TIPOS.find((t) => t.key === tipo);

      try {
        setEnviando((atual) => ({ ...atual, [tipo]: true }));

        const preparo = await api(`/grupos/${grupoId}/arquivos/${tipo}/upload-url`, {
          method: 'POST',
          token,
          body: { nome: arquivo.name, tamanho: arquivo.size },
        });

        const conteudo = arquivo.slice(0, arquivo.size, preparo.mime);
        const { error } = await getSupabase()
          .storage.from(preparo.bucket)
          .uploadToSignedUrl(preparo.caminho, preparo.token, conteudo, { contentType: preparo.mime });

        if (error) throw new Error(error.message || 'Falha no envio do arquivo.');

        await api(`/grupos/${grupoId}/arquivos/${tipo}/confirmar`, {
          method: 'POST',
          token,
          body: { caminho: preparo.caminho, nome: arquivo.name },
        });

        descartar(tipo);
      } catch (e) {
        falhas.push(`${cfg.rotulo}: ${e.message || 'falha ao enviar.'}`);
      } finally {
        setEnviando((atual) => ({ ...atual, [tipo]: false }));
      }
    }

    if (modoPitch === 'link' && linkPitch.trim()) {
      if (!linkPareceValido(linkPitch)) {
        falhas.push('Pitch (link): use um link https de um vídeo do YouTube ou de um arquivo do Google Drive.');
      } else {
        try {
          setEnviando((atual) => ({ ...atual, pitch: true }));
          await api(`/grupos/${grupoId}/arquivos/pitch/link`, {
            method: 'PUT',
            token,
            body: { url: linkPitch.trim() },
          });
          setLinkPitch('');
          setModoPitch('arquivo');
        } catch (e) {
          falhas.push(`Pitch (link): ${e.message || 'falha ao salvar.'}`);
        } finally {
          setEnviando((atual) => ({ ...atual, pitch: false }));
        }
      }
    }

    await carregar();
    setSalvando(false);
    setResultado(
      falhas.length === 0
        ? { ok: true, texto: 'Alterações salvas!' }
        : { ok: false, texto: falhas.join(' | ') }
    );
  }

  if (carregando) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (erro || !dados) {
    return <Card className="p-6 text-center text-danger">{erro || 'Não foi possível carregar os arquivos.'}</Card>;
  }

  const podeEnviar = dados.pode_enviar;
  const haPendentes = Object.keys(pendentes).length > 0 || (modoPitch === 'link' && linkPitch.trim().length > 0);

  return (
    <div className="space-y-4">
      {TIPOS.map((cfg) => {
        const Icone = cfg.icone;
        const atual = dados.arquivos?.[cfg.key] ?? null;
        const pendente = pendentes[cfg.key];
        const modoLink = cfg.key === 'pitch' && modoPitch === 'link';

        return (
          <Card key={cfg.key} className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Icone className="h-5 w-5 text-primary" />
              <h3 className="font-display text-lg font-bold text-text">{cfg.rotulo}</h3>
            </div>

            <ArquivoAtual tipo={cfg.key} atual={atual} />

            {podeEnviar && (
              <div className="mt-4 border-t border-border pt-4">
                {cfg.key === 'pitch' && (
                  <div className="mb-3 inline-flex rounded-xl border border-border bg-surface p-1">
                    {[
                      { modo: 'arquivo', rotulo: 'Enviar arquivo' },
                      { modo: 'link', rotulo: 'Colar link' },
                    ].map((opcao) => (
                      <button
                        key={opcao.modo}
                        type="button"
                        disabled={salvando}
                        onClick={() => trocarModoPitch(opcao.modo)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                          modoPitch === opcao.modo
                            ? 'bg-primary text-white'
                            : 'text-text-muted hover:text-text'
                        }`}
                      >
                        {opcao.rotulo}
                      </button>
                    ))}
                  </div>
                )}

                {modoLink ? (
                  <div>
                    <p className="mb-2 text-xs text-text-muted">
                      Cole o link de um vídeo do YouTube (de preferência como "não listado") ou de um arquivo do Google
                      Drive com o compartilhamento em "Qualquer pessoa com o link". Serve para vídeos grandes.
                    </p>
                    <input
                      type="url"
                      inputMode="url"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={linkPitch}
                      disabled={salvando}
                      onChange={(e) => {
                        setLinkPitch(e.target.value);
                        setResultado(null);
                      }}
                      className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-base text-text placeholder:text-text-muted transition-all focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
                    />
                    {enviando.pitch && (
                      <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary">
                        <Loader2 className="h-4 w-4 animate-spin" /> Salvando link...
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <p className="mb-2 text-xs text-text-muted">{cfg.dica}</p>

                    {pendente && (
                      <div className="mb-3 flex items-center gap-3 rounded-lg border border-dashed border-primary bg-primary-soft px-3 py-2">
                        {cfg.key === 'logo' && previaLogo && (
                          <img src={previaLogo} alt="Prévia da logo" className="h-12 w-12 rounded-md object-cover" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-text">{pendente.name}</p>
                          <p className="text-xs text-text-muted">
                            {formatarTamanho(pendente.size)} · será enviado ao clicar em "Salvar alterações"
                          </p>
                        </div>
                        {enviando[cfg.key] ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                            <Loader2 className="h-4 w-4 animate-spin" /> Enviando...
                          </span>
                        ) : (
                          <button
                            type="button"
                            aria-label="Descartar arquivo escolhido"
                            disabled={salvando}
                            onClick={() => descartar(cfg.key)}
                            className="text-text-muted transition-colors hover:text-danger"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}

                    <label className={`${estiloBotaoLink} cursor-pointer ${salvando ? 'pointer-events-none opacity-60' : ''}`}>
                      <Upload className="h-4 w-4" />
                      {atual || pendente ? 'Trocar arquivo' : 'Escolher arquivo'}
                      <input
                        type="file"
                        accept={cfg.accept}
                        className="hidden"
                        disabled={salvando}
                        onChange={(e) => escolher(cfg, e)}
                      />
                    </label>
                  </>
                )}

                {errosTipo[cfg.key] && <p className="mt-2 text-sm font-medium text-danger">{errosTipo[cfg.key]}</p>}
              </div>
            )}
          </Card>
        );
      })}

      {podeEnviar && (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="success" onClick={salvar} disabled={!haPendentes || salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {salvando ? 'Enviando...' : 'Salvar alterações'}
          </Button>
          {salvando && (
            <p className="text-sm text-text-muted">Não feche esta página até terminar. Vídeos podem demorar um pouco.</p>
          )}
          {resultado && (
            <p className={`flex items-center gap-1 text-sm font-medium ${resultado.ok ? 'text-success' : 'text-danger'}`}>
              {resultado.ok && <Check className="h-4 w-4" />} {resultado.texto}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Mostra o arquivo (ou link) atual de um tipo, ou o aviso de que ainda não há nada.
 *
 * @param {Object} props Propriedades.
 * @param {string} props.tipo trabalho, pitch ou logo.
 * @param {Object|null} props.atual Item salvo, se houver.
 * @returns {JSX.Element} Visualização do item.
 */
function ArquivoAtual({ tipo, atual }) {
  if (!atual) {
    return <p className="text-sm text-text-muted">Nada enviado ainda.</p>;
  }

  if (atual.origem === 'link') {
    return (
      <div className="space-y-3">
        {atual.embed_url && (
          <iframe
            src={atual.embed_url}
            title="Pitch do projeto"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="aspect-video w-full rounded-xl border border-border bg-black"
          />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-text">Link do pitch</p>
          <a href={atual.link_url} target="_blank" rel="noreferrer" className={estiloBotaoLink}>
            <ExternalLink className="h-4 w-4" /> Abrir link
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tipo === 'logo' && atual.url && (
        <img
          src={atual.url}
          alt="Logo do projeto"
          className="h-32 w-32 rounded-xl border border-border bg-surface object-cover"
        />
      )}

      {tipo === 'pitch' && atual.url && (
        <>
          <video controls preload="metadata" src={atual.url} className="max-h-72 w-full rounded-xl bg-black" />
          <p className="text-xs text-text-muted">
            Se o vídeo não tocar aqui (formatos como AVI não tocam no navegador), use o botão Baixar.
          </p>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-text">
          {atual.nome}
          {atual.tamanho ? <span className="text-text-muted"> · {formatarTamanho(atual.tamanho)}</span> : null}
        </p>
        {tipo === 'trabalho' && atual.url && (
          <a href={atual.url} target="_blank" rel="noreferrer" className={estiloBotaoLink}>
            <ExternalLink className="h-4 w-4" /> Abrir
          </a>
        )}
        {tipo !== 'logo' && atual.download_url && (
          <a href={atual.download_url} rel="noreferrer" className={estiloBotaoLink}>
            <Download className="h-4 w-4" /> Baixar
          </a>
        )}
      </div>
    </div>
  );
}
