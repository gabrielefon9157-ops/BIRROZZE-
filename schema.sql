-- ============================================================
-- SCHEMA SQL PER BIROZZZE (DATABASE SUPABASE)
-- ============================================================
-- Questo file contiene il codice SQL necessario per creare la 
-- tabella, abilitare il Realtime e configurare le politiche di
-- sicurezza per il caricamento delle foto ricordo.
-- 
-- ISTRUZIONI:
-- 1. Vai sulla dashboard del tuo progetto Supabase.
-- 2. Clicca su "SQL Editor" nel menu a sinistra.
-- 3. Clicca su "New query", incolla questo codice e premi "Run".
-- 4. Nel menu "Storage" a sinistra, crea un Bucket pubblico chiamato "birozze_photos".
-- ============================================================

-- A. Tabella per il salvataggio dello stato unificato della sessione
CREATE TABLE IF NOT EXISTS public.birozze_sessions (
    id TEXT PRIMARY KEY,
    state JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Abilita l'accesso in lettura e scrittura pubblico (senza autenticazione)
-- per facilitare l'uso da parte del gruppo durante la vacanza
ALTER TABLE public.birozze_sessions DISABLE ROW LEVEL SECURITY;

-- Abilita il Realtime per questa tabella, così tutti gli utenti vedono 
-- le modifiche (bevute, perle, oscar) all'istante senza ricaricare la pagina
ALTER PUBLICATION supabase_realtime ADD TABLE public.birozze_sessions;

-- B. Criteri di accesso (Policies) per il Bucket Storage "birozze_photos"
-- Supabase richiede queste regole per consentire il caricamento anonimo delle foto ricordo.
-- Nota: Il bucket "birozze_photos" deve essere già stato creato nel pannello di controllo.

CREATE POLICY "Accesso pubblico in lettura alle foto"
ON storage.objects FOR SELECT
USING (bucket_id = 'birozze_photos');

CREATE POLICY "Caricamento pubblico anonimo di foto"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'birozze_photos');

CREATE POLICY "Cancellazione pubblica anonima di foto"
ON storage.objects FOR DELETE
USING (bucket_id = 'birozze_photos');
