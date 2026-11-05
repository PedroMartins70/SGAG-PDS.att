-- ============================================================================
-- SGAG-PDS: MIGRAÇÃO — Liberação da avaliação para o Vice-Líder
-- Execute este script no SQL Editor do Supabase ANTES de publicar o novo código.
-- Não recria nem apaga nada: só CRIA a tabela nova (liberacoes_vice), então
-- notas, avaliações e contas que já existem são preservados.
--
-- Regra: só o Líder avalia. O Vice só pode dar notas em um grupo/bimestre
-- se existir uma linha aqui (o Professor libera pelo botão na tela do grupo).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.liberacoes_vice (
    grupo_id UUID NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
    bimestre INTEGER NOT NULL CHECK (bimestre >= 1 AND bimestre <= 4),
    liberado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (grupo_id, bimestre)
);

-- Segurança (escritas só pelo back-end/service role; leitura autenticada)
ALTER TABLE public.liberacoes_vice ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_liberacoes_vice" ON public.liberacoes_vice;
CREATE POLICY "select_liberacoes_vice" ON public.liberacoes_vice
    FOR SELECT TO authenticated USING (true);

-- Observação: nenhuma liberação é criada automaticamente. A partir de agora o
-- Vice fica em modo somente leitura até o Professor liberar cada bimestre.