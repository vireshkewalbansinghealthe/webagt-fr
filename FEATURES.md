# WebAGT — Platform Functionaliteiten

> Versie: maart 2026  
> Platform: https://www.webagt.ai

---

## 🤖 AI Website Builder

- **AI Chat Interface** — Beschrijf wat je wilt, de AI genereert en past je website aan via gewone taal
- **Multi-model ondersteuning** — Keuze uit meerdere AI-modellen (Anthropic Claude, OpenAI GPT, DeepSeek, Google Gemini)
- **Live code generatie** — HTML/CSS/JS code wordt realtime gegenereerd en gepreviewd
- **Iteratief bouwen** — Stel vervolgvragen om de website stap voor stap te verfijnen
- **Context-bewust** — De AI onthoudt de volledige chatgeschiedenis per project

---

## ✏️ Visuele Editor

- **Klik-om-te-bewerken** — Klik direct op tekst of afbeeldingen in de live preview om ze te bewerken
- **Inline tekstbewerking** — Tekst aanpassen zonder code te schrijven
- **Afbeelding vervangen** — Klik op een afbeelding in de preview om de URL te wijzigen
- **Slimme tekstherkenning** — Geavanceerd algoritme vindt de exacte tekst terug in de broncode (ook JSX/variabelen)
- **Broken image fallback** — Afbeeldingen die niet laden (bijv. Unsplash 404) worden automatisch vervangen door een placeholder
- **Escape om te annuleren** — Druk op Escape om bewerkingen te annuleren

---

## 👁️ Live Preview

- **Realtime preview** — Zie wijzigingen direct in een embedded preview
- **Sandpack integratie** — Volledig functionele browser-sandbox voor de live preview
- **"Built with WebAGT" badge** — Branding badge rechtsonder in de preview
- **Responsive preview** — Bekijk de site zoals die eruit ziet voor bezoekers

---

## 📁 Projectbeheer

- **Meerdere projecten** — Beheer al je websites in één dashboard
- **Projecttypen** — Website, webshop, en meer
- **Versiegeschiedenis** — Bekijk en herstel eerdere versies van je project
- **Projectnaam & metadata** — Sla projectnaam, type en template op
- **Template systeem** — Start vanuit een bestaand template (bijv. parfum webshop)
- **Projectexport** — Exporteer de broncode van je project
- **Thumbnail generatie** — Automatische screenshot/thumbnail van je project

---

## 👥 Samenwerken (Collaboratie)

- **Projectuitnodigingen per e-mail** — Nodig teamleden uit via e-mail met een gepersonaliseerde uitnodigingslink (Resend)
- **Realtime aanwezigheid** — Zie wie er op dit moment in hetzelfde project werkt (avatar-stack via Supabase Realtime)
- **Rolgebaseerde toegang** — Onderscheid tussen eigenaar en medewerker (editor/viewer)
- **Accepteer uitnodiging pagina** — Publieke pagina om uitnodigingen te accepteren

---

## 🛍️ Shop Manager (Webshop)

- **Dashboard** — Overzicht van totaal producten, bestellingen en omzet
- **Producten** — Voeg producten toe, bewerk ze, verwijder ze (naam, prijs, afbeelding, SKU, voorraad, categorie)
- **Bestellingen** — Bekijk alle orders met klantgegevens, status en bedrag
- **Betalingen (Stripe)** — Koppel een Stripe account (test of live) via onboarding
- **Publiceren** — Publiceer de webshop live via Coolify met één klik
- **Notificaties** — Configureer e-mailmeldingen voor nieuwe bestellingen (shop eigenaar + klantbevestiging)
- **Custom e-maildomein** — Gebruik je eigen domein als afzender (met DNS verificatie via Resend)
- **Instellingen** — Bekijk database-details, projectinfo en verbindingsgegevens
- **Auto-refresh** — Dashboard en bestellingen verversen automatisch elke 10 seconden (quasi-realtime)
- **Nieuw order badge** — Rode badge op het Shop-tabblad bij nieuwe bestellingen

---

## 🗄️ Database (Turso)

- **Automatische database provisioning** — Elke webshop krijgt zijn eigen Turso (SQLite edge) database
- **Directe database-toegang** — Voer queries uit vanuit de Shop Manager
- **Schema migratie** — Automatische toevoeging van ontbrekende kolommen bij updates
- **Supabase Storage** — Afbeeldingen van gebruikers worden opgeslagen in Supabase Storage buckets

---

## 💳 Abonnementen & Credits

- **Gratis plan** — Maximum 3 projecten, beperkt aantal AI-credits
- **Pro plan** — Onbeperkte projecten, hogere creditlimiet
- **Credit systeem** — Bijhouden van verbruikte en resterende AI-credits per gebruiker
- **Upgrade modal** — Mooie upgrade-prompt wanneer gratis limiet bereikt is (met Clerk Pricing Table)
- **Stripe integratie** — Betalingen voor abonnementen verlopen via Stripe

---

## 🚀 Publiceren & Hosting

- **Coolify deployment** — Publiceer webshops direct naar Coolify met realtime deployment logs
- **Subdomain** — Gratis subdomain: `agt-[projectid].dock.4esh.nl`
- **Custom domein** — Koppel je eigen domeinnaam
- **Deployment status tracking** — Volg de voortgang van deployments in realtime
- **Confetti animatie** — Feestelijke animatie bij succesvolle publicatie

---

## 🔐 Authenticatie & Beveiliging

- **Clerk authenticatie** — Veilige login, registratie en sessiebeheer
- **Google / Social login** — Inloggen via sociale accounts
- **Beschermde routes** — Middleware beschermt alle app-pagina's
- **JWT-gebaseerde API-beveiliging** — Alle API-aanroepen zijn beveiligd met Clerk JWT tokens

---

## 🛠️ Admin Paneel

- **Platform statistieken** — Totaal aantal gebruikers, projecten en recente aanmeldingen
- **Gebruikersbeheer** — Zoek, bekijk en beheer alle gebruikers
- **Credit override** — Pas credits en plan van een gebruiker handmatig aan
- **Project verwijderen** — Verwijder elk project als admin
- **LLM Provider status** — Bekijk status en gebruikskosten van Anthropic, OpenAI, DeepSeek en Google AI
- **Anthropic kosten breakdown** — Gedetailleerd maandelijks kostenrapport per model (berekend uit tokengebruik)
- **Admin-only toegang** — Beveiligd via Clerk `publicMetadata.role = "admin"`

---

## 📊 Analyse

- **Analytics dashboard** — Inzicht in platformgebruik en statistieken
- **Projectanalyse** — Per-project gebruiksstatistieken

---

## 🌐 Marketing & Publieke Pagina's

- **Homepage** — Slogan: "Build Smarter. Launch Faster. Grow Bigger."
- **Pricing pagina** — Overzicht van abonnementen en functies
- **Over ons pagina** — Informatie over het platform
- **Contact pagina** — Contactformulier
- **Help & Support pagina** — Veelgestelde vragen en ondersteuning
- **Cookie consent** — GDPR-conforme cookiebanner
- **Dark mode standaard** — Donker thema als standaard voor nieuwe gebruikers

---

## ⚙️ Technische Stack

| Laag | Technologie |
|------|------------|
| Frontend | Next.js 16, React, Tailwind CSS, shadcn/ui |
| Backend | Cloudflare Workers, Hono |
| Auth | Clerk |
| Database (metadata) | Cloudflare KV |
| Database (webshop) | Turso (SQLite edge) |
| Storage (afbeeldingen) | Supabase Storage |
| Realtime aanwezigheid | Supabase Realtime |
| E-mail | Resend |
| Betalingen | Stripe Connect |
| Hosting (frontend) | Vercel |
| Hosting (webshops) | Coolify |
| AI providers | Anthropic, OpenAI, DeepSeek, Google AI |

---

*Gegenereerd op 30 maart 2026*
