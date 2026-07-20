# Report giornaliero Birrozze — setup (una tantum)

Questa guida attiva l'invio automatico di un'email ogni giorno alle **08:00 (ora italiana, CEST)** con il riepilogo di tutto ciò che succede su Birrozze: login, bevute, spese, foto, voti, passaggi auto. Va fatto una sola volta.

Architettura: `shared.js` registra ogni azione in `public.activity_log` → una Edge Function (`daily-report`) legge le ultime 24h e compone l'email → `pg_cron` la invoca ogni giorno → **Resend** consegna l'email.

---

## 1. Applica lo schema aggiornato

Su [supabase.com/dashboard](https://supabase.com/dashboard) → il tuo progetto → **SQL Editor** → incolla tutto il contenuto di `schema.sql` (già aggiornato con la tabella `activity_log`) → **Run**.

## 2. Crea un account Resend

1. Vai su [resend.com](https://resend.com) → **Sign up** (gratis, 3000 email/mese, nessuna carta richiesta).
2. Usa la stessa email a cui vuoi ricevere il report (`gabriele.fon9157@gmail.com`): il mittente di test `onboarding@resend.dev` può inviare **solo** all'email con cui ti sei registrato, senza dover verificare un dominio — perfetto per questo caso d'uso.
3. Dashboard Resend → **API Keys** → **Create API Key** → copia la chiave (inizia con `re_...`). Non la rivedrai più: salvala da qualche parte al sicuro.

## 3. Installa la Supabase CLI (se non ce l'hai già)

```powershell
npm install -g supabase
supabase --version
```

## 4. Collega la CLI al progetto

```powershell
supabase login
```

Si apre il browser per autenticarti. Poi, dalla cartella del progetto:

```powershell
cd "c:\Users\Gabbo\Desktop\BIRROZZE"
supabase link --project-ref pkdqefzogmuvrewadden
```

## 5. Imposta i secret della funzione

```powershell
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
supabase secrets set ADMIN_EMAIL=gabriele.fon9157@gmail.com
```

(`ADMIN_EMAIL` è opzionale: se lo ometti, la funzione usa comunque `gabriele.fon9157@gmail.com` come default.)

## 6. Deploya la funzione

```powershell
supabase functions deploy daily-report
```

Al termine, l'URL della funzione sarà:
`https://pkdqefzogmuvrewadden.supabase.co/functions/v1/daily-report`

## 7. Test manuale (prima di schedulare)

```powershell
supabase functions invoke daily-report
```

Se tutto è a posto ricevi `{"ok":true,"events":N}` e un'email arriva nella tua casella entro pochi secondi. Se dà errore, leggi il messaggio: quasi sempre è `RESEND_API_KEY` mancante/errata o `ADMIN_EMAIL` diverso dall'email di registrazione Resend (vedi punto 2.2).

## 8. Abilita le estensioni e programma l'invio giornaliero

Nel **SQL Editor** di Supabase, esegui:

```sql
-- Estensioni necessarie (una tantum)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Recupera QUI la service_role key: Dashboard → Settings → API → "service_role" (secret)
-- Non è l'anon key già presente in config.js: è un'altra chiave, più potente, da NON
-- mettere mai nel frontend. Qui è al sicuro perché resta dentro il database.
select vault.create_secret('https://pkdqefzogmuvrewadden.supabase.co', 'project_url');
select vault.create_secret('INCOLLA_QUI_LA_SERVICE_ROLE_KEY', 'service_role_key');

-- Programma l'invio ogni giorno alle 06:00 UTC = 08:00 in Italia (ora legale, CEST,
-- marzo-ottobre). In inverno (CET) arriverà alle 07:00: se vuoi le 08:00 fisse anche
-- d'inverno, cambia '0 6 * * *' in '0 7 * * *' quando torni all'ora solare.
select cron.schedule(
  'birrozze-daily-report',
  '0 6 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/daily-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

Fatto! Da domani mattina alle 08:00 arriva il primo report automatico.

---

## Come verificare che il cron giri davvero

```sql
-- Vedi i job schedulati
select * from cron.job;

-- Vedi l'esito delle ultime esecuzioni (successo/errore, senza retry automatico)
select * from cron.job_run_details order by start_time desc limit 5;
```

## Per fermarlo o modificarlo

```sql
select cron.unschedule('birrozze-daily-report');
```

Poi rilancia la `cron.schedule(...)` sopra con l'orario nuovo.

## Cosa NON viene tracciato (scelta deliberata)

Il tracciamento riguarda solo azioni che cambiano qualcosa (login, bevuta aggiunta, foto caricata, voto espresso, passaggio prenotato...), mai la semplice navigazione tra pagine o i click. La tabella `activity_log` non ha una policy di lettura per il frontend: nessun membro del gruppo — nemmeno tu, loggato come utente normale — può leggerla dall'app. Solo la Edge Function, usando la service_role key, può leggerla per comporre il report che arriva esclusivamente alla tua email.
