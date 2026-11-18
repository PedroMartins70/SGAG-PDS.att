-- ============================================================================
-- SGAG-PDS: MIGRAÇÃO — Nota por tópico na avaliação da banca
-- Execute no SQL Editor do Supabase ANTES de publicar o novo código.
--
-- O que faz:
--   1. Cria a coluna "itens" (JSONB) com a nota de cada tópico.
--   2. Confere se as 4 colunas de bloco aceitam duas casas decimais.
--   3. Troca a regra antiga (só 0, 0.2, 0.4, 0.6, 0.8, 1) por uma regra que
--      aceita qualquer múltiplo de 0.05 entre 0 e 1.
--
-- O que NÃO faz: não altera nenhuma nota já lançada. As avaliações antigas
-- continuam com "itens" vazio e a nota de cada bloco como está.
-- A nota de cada bloco passa a ser a SOMA dos tópicos (calculada pelo servidor)
-- e o nota_total continua sendo calculado pelo banco, como antes.
-- ============================================================================

-- 1. Coluna nova (vazia nas avaliações antigas)
ALTER TABLE public.avaliacoes_banca ADD COLUMN IF NOT EXISTS itens JSONB;

-- 2. As colunas de bloco precisam aceitar duas casas decimais (ex.: 0.85).
--    Se não aceitarem, o script PARA aqui, sem ter alterado nada de importante.
DO $$
DECLARE
  coluna RECORD;
BEGIN
  FOR coluna IN
    SELECT column_name, data_type, numeric_precision, numeric_scale
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'avaliacoes_banca'
      AND column_name IN ('nota_topicos', 'nota_abnt_coerencia', 'nota_apresentacao_oral', 'nota_pitch')
  LOOP
    IF coluna.data_type IN ('integer', 'smallint', 'bigint') THEN
      RAISE EXCEPTION 'A coluna % e do tipo %, que nao guarda decimais. Mande o CREATE TABLE da avaliacoes_banca para ajustar.',
        coluna.column_name, coluna.data_type;
    END IF;

    IF coluna.data_type = 'numeric' AND coluna.numeric_precision IS NOT NULL AND coluna.numeric_scale < 2 THEN
      RAISE EXCEPTION 'A coluna % tem apenas % casa(s) decimal(is) (numeric(%,%)). Mande o CREATE TABLE da avaliacoes_banca para ajustar.',
        coluna.column_name, coluna.numeric_scale, coluna.numeric_precision, coluna.numeric_scale;
    END IF;
  END LOOP;
END $$;

-- 3. Remove as regras (CHECK) antigas que limitavam as notas dos blocos à escala de 0.2 em 0.2
DO $$
DECLARE
  regra RECORD;
BEGIN
  FOR regra IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'avaliacoes_banca'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ~ '(nota_topicos|nota_abnt_coerencia|nota_apresentacao_oral|nota_pitch)'
  LOOP
    EXECUTE format('ALTER TABLE public.avaliacoes_banca DROP CONSTRAINT %I', regra.conname);
  END LOOP;
END $$;

-- 4. Regra nova: cada bloco vai de 0 a 1, de 0.05 em 0.05
ALTER TABLE public.avaliacoes_banca DROP CONSTRAINT IF EXISTS avaliacoes_banca_notas_validas;
ALTER TABLE public.avaliacoes_banca
  ADD CONSTRAINT avaliacoes_banca_notas_validas CHECK (
    nota_topicos BETWEEN 0 AND 1 AND MOD(ROUND(nota_topicos * 100)::int, 5) = 0
    AND nota_abnt_coerencia BETWEEN 0 AND 1 AND MOD(ROUND(nota_abnt_coerencia * 100)::int, 5) = 0
    AND nota_apresentacao_oral BETWEEN 0 AND 1 AND MOD(ROUND(nota_apresentacao_oral * 100)::int, 5) = 0
    AND nota_pitch BETWEEN 0 AND 1 AND MOD(ROUND(nota_pitch * 100)::int, 5) = 0
  );

-- 5. A coluna "itens", quando preenchida, precisa ser um objeto JSON
ALTER TABLE public.avaliacoes_banca DROP CONSTRAINT IF EXISTS avaliacoes_banca_itens_objeto;
ALTER TABLE public.avaliacoes_banca
  ADD CONSTRAINT avaliacoes_banca_itens_objeto CHECK (itens IS NULL OR jsonb_typeof(itens) = 'object');

-- Conferência (opcional): quantas avaliações já estão no modelo novo
-- SELECT COUNT(*) FILTER (WHERE itens IS NOT NULL) AS por_topico,
--        COUNT(*) FILTER (WHERE itens IS NULL)     AS modelo_antigo
-- FROM public.avaliacoes_banca;