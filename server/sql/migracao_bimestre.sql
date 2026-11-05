-- ============================================================================
-- SGAG-PDS: MIGRAÇÃO — Vínculo entre Avaliador e Turmas
-- Execute este script no SQL Editor do Supabase ANTES de publicar o novo código.
-- Não recria nem apaga nada: só CRIA a tabela nova (avaliador_turmas), então
-- avaliações, notas, arquivos e contas que já existem são preservados.
-- ============================================================================

-- 1. Tabela de vínculo (um avaliador pode ter várias turmas)
CREATE TABLE IF NOT EXISTS public.avaliador_turmas (
    avaliador_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    turma_id UUID NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (avaliador_id, turma_id)
);

CREATE INDEX IF NOT EXISTS idx_avaliador_turmas_turma ON public.avaliador_turmas (turma_id);

-- 2. Segurança (escritas só pelo back-end/service role; leitura autenticada)
ALTER TABLE public.avaliador_turmas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_avaliador_turmas" ON public.avaliador_turmas;
CREATE POLICY "select_avaliador_turmas" ON public.avaliador_turmas
    FOR SELECT TO authenticated USING (true);

-- 3. Avaliadores que JÁ existem continuam vendo tudo como hoje:
--    cada um é vinculado a TODAS as turmas. Depois o professor ajusta pelo
--    quadro "Avaliadores e turmas" no painel.
INSERT INTO public.avaliador_turmas (avaliador_id, turma_id)
SELECT p.id, t.id
FROM public.profiles p
CROSS JOIN public.turmas t
WHERE p.role = 'avaliador'
ON CONFLICT DO NOTHING;

-- Conferência (opcional): quantas turmas cada avaliador tem agora
-- SELECT p.nome, COUNT(*) AS turmas
-- FROM public.avaliador_turmas vt JOIN public.profiles p ON p.id = vt.avaliador_id
-- GROUP BY p.nome ORDER BY p.nome;