-- ============================================================================
-- SGAG-PDS: MIGRAÇÃO — Avaliação por bimestre + trava pós-professor
-- Execute este script no SQL Editor do Supabase.
-- Esse script ALTERA a tabela avaliacoes existente (não recria do zero),
-- então os dados que já existem são preservados.
-- ============================================================================

-- 1. Adiciona a coluna bimestre (1 a 4), com valor padrão 1 para linhas antigas
ALTER TABLE public.avaliacoes
    ADD COLUMN IF NOT EXISTS bimestre INTEGER NOT NULL DEFAULT 1
        CHECK (bimestre >= 1 AND bimestre <= 4);

-- 2. Remove a trava antiga (1 avaliação por integrante no total)
ALTER TABLE public.avaliacoes
    DROP CONSTRAINT IF EXISTS unique_avaliacao_por_integrante;

-- 3. Cria a nova trava (1 avaliação por integrante POR BIMESTRE)
ALTER TABLE public.avaliacoes
    ADD CONSTRAINT unique_avaliacao_por_integrante_bimestre
        UNIQUE (grupo_id, integrante_id, bimestre);

-- 4. Garante que a coluna que trava edição do líder existe
ALTER TABLE public.avaliacoes
    ADD COLUMN IF NOT EXISTS alterado_por_professor BOOLEAN NOT NULL DEFAULT false;

-- Resultado:
--   - Cada avaliação pertence a um bimestre específico (1 a 4).
--   - O líder/vice registra uma nota por integrante, por bimestre.
--   - Quando o professor altera uma nota, alterado_por_professor = true e
--     o líder/vice fica bloqueado de editar aquela avaliação.