// Birrozze — daily-report
// Legge activity_log delle ultime 24h con la service_role key (bypassa RLS,
// i membri non possono leggere questi dati dal frontend) e invia un report
// via email a chi amministra l'app, usando Resend.
//
// Variabili d'ambiente:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  -> iniettate automaticamente da Supabase
//   RESEND_API_KEY                            -> da impostare (supabase secrets set)
//   ADMIN_EMAIL                                -> opzionale, default sotto

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "gabriele.fon9157@gmail.com";

const ACTION_LABELS: Record<string, string> = {
  login_password: "Accesso con password",
  signup: "Nuova registrazione",
  login_google: "Accesso con Google",
  login_google_mock: "Accesso Google (simulato)",
  create_group: "Gruppo creato",
  connect_group: "Ingresso in un gruppo (codice)",
  join_group_link: "Ingresso in un gruppo (link invito)",
  join_group: "Nuovo membro nel gruppo",
  leave_group: "Uscita dal gruppo",
  rename_group: "Gruppo rinominato",
  change_avatar: "Foto profilo cambiata",
  remove_member: "Membro rimosso dal gruppo",
  drink_add: "Bevuta aggiunta",
  drink_remove: "Bevuta rimossa",
  expense_add: "Spesa registrata",
  expense_remove: "Spesa eliminata",
  photo_add: "Foto caricata in galleria",
  photo_remove: "Foto rimossa dalla galleria",
  perla_add: "Perla aggiunta al muro",
  perla_remove: "Perla rimossa dal muro",
  oscar_vote: "Voto Oscar",
  oscar_category_add: "Nuova categoria Oscar",
  drinking_vote: "Voto 'Stasera si beve?'",
  ride_offer: "Passaggio offerto",
  ride_book: "Posto auto prenotato",
  ride_unbook: "Posto auto lasciato",
  ride_withdraw: "Offerta passaggio ritirata"
};

Deno.serve(async (_req) => {
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [{ data: events, error: evErr }, { data: sessions, error: sessErr }] = await Promise.all([
      admin.from("activity_log").select("*").gte("created_at", since).order("created_at", { ascending: true }),
      admin.from("sessions").select("id, name")
    ]);
    if (evErr) throw evErr;
    if (sessErr) throw sessErr;

    const sessionNames = new Map<string, string>();
    (sessions || []).forEach((s: { id: string; name: string }) => sessionNames.set(s.id, s.name || s.id));

    const html = buildReportHtml(events || [], sessionNames);

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Birrozze Report <onboarding@resend.dev>",
        to: [ADMIN_EMAIL],
        subject: `Birrozze — report giornaliero (${(events || []).length} eventi)`,
        html
      })
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      throw new Error(`Resend ha risposto ${emailRes.status}: ${errText}`);
    }

    return new Response(JSON.stringify({ ok: true, events: (events || []).length }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("[daily-report]", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});

function buildReportHtml(events: any[], sessionNames: Map<string, string>): string {
  const total = events.length;
  const byAction: Record<string, number> = {};
  const byUser: Record<string, number> = {};
  const byGroup: Record<string, number> = {};
  const usersSet = new Set<string>();
  const groupsSet = new Set<string>();

  events.forEach((e) => {
    byAction[e.action] = (byAction[e.action] || 0) + 1;
    const who = e.actor_name || e.actor_email || "Anonimo";
    byUser[who] = (byUser[who] || 0) + 1;
    if (e.actor_email) usersSet.add(e.actor_email);
    const gname = e.session_id ? (sessionNames.get(e.session_id) || e.session_id) : "— senza gruppo —";
    byGroup[gname] = (byGroup[gname] || 0) + 1;
    if (e.session_id) groupsSet.add(e.session_id);
  });

  const topUsers = Object.entries(byUser).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topActions = Object.entries(byAction).sort((a, b) => b[1] - a[1]);
  const topGroups = Object.entries(byGroup).sort((a, b) => b[1] - a[1]);

  const dateLabel = new Date().toLocaleDateString("it-IT", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  const rows = (arr: [string, number][], labelFn?: (k: string) => string) =>
    arr.map(([k, v]) =>
      `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;">${labelFn ? labelFn(k) : escapeHtml(k)}</td>` +
      `<td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${v}</td></tr>`
    ).join("");

  const recentRows = events.slice(-25).reverse().map((e) => {
    const t = new Date(e.created_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    const who = escapeHtml(e.actor_name || e.actor_email || "Anonimo");
    const label = ACTION_LABELS[e.action] || e.action;
    const gname = e.session_id ? escapeHtml(sessionNames.get(e.session_id) || e.session_id) : "—";
    const detail = summarizeDetails(e.action, e.details);
    return `<tr><td style="padding:6px 10px;border-bottom:1px solid #f2f2f2;color:#999;font-size:12px;white-space:nowrap;">${t}</td>` +
      `<td style="padding:6px 10px;border-bottom:1px solid #f2f2f2;">${who}</td>` +
      `<td style="padding:6px 10px;border-bottom:1px solid #f2f2f2;">${label}${detail ? " — " + detail : ""}</td>` +
      `<td style="padding:6px 10px;border-bottom:1px solid #f2f2f2;color:#999;font-size:12px;">${gname}</td></tr>`;
  }).join("");

  return `
  <div style="font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;color:#2A2318;">
    <h1 style="font-size:20px;margin:0 0 4px;">🍺 Birrozze — report giornaliero</h1>
    <p style="color:#78716c;font-size:13px;margin:0 0 24px;text-transform:capitalize;">${dateLabel}</p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:28px;"><tr>
      <td style="width:33%;background:#FBF0D0;border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:#B77E10;">${total}</div>
        <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:#78716c;margin-top:4px;">Eventi nelle 24h</div>
      </td>
      <td style="width:2%;"></td>
      <td style="width:33%;background:#FBF0D0;border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:#B77E10;">${usersSet.size}</div>
        <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:#78716c;margin-top:4px;">Utenti attivi</div>
      </td>
      <td style="width:2%;"></td>
      <td style="width:33%;background:#FBF0D0;border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:#B77E10;">${groupsSet.size}</div>
        <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:#78716c;margin-top:4px;">Gruppi attivi</div>
      </td>
    </tr></table>

    <h2 style="font-size:15px;border-bottom:2px solid #E3A320;padding-bottom:6px;">Persone più attive</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px;">${rows(topUsers) || emptyRow()}</table>

    <h2 style="font-size:15px;border-bottom:2px solid #E3A320;padding-bottom:6px;">Azioni per tipo</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px;">${rows(topActions, (k) => ACTION_LABELS[k] || k) || emptyRow()}</table>

    <h2 style="font-size:15px;border-bottom:2px solid #E3A320;padding-bottom:6px;">Per gruppo</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px;">${rows(topGroups) || emptyRow()}</table>

    <h2 style="font-size:15px;border-bottom:2px solid #E3A320;padding-bottom:6px;">Ultimi 25 eventi</h2>
    <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
      <thead><tr style="color:#999;text-align:left;font-size:11px;text-transform:uppercase;">
        <th style="padding:6px 10px;">Ora</th><th style="padding:6px 10px;">Chi</th><th style="padding:6px 10px;">Cosa</th><th style="padding:6px 10px;">Gruppo</th>
      </tr></thead>
      <tbody>${recentRows || '<tr><td colspan="4" style="padding:16px;text-align:center;color:#999;">Nessun evento nelle ultime 24 ore.</td></tr>'}</tbody>
    </table>

    <p style="color:#bbb;font-size:11px;margin-top:32px;">Generato automaticamente da Birrozze ogni giorno alle 08:00 (fuso orario italiano, CEST).</p>
  </div>`;
}

function emptyRow(): string {
  return '<tr><td style="padding:12px;text-align:center;color:#999;">Nessun dato.</td></tr>';
}

function summarizeDetails(action: string, details: any): string {
  if (!details) return "";
  try {
    if (action === "drink_add" || action === "drink_remove") return escapeHtml(details.drink || "");
    if (action === "expense_add" || action === "expense_remove")
      return escapeHtml(details.desc || "") + (details.amount ? ` (€${details.amount})` : "");
    if (action === "photo_add") return details.caption ? `"${escapeHtml(details.caption)}"` : "";
    if (action === "oscar_vote") return `${escapeHtml(details.category || "")} → ${escapeHtml(details.candidate || "")}`;
    if (action === "ride_offer") return `${details.seats || "?"} posti, ${escapeHtml(details.direction || "")}`;
    if (action === "ride_book" || action === "ride_unbook") return `con ${escapeHtml(details.driver || "")} (${escapeHtml(details.leg || "")})`;
    if (action === "drinking_vote") return details.vote === "si" ? "Sì 🍺" : "No 🛑";
    if (action === "rename_group") return escapeHtml(details.name || "");
    if (action === "join_group" || action === "perla_add") return escapeHtml(details.name || details.author || "");
    return "";
  } catch {
    return "";
  }
}

function escapeHtml(s: string): string {
  return String(s || "").replace(/[&<>"]/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string
  ));
}
