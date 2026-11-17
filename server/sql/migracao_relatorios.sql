-- ============================================================================
-- SGAG-PDS: MIGRAÇÃO — Relatórios (links do Google Docs enviados pelo professor)
-- Execute no SQL Editor do Supabase ANTES de publicar o novo código.
-- Só CRIA a tabela nova; nada existente é alterado ou apagado.
--
-- Regra: o Professor cadastra links (título, descrição e URL). Todos os
-- líderes e vices, de todas as turmas, veem e abrem os mesmos links.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.relatorios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL CHECK (char_length(titulo) BETWEEN 1 AND 150),
    descricao TEXT NOT NULL DEFAULT '' CHECK (char_length(descricao) <= 500),
    url TEXT NOT NULL CHECK (url ~* '^https://'),
    criado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Segurança (escritas só pelo back-end/service role; leitura autenticada)
ALTER TABLE public.relatorios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_relatorios" ON public.relatorios;
CREATE POLICY "select_relatorios" ON public.relatorios
    FOR SELECT TO authenticated USING (true);