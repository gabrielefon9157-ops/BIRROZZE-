-- ============================================================
-- SCHEMA SQL RELAZIONALE PER BIROZZE (DATABASE SUPABASE)
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

-- Registrazione delle tabelle al canale Realtime di Supabase
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crew;
ALTER PUBLICATION supabase_realtime ADD TABLE public.drinks_consumed;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.photos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.perle;
ALTER PUBLICATION supabase_realtime ADD TABLE public.oscars;
ALTER PUBLICATION supabase_realtime ADD TABLE public.oscar_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.proposals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.proposal_votes;
