# Miljövariabler i produktion

Klassificering:

- **Krävs** — appen fungerar inte utan den.
- **Valfri** — funktionen stängs av eller får reservläge om den saknas.
- **Publik** — säkert att exponera i webbläsaren (`NEXT_PUBLIC_`).
- **Hemlig** — får ALDRIG exponeras klient-side eller loggas.

## Supabase (databas och auth)

| Variabel | Krav | Typ | Beskrivning |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Krävs | Publik | Projektets URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Krävs | Publik | Anon-nyckel (skyddas av RLS). |
| `SUPABASE_SERVICE_ROLE_KEY` | Krävs | **Hemlig, endast server** | Full databas-åtkomst. Läcker denna är alla kunders data exponerad. |
| `SUPABASE_STORAGE_BUCKET` | Valfri | Server | Namn på lagringsyta för dokument. Standard: `coordiqo-documents`. |

## Webbplats

| Variabel | Krav | Typ | Beskrivning |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Krävs i produktion | Publik | Appens publika adress. Används i inbjudningslänkar. |
| `NEXT_PUBLIC_COMPANY_NAME` | Valfri | Publik | Företagsnamn i mejl och UI. Standard: Coordiqo. |
| `NEXT_PUBLIC_MARKETING_SITE_URL` | Valfri | Publik | Extern marknadswebb om separat sådan finns. |

## E-post

| Variabel | Krav | Typ | Beskrivning |
|---|---|---|---|
| `RESEND_API_KEY` | Valfri (krävs för utskick) | Hemlig | Utan den köas mejl som manuella i stället för att skickas. |
| `COORDIQO_FROM_EMAIL` | Rekommenderad | Server | Avsändaradress, t.ex. `Coordiqo <noreply@er-domän.se>`. |
| `INVITE_EMAIL_FROM` | Valfri (äldre) | Server | Reservavsändare om `COORDIQO_FROM_EMAIL` saknas. |
| `COORDIQO_SALES_EMAIL` | Rekommenderad | Server | Mottagare för nya demoansökningar. |
| `COORDIQO_SUPPORT_EMAIL` | Rekommenderad | Server | Mottagare för supportärenden; visas för kunder. |
| `COORDIQO_LEGAL_EMAIL` | Rekommenderad | Server | Kontakt på juridiska sidor. |

## Kartor och ruttberäkning (valfritt — säkert reservläge finns)

| Variabel | Krav | Typ | Beskrivning |
|---|---|---|---|
| `NEXT_PUBLIC_MAPLIBRE_STYLE_URL` | Valfri | Publik | Kartstil för operationskartan. |
| `GRAPHHOPPER_API_URL` | Valfri | Server | Ruttberäkning. Utan den används intern uppskattning. |
| `GRAPHHOPPER_API_KEY` | Valfri | Hemlig | Nyckel för GraphHopper. |
| `VALHALLA_API_URL` | Valfri | Server | Alternativ ruttmotor (identifieras i hälsokontroll). |
| `VROOM_API_URL` | Valfri | Server | Ruttoptimering. Utan den används enklare intern optimering. |
| `VROOM_API_KEY` | Valfri | Hemlig | Nyckel för VROOM. |

## AI (valfritt — avstängt om okonfigurerat)

| Variabel | Krav | Typ | Beskrivning |
|---|---|---|---|
| `LANGFLOW_API_URL` eller `LANGFLOW_SERVER_URL` + `LANGFLOW_FLOW_ID` | Valfri | Server | AI-beslutsstöd. |
| `LANGFLOW_API_KEY` | Valfri | Hemlig | Nyckel för Langflow. |
| `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` | Valfri | Hemlig | AI-observabilitet. |

## SMS (valfritt — avstängt om okonfigurerat)

| Variabel | Krav | Typ | Beskrivning |
|---|---|---|---|
| `TWILIO_ACCOUNT_SID` | Valfri | Hemlig | SMS-utskick. |
| `TWILIO_AUTH_TOKEN` | Valfri | Hemlig | SMS-utskick. |
| `TWILIO_FROM_NUMBER` | Valfri | Server | Avsändarnummer. |

## Kunskapskälla (valfritt)

| Variabel | Krav | Typ | Beskrivning |
|---|---|---|---|
| `NOTION_API_KEY` | Valfri | Hemlig | Notion-synk för kunskapsdokument. |
| `NOTION_WORKSPACE_ID` | Valfri | Server | Notion-arbetsyta. |
