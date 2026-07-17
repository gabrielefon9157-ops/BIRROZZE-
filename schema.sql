-- ============================================================
-- SCHEMA SQL RELAZIONALE PER BIRROZZE (DATABASE SUPABASE)
-- ============================================================
-- Questo schema definisce le tabelle per la sincronizzazione 
-- multi-utente in tempo reale, garantendo transazioni atomiche
-- e prevenendo la sovrascrittura accidentale dei dati.
--
-- ISTRUZIONI:
-- 1. Clicca su "SQL Editor" nella dashboard di Supabase.
-- 2. Clicca su "New query", incolla questo codice e premi "Run".
-- 3. Abilita il Bucket Storage pubblico "birozze_photos" da Supabase.
-- ============================================================

-- Abilita l'estensione pgcrypto per generare gli UUID in modo nativo
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Sessioni / Gruppi
CREATE TABLE IF NOT EXISTS public.sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    alcohol_split_mode TEXT DEFAULT 'uguale' NOT NULL,
    timer_elapsed INTEGER DEFAULT 0 NOT NULL,
    timer_running BOOLEAN DEFAULT false NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Partecipanti
CREATE TABLE IF NOT EXISTS public.crew (
    id TEXT PRIMARY KEY, -- es. 'gabbo' o UUID
    session_id TEXT REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Consumazioni
CREATE TABLE IF NOT EXISTS public.drinks_consumed (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_id TEXT REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
    crew_id TEXT REFERENCES public.crew(id) ON DELETE CASCADE NOT NULL,
    drink_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 1 NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_drink_per_crew UNIQUE (crew_id, drink_id)
);

-- 4. Spese
CREATE TABLE IF NOT EXISTS public.expenses (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_id TEXT REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    paid_by TEXT REFERENCES public.crew(id) ON DELETE CASCADE NOT NULL,
    split_among TEXT[] NOT NULL, -- Array di crew_id
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Foto Polaroid
CREATE TABLE IF NOT EXISTS public.photos (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_id TEXT REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
    url TEXT NOT NULL,
    caption TEXT,
    author TEXT NOT NULL,
    rotation NUMERIC(4,2) DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Muro delle Perle (Post-It)
CREATE TABLE IF NOT EXISTS public.perle (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_id TEXT REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
    text TEXT NOT NULL,
    author TEXT NOT NULL,
    color TEXT DEFAULT '#FFF9D0' NOT NULL,
    rotation NUMERIC(4,2) DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Categorie Oscar della Vacanza
CREATE TABLE IF NOT EXISTS public.oscars (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_id TEXT REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Voti Categorie Oscar (1 solo voto a testa per categoria!)
CREATE TABLE IF NOT EXISTS public.oscar_votes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_id TEXT REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
    oscar_id TEXT REFERENCES public.oscars(id) ON DELETE CASCADE NOT NULL,
    voter_id TEXT REFERENCES public.crew(id) ON DELETE CASCADE NOT NULL,
    candidate_id TEXT REFERENCES public.crew(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_vote_per_oscar UNIQUE (oscar_id, voter_id)
);

-- 9. Proposte Tappa (Prossima Tappa)
CREATE TABLE IF NOT EXISTS public.proposals (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_id TEXT REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
    label TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. Voti Proposte Tappa (1 solo voto a testa in tutto il gruppo!)
CREATE TABLE IF NOT EXISTS public.proposal_votes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_id TEXT REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
    proposal_id TEXT REFERENCES public.proposals(id) ON DELETE CASCADE NOT NULL,
    voter_id TEXT REFERENCES public.crew(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_vote_per_session UNIQUE (session_id, voter_id)
);

-- 11. Votazioni Goliardiche (Stasera si beve? 🍻)
CREATE TABLE IF NOT EXISTS public.drinking_votes (
    session_id TEXT REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
    voter_id TEXT REFERENCES public.crew(id) ON DELETE CASCADE NOT NULL,
    vote TEXT NOT NULL, -- 'si' o 'no'
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (session_id, voter_id)
);


-- 12. Registro Email (login con Google o Email)
CREATE TABLE IF NOT EXISTS public.emails (
    email TEXT PRIMARY KEY,
    name TEXT,
    provider TEXT DEFAULT 'email' NOT NULL, -- 'email' | 'google' | 'google-mock'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_login TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- ABILITAZIONE REALTIME (WebSocket per aggiornamenti live)
-- ============================================================
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drinks_consumed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oscars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oscar_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drinking_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;

-- Rimozione preventiva delle policy se già esistenti per evitare errori di duplicazione
DROP POLICY IF EXISTS "Accesso totale pubblico sessions" ON public.sessions;
DROP POLICY IF EXISTS "Accesso totale pubblico crew" ON public.crew;
DROP POLICY IF EXISTS "Accesso totale pubblico drinks_consumed" ON public.drinks_consumed;
DROP POLICY IF EXISTS "Accesso totale pubblico expenses" ON public.expenses;
DROP POLICY IF EXISTS "Accesso totale pubblico photos" ON public.photos;
DROP POLICY IF EXISTS "Accesso totale pubblico perle" ON public.perle;
DROP POLICY IF EXISTS "Accesso totale pubblico oscars" ON public.oscars;
DROP POLICY IF EXISTS "Accesso totale pubblico oscar_votes" ON public.oscar_votes;
DROP POLICY IF EXISTS "Accesso totale pubblico proposals" ON public.proposals;
DROP POLICY IF EXISTS "Accesso totale pubblico proposal_votes" ON public.proposal_votes;
DROP POLICY IF EXISTS "Accesso totale pubblico drinking_votes" ON public.drinking_votes;
DROP POLICY IF EXISTS "Accesso totale pubblico emails" ON public.emails;

-- Consenti accesso in lettura/scrittura anonimo pubblico per la vacanza studio
CREATE POLICY "Accesso totale pubblico sessions" ON public.sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Accesso totale pubblico crew" ON public.crew FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Accesso totale pubblico drinks_consumed" ON public.drinks_consumed FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Accesso totale pubblico expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Accesso totale pubblico photos" ON public.photos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Accesso totale pubblico perle" ON public.perle FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Accesso totale pubblico oscars" ON public.oscars FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Accesso totale pubblico oscar_votes" ON public.oscar_votes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Accesso totale pubblico proposals" ON public.proposals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Accesso totale pubblico proposal_votes" ON public.proposal_votes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Accesso totale pubblico drinking_votes" ON public.drinking_votes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Accesso totale pubblico emails" ON public.emails FOR ALL USING (true) WITH CHECK (true);

-- Registrazione sicura delle tabelle al canale Realtime di Supabase (evita errori se già presenti)
DO $$
DECLARE
    pub_exists BOOLEAN;
BEGIN
    SELECT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') INTO pub_exists;
    IF pub_exists THEN
        -- sessions
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_rel pr 
            JOIN pg_class c ON pr.prrelid = c.oid 
            JOIN pg_publication p ON pr.prpubid = p.oid 
            WHERE p.pubname = 'supabase_realtime' AND c.relname = 'sessions'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
        END IF;

        -- crew
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_rel pr 
            JOIN pg_class c ON pr.prrelid = c.oid 
            JOIN pg_publication p ON pr.prpubid = p.oid 
            WHERE p.pubname = 'supabase_realtime' AND c.relname = 'crew'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.crew;
        END IF;

        -- drinks_consumed
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_rel pr 
            JOIN pg_class c ON pr.prrelid = c.oid 
            JOIN pg_publication p ON pr.prpubid = p.oid 
            WHERE p.pubname = 'supabase_realtime' AND c.relname = 'drinks_consumed'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.drinks_consumed;
        END IF;

        -- expenses
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_rel pr 
            JOIN pg_class c ON pr.prrelid = c.oid 
            JOIN pg_publication p ON pr.prpubid = p.oid 
            WHERE p.pubname = 'supabase_realtime' AND c.relname = 'expenses'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
        END IF;

        -- photos
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_rel pr 
            JOIN pg_class c ON pr.prrelid = c.oid 
            JOIN pg_publication p ON pr.prpubid = p.oid 
            WHERE p.pubname = 'supabase_realtime' AND c.relname = 'photos'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.photos;
        END IF;

        -- perle
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_rel pr 
            JOIN pg_class c ON pr.prrelid = c.oid 
            JOIN pg_publication p ON pr.prpubid = p.oid 
            WHERE p.pubname = 'supabase_realtime' AND c.relname = 'perle'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.perle;
        END IF;

        -- oscars
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_rel pr 
            JOIN pg_class c ON pr.prrelid = c.oid 
            JOIN pg_publication p ON pr.prpubid = p.oid 
            WHERE p.pubname = 'supabase_realtime' AND c.relname = 'oscars'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.oscars;
        END IF;

        -- oscar_votes
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_rel pr 
            JOIN pg_class c ON pr.prrelid = c.oid 
            JOIN pg_publication p ON pr.prpubid = p.oid 
            WHERE p.pubname = 'supabase_realtime' AND c.relname = 'oscar_votes'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.oscar_votes;
        END IF;

        -- proposals
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_rel pr 
            JOIN pg_class c ON pr.prrelid = c.oid 
            JOIN pg_publication p ON pr.prpubid = p.oid 
            WHERE p.pubname = 'supabase_realtime' AND c.relname = 'proposals'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.proposals;
        END IF;

        -- proposal_votes
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_rel pr 
            JOIN pg_class c ON pr.prrelid = c.oid 
            JOIN pg_publication p ON pr.prpubid = p.oid 
            WHERE p.pubname = 'supabase_realtime' AND c.relname = 'proposal_votes'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.proposal_votes;
        END IF;

        -- drinking_votes
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_rel pr
            JOIN pg_class c ON pr.prrelid = c.oid
            JOIN pg_publication p ON pr.prpubid = p.oid
            WHERE p.pubname = 'supabase_realtime' AND c.relname = 'drinking_votes'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.drinking_votes;
        END IF;

        -- emails
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_rel pr
            JOIN pg_class c ON pr.prrelid = c.oid
            JOIN pg_publication p ON pr.prpubid = p.oid
            WHERE p.pubname = 'supabase_realtime' AND c.relname = 'emails'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.emails;
        END IF;
    END IF;
END $$;

-- ============================================================
-- ABILITAZIONE BUCKET STORAGE (per upload foto in tempo reale)
-- ============================================================
-- Crea il bucket storage se non esiste
INSERT INTO storage.buckets (id, name, public)
VALUES ('birozze_photos', 'birozze_photos', true)
ON CONFLICT (id) DO NOTHING;

-- Rimozione preventiva delle policy del bucket per evitare errori di duplicazione
DROP POLICY IF EXISTS "Accesso pubblico insert storage birozze_photos" ON storage.objects;
DROP POLICY IF EXISTS "Accesso pubblico select storage birozze_photos" ON storage.objects;
DROP POLICY IF EXISTS "Accesso pubblico delete storage birozze_photos" ON storage.objects;

-- Consenti a chiunque di caricare foto nel bucket
CREATE POLICY "Accesso pubblico insert storage birozze_photos"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'birozze_photos');

-- Consenti a chiunque di visualizzare le foto del bucket
CREATE POLICY "Accesso pubblico select storage birozze_photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'birozze_photos');

-- Consenti a chiunque di eliminare le foto del bucket
CREATE POLICY "Accesso pubblico delete storage birozze_photos"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'birozze_photos');
