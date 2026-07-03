-- Coordiqo go-live: dynamic industry registry.
--
-- Turns public.industry_types into a full industry profile registry so new
-- industries can be added from admin/configuration without code changes.
--
-- Safety:
-- * Additive only ("add column if not exists", upserts).
-- * No rows are deleted and no customer data is rewritten.
-- * The hardcoded industry check constraint is replaced by a foreign key to
--   the registry, after guaranteeing that every referenced code exists.
-- * Safe to run more than once.

-- 1. Extend industry_types into a full industry profile registry -------------

alter table public.industry_types add column if not exists name_sv text;
alter table public.industry_types add column if not exists name_en text;
alter table public.industry_types add column if not exists short_name_sv text;
alter table public.industry_types add column if not exists short_name_en text;
alter table public.industry_types add column if not exists description_sv text;
alter table public.industry_types add column if not exists description_en text;
alter table public.industry_types add column if not exists default_operational_model text;
alter table public.industry_types add column if not exists allowed_operational_models text[] not null default '{}'::text[];
alter table public.industry_types add column if not exists default_locale text not null default 'sv';
alter table public.industry_types add column if not exists default_timezone text not null default 'Europe/Stockholm';
alter table public.industry_types add column if not exists default_currency text not null default 'SEK';
alter table public.industry_types add column if not exists terminology jsonb not null default '{}'::jsonb;
alter table public.industry_types add column if not exists task_types jsonb not null default '[]'::jsonb;
alter table public.industry_types add column if not exists resource_types jsonb not null default '[]'::jsonb;
alter table public.industry_types add column if not exists statuses jsonb not null default '[]'::jsonb;
alter table public.industry_types add column if not exists planning_rules jsonb not null default '[]'::jsonb;
alter table public.industry_types add column if not exists mobile_actions jsonb not null default '[]'::jsonb;
alter table public.industry_types add column if not exists onboarding_template jsonb not null default '[]'::jsonb;
alter table public.industry_types add column if not exists feature_defaults jsonb not null default '{}'::jsonb;
alter table public.industry_types add column if not exists compliance_profile jsonb not null default '{}'::jsonb;
alter table public.industry_types add column if not exists archived_at timestamptz;

-- Backfill Swedish names from the legacy name column.
update public.industry_types set name_sv = name where name_sv is null;

-- 2. Seed / refresh the launch industries ------------------------------------
-- Upsert keeps is_active/archived_at untouched on existing rows so an admin
-- can archive an industry without a re-run reactivating it.

insert into public.industry_types (
  code, name, description, sort_order,
  name_sv, name_en, short_name_sv, short_name_en, description_sv, description_en,
  default_operational_model, allowed_operational_models,
  terminology, task_types, resource_types, statuses, planning_rules, mobile_actions,
  feature_defaults
) values
  (
    'home_care', 'Hemtjänst / omsorg', 'Besök, kontinuitet, rätt kompetens, nycklar och daglig omsorgsplanering.', 10,
    'Hemtjänst / omsorg', 'Home care', 'Hemtjänst', 'Home care',
    'Besök, kontinuitet, rätt kompetens, nycklar och daglig omsorgsplanering.',
    'Visits, continuity, skills, keys and daily care planning.',
    'route_based', array['route_based','area_based','team_based'],
    '{"entity":"Vårdtagare","entities":"Vårdtagare","task":"Insats","tasks":"Insatser","staff":"Personal","route":"Rutt","resources":"Resurser","schedule":"Schema"}'::jsonb,
    '["Morgonbesök","Lunchbesök","Kvällsbesök","Tillsyn","Läkemedelspåminnelse","Dubbelbemanning"]'::jsonb,
    '["Nyckel","Passerkort","Medicinväska","Bil","Cykel"]'::jsonb,
    '["Planerad","Påbörjad","Klar","Avvikelse","Kunde ej utföras"]'::jsonb,
    '["Kontinuitet","Kompetenskrav","Tidsfönster","Nyckelansvar","Restid","Dubbelbemanning"]'::jsonb,
    '["Starta besök","Markera klart","Rapportera avvikelse","Kvittera resurs"]'::jsonb,
    '{"all_core_modules": true}'::jsonb
  ),
  (
    'healthcare', 'Vård / hemsjukvård', 'Patientbesök, legitimation, medicinsk utrustning och tidsstyrda insatser.', 20,
    'Vård / hemsjukvård', 'Healthcare / home nursing', 'Vård', 'Healthcare',
    'Patientbesök, legitimation, medicinsk utrustning och tidsstyrda insatser.',
    'Patient visits, licenses, medical equipment and time-critical care.',
    'route_based', array['route_based','case_based','team_based'],
    '{"entity":"Patient","entities":"Patienter","task":"Vårduppdrag","tasks":"Vårduppdrag","staff":"Vårdpersonal","route":"Rutt","resources":"Utrustning","schedule":"Schema"}'::jsonb,
    '["Hembesök","Provtagning","Omläggning","Uppföljning","Akutbesök"]'::jsonb,
    '["Medicinsk utrustning","Väska","Bil","Nyckel","Passerkort"]'::jsonb,
    '["Planerad","Påbörjad","Klar","Avvikelse","Akut"]'::jsonb,
    '["Legitimation","Certifikat","Tidsfönster","Kontinuitet","Resurskrav"]'::jsonb,
    '["Starta uppdrag","Klarmarkera","Rapportera hinder","Kvittera resurs"]'::jsonb,
    '{"all_core_modules": true}'::jsonb
  ),
  (
    'cleaning', 'Städ', 'Objekt, checklistor, återkommande städ, nycklar och maskiner.', 30,
    'Städ', 'Cleaning', 'Städ', 'Cleaning',
    'Objekt, checklistor, återkommande städ, nycklar och maskiner.',
    'Objects, checklists, recurring cleaning, keys and machines.',
    'route_based', array['route_based','object_based','team_based'],
    '{"entity":"Städobjekt","entities":"Städobjekt","task":"Städuppdrag","tasks":"Städuppdrag","staff":"Personal","route":"Rutt","resources":"Resurser","schedule":"Schema"}'::jsonb,
    '["Kontorsstäd","Trappstäd","Flyttstäd","Byggstäd","Fönsterputs"]'::jsonb,
    '["Nyckel","Passerkort","Städmaskin","Bil","Cykel","Material"]'::jsonb,
    '["Planerad","Påbörjad","Klar","Avvikelse"]'::jsonb,
    '["Objektkrav","Material","Restid","Återkommande schema"]'::jsonb,
    '["Starta städ","Klar","Rapportera problem","Kvittera resurs"]'::jsonb,
    '{"all_core_modules": true}'::jsonb
  ),
  (
    'property', 'Fastighet', 'Fastigheter, felanmälan, nycklar, servicepunkter och driftteam.', 40,
    'Fastighet', 'Property management', 'Fastighet', 'Property',
    'Fastigheter, felanmälan, nycklar, servicepunkter och driftteam.',
    'Properties, fault reports, keys, service points and operations teams.',
    'object_based', array['object_based','case_based','route_based'],
    '{"entity":"Objekt","entities":"Objekt","task":"Ärende","tasks":"Ärenden","staff":"Personal","route":"Rutt","resources":"Resurser","schedule":"Schema"}'::jsonb,
    '["Felanmälan","Besiktning","Låsbyte","Driftkontroll","Underhåll"]'::jsonb,
    '["Nyckel","Passerkort","Servicebil","Verktyg","Maskin"]'::jsonb,
    '["Öppen","Tilldelad","Pågår","Klar","Blockerad"]'::jsonb,
    '["SLA","Nyckelansvar","Kompetens","Område"]'::jsonb,
    '["Starta ärende","Klar","Rapportera hinder","Kvittera resurs"]'::jsonb,
    '{"all_core_modules": true}'::jsonb
  ),
  (
    'field_service', 'Tekniker / fältservice', 'Serviceorder, SLA, tekniker, reservdelar och fordon.', 50,
    'Tekniker / fältservice', 'Field service', 'Fältservice', 'Field service',
    'Serviceorder, SLA, tekniker, reservdelar och fordon.',
    'Service orders, SLA, technicians, spare parts and vehicles.',
    'route_based', array['route_based','case_based','object_based'],
    '{"entity":"Servicepunkt","entities":"Servicepunkter","task":"Serviceorder","tasks":"Serviceorder","staff":"Tekniker","route":"Rutt","resources":"Resurser","schedule":"Schema"}'::jsonb,
    '["Installation","Felsökning","Servicebesök","Akutjobb","Uppföljning"]'::jsonb,
    '["Servicebil","Verktygsväska","Reservdel","Handdator","Nyckel"]'::jsonb,
    '["Planerad","På väg","Pågår","Klar","Kunde ej utföras"]'::jsonb,
    '["SLA","Kompetens","Reservdelar","Restid"]'::jsonb,
    '["På väg","Starta jobb","Klart","Rapportera hinder"]'::jsonb,
    '{"all_core_modules": true}'::jsonb
  ),
  (
    'parking', 'Parkeringsövervakning', 'Zoner, patruller, kontrollpunkter och incidenter.', 60,
    'Parkeringsövervakning', 'Parking enforcement', 'Parkering', 'Parking',
    'Zoner, patruller, kontrollpunkter och incidenter.',
    'Zones, patrols, control points and incidents.',
    'patrol_based', array['patrol_based','route_based','area_based'],
    '{"entity":"Zon","entities":"Zoner","task":"Kontroll","tasks":"Kontroller","staff":"Patrull","route":"Patrullrutt","resources":"Resurser","schedule":"Schema"}'::jsonb,
    '["Zonkontroll","Incident","Rond","Uppföljning"]'::jsonb,
    '["Bil","Handdator","Cykel","Kamera","Passerkort"]'::jsonb,
    '["Planerad","Pågår","Klar","Avvikelse"]'::jsonb,
    '["Zon","Patrullfrekvens","Restid","Prioritet"]'::jsonb,
    '["Starta kontroll","Klar","Rapportera incident","Kvittera resurs"]'::jsonb,
    '{"all_core_modules": true}'::jsonb
  ),
  (
    'staffing', 'Bemanning', 'Kundplatser, pass, kandidater och tillgänglighet.', 70,
    'Bemanning', 'Staffing', 'Bemanning', 'Staffing',
    'Kundplatser, pass, kandidater och tillgänglighet.',
    'Customer sites, shifts, candidates and availability.',
    'calendar_based', array['calendar_based','team_based','case_based'],
    '{"entity":"Kundplats","entities":"Kundplatser","task":"Pass","tasks":"Pass","staff":"Kandidat","route":"Plan","resources":"Resurser","schedule":"Schema"}'::jsonb,
    '["Dagpass","Kvällspass","Nattpass","Akut bemanning"]'::jsonb,
    '["Passerkort","Kläder","Utrustning","Bil"]'::jsonb,
    '["Öppen","Tilldelad","Bekräftad","Klar","Avvikelse"]'::jsonb,
    '["Tillgänglighet","Kompetens","Arbetstid","Kundkrav"]'::jsonb,
    '["Bekräfta pass","Checka in","Checka ut","Rapportera avvikelse"]'::jsonb,
    '{"all_core_modules": true}'::jsonb
  ),
  (
    'security', 'Bevakning / patrull', 'Patruller, rondpunkter, incidenter och jour.', 80,
    'Bevakning / patrull', 'Security / patrol', 'Bevakning', 'Security',
    'Patruller, rondpunkter, incidenter och jour.',
    'Patrols, checkpoints, incidents and on-call duty.',
    'patrol_based', array['patrol_based','route_based','on_call'],
    '{"entity":"Bevakningsobjekt","entities":"Bevakningsobjekt","task":"Rond/uppdrag","tasks":"Ronder/uppdrag","staff":"Väktare","route":"Patrullrutt","resources":"Resurser","schedule":"Schema"}'::jsonb,
    '["Rond","Larmutryckning","Öppning","Stängning","Incident"]'::jsonb,
    '["Bil","Nyckel","Passerkort","Radio","Larmtagg"]'::jsonb,
    '["Planerad","Påbörjad","Klar","Incident","Avvikelse"]'::jsonb,
    '["Rondfrekvens","Behörighet","Nyckelansvar","Jour"]'::jsonb,
    '["Starta rond","Markera punkt klar","Rapportera incident","Kvittera resurs"]'::jsonb,
    '{"all_core_modules": true}'::jsonb
  ),
  (
    'construction', 'Bygg / projekt', 'Projekt, arbetsmoment, maskiner, team och certifikat.', 90,
    'Bygg / projekt', 'Construction / projects', 'Bygg', 'Construction',
    'Projekt, arbetsmoment, maskiner, team och certifikat.',
    'Projects, work items, machines, teams and certificates.',
    'project_based', array['project_based','team_based','object_based'],
    '{"entity":"Arbetsplats","entities":"Arbetsplatser","task":"Moment","tasks":"Moment","staff":"Personal","route":"Arbetsplan","resources":"Maskiner/verktyg","schedule":"Schema"}'::jsonb,
    '["Rivning","Snickeri","El","VVS","Målning","Besiktning"]'::jsonb,
    '["Borrmaskin","Maskin","Servicebil","Verktygsväska","Lift","Material"]'::jsonb,
    '["Planerad","Pågår","Klar","Blockerad","Avvikelse"]'::jsonb,
    '["Certifikat","Beroenden","Maskinkrav","Teamkapacitet"]'::jsonb,
    '["Starta moment","Klart","Rapportera hinder","Kvittera maskin"]'::jsonb,
    '{"all_core_modules": true}'::jsonb
  ),
  (
    'municipality', 'Kommunal verksamhet', 'Kommunal drift med enheter, områden, måltidsleverans, LSS, fastighet, park och intern service.', 100,
    'Kommunal verksamhet', 'Municipality', 'Kommun', 'Municipality',
    'Kommunal drift med enheter, områden, måltidsleverans, LSS, fastighet, park och intern service.',
    'Municipal operations with units, areas, meal delivery, internal service, property and parks.',
    'area_based', array['area_based','route_based','case_based','team_based'],
    '{"entity":"Mottagare/objekt","entities":"Mottagare och objekt","task":"Kommunuppdrag","tasks":"Kommunuppdrag","staff":"Utförare","route":"Rutt/område","resources":"Kommunresurser","schedule":"Schema"}'::jsonb,
    '["Måltidsleverans","Tillsynsbesök","Intern transport","Fastighetsservice","Park/drift","LSS-insats","Skoltransport"]'::jsonb,
    '["Kommunbil","Cykel","Nyckel","Passerkort","Matlåda/kylbox","Verktyg","Maskin"]'::jsonb,
    '["Planerad","Tilldelad","Påbörjad","Klar","Hinder","Avvikelse"]'::jsonb,
    '["Enhet","Område","Tidsfönster","Fordon","Behörighet","Resursansvar"]'::jsonb,
    '["Påbörja uppdrag","Slutför uppdrag","Rapportera hinder","Kvittera resurs"]'::jsonb,
    '{"all_core_modules": true}'::jsonb
  ),
  (
    'courier', 'Bud / kurir / leverans', 'Pickup, dropoff, multi-stop, fordon, tidsfönster, kapacitet och leveransavvikelser.', 110,
    'Bud / kurir / leverans', 'Courier / delivery', 'Bud/Kurir', 'Courier',
    'Pickup, dropoff, multi-stop, fordon, tidsfönster, kapacitet och leveransavvikelser.',
    'Pickup, dropoff, multi-stop routes, vehicles, time windows and delivery exceptions.',
    'delivery_based', array['delivery_based','route_based','area_based'],
    '{"entity":"Mottagare/kund","entities":"Mottagare och kunder","task":"Leverans","tasks":"Leveranser","staff":"Bud","route":"Leveransrutt","resources":"Fordon/utrustning","schedule":"Schema"}'::jsonb,
    '["Pickup","Delivery","Pickup + dropoff","Retur","Express","Multi-stop route","Schemalagd leverans"]'::jsonb,
    '["Bil","Cykel","Elscooter","Budväska","Kylbox","Handscanner","Lastbil"]'::jsonb,
    '["Planerad","Tilldelad","Hämtad","På väg","Levererad","Misslyckad","Returnerad"]'::jsonb,
    '["Pickup/dropoff","Tidsfönster","Fordonstyp","Kapacitet","Prioritet","Ruttordning"]'::jsonb,
    '["Hämtat paket","På väg","Levererat","Kunde ej leverera","Rapportera avvikelse"]'::jsonb,
    '{"all_core_modules": true}'::jsonb
  ),
  (
    'transport_logistics', 'Transport och logistik', 'Transporter, distribution, terminaler, kapacitet och tidsfönster.', 120,
    'Transport och logistik', 'Transport & logistics', 'Transport', 'Transport',
    'Transporter, distribution, terminaler, kapacitet och tidsfönster.',
    'Transports, distribution, terminals, capacity and time windows.',
    'delivery_based', array['delivery_based','route_based','area_based','calendar_based'],
    '{"entity":"Kund/mottagare","entities":"Kunder och mottagare","task":"Transport","tasks":"Transporter","staff":"Förare","route":"Rutt","resources":"Fordon","schedule":"Schema"}'::jsonb,
    '["Fjärrtransport","Distribution","Hämtning","Leverans","Retur","Terminalarbete"]'::jsonb,
    '["Lastbil","Släp","Skåpbil","Truck","Handscanner","Kylaggregat"]'::jsonb,
    '["Planerad","Tilldelad","Lastad","På väg","Levererad","Avvikelse"]'::jsonb,
    '["Kapacitet","Tidsfönster","Kör- och vilotid","Fordonstyp","Ruttordning"]'::jsonb,
    '["Lastat","På väg","Levererat","Rapportera avvikelse"]'::jsonb,
    '{"all_core_modules": true}'::jsonb
  ),
  (
    'energy_infrastructure', 'Energi / VA / infrastruktur', 'Anläggningar, tillsyn, underhåll, beredskap och behörigheter.', 130,
    'Energi / VA / infrastruktur', 'Energy / utilities / infrastructure', 'Energi/VA', 'Energy',
    'Anläggningar, tillsyn, underhåll, beredskap och behörigheter.',
    'Facilities, inspections, maintenance, on-call and authorizations.',
    'case_based', array['case_based','route_based','area_based','project_based','on_call'],
    '{"entity":"Anläggning","entities":"Anläggningar","task":"Arbetsorder","tasks":"Arbetsorder","staff":"Tekniker","route":"Rutt","resources":"Utrustning","schedule":"Schema"}'::jsonb,
    '["Tillsyn","Underhåll","Felavhjälpning","Mätarbyte","Besiktning","Beredskapsutryckning"]'::jsonb,
    '["Servicebil","Mätinstrument","Verktyg","Skyddsutrustning","Maskin"]'::jsonb,
    '["Planerad","Tilldelad","Pågår","Klar","Blockerad","Avvikelse"]'::jsonb,
    '["Behörighet","Certifikat","SLA","Beredskap","Område"]'::jsonb,
    '["Starta arbete","Klart","Rapportera hinder","Kvittera utrustning"]'::jsonb,
    '{"all_core_modules": true}'::jsonb
  ),
  (
    'telecom_it', 'Telekom / IT-service', 'Installationer, serviceärenden, SLA och kundplatser.', 140,
    'Telekom / IT-service', 'Telecom / IT services', 'Telekom/IT', 'Telecom/IT',
    'Installationer, serviceärenden, SLA och kundplatser.',
    'Installations, service cases, SLA and customer sites.',
    'case_based', array['case_based','route_based','calendar_based','project_based'],
    '{"entity":"Kundplats","entities":"Kundplatser","task":"Serviceärende","tasks":"Serviceärenden","staff":"Tekniker","route":"Rutt","resources":"Utrustning","schedule":"Schema"}'::jsonb,
    '["Installation","Felsökning","Uppgradering","Nedmontering","Kundbesök"]'::jsonb,
    '["Servicebil","Mätinstrument","Reservdel","Verktygsväska","Handdator"]'::jsonb,
    '["Planerad","Tilldelad","Pågår","Klar","Väntar på kund","Avvikelse"]'::jsonb,
    '["SLA","Kompetens","Reservdelar","Restid"]'::jsonb,
    '["Starta ärende","Klart","Rapportera hinder","Kvittera resurs"]'::jsonb,
    '{"all_core_modules": true}'::jsonb
  ),
  (
    'facility_management', 'Facility management', 'Anläggningar, lokalvård, vaktmästeri, ronderingar och SLA.', 150,
    'Facility management', 'Facility management', 'Facility', 'Facility',
    'Anläggningar, lokalvård, vaktmästeri, ronderingar och SLA.',
    'Facilities, cleaning, caretaking, rounds and SLA.',
    'object_based', array['object_based','case_based','route_based','team_based'],
    '{"entity":"Anläggning","entities":"Anläggningar","task":"Ärende","tasks":"Ärenden","staff":"Personal","route":"Runda","resources":"Resurser","schedule":"Schema"}'::jsonb,
    '["Lokalvård","Vaktmästeri","Felanmälan","Rondering","Underhåll","Beställning"]'::jsonb,
    '["Nyckel","Passerkort","Servicebil","Verktyg","Städmaskin"]'::jsonb,
    '["Öppen","Tilldelad","Pågår","Klar","Blockerad"]'::jsonb,
    '["SLA","Objektkrav","Nyckelansvar","Återkommande schema"]'::jsonb,
    '["Starta ärende","Klar","Rapportera hinder","Kvittera resurs"]'::jsonb,
    '{"all_core_modules": true}'::jsonb
  ),
  (
    'waste_recycling', 'Avfall / återvinning', 'Hämtställen, rutter, kärl, fordon och återkommande tömningar.', 160,
    'Avfall / återvinning', 'Waste / recycling', 'Avfall', 'Waste',
    'Hämtställen, rutter, kärl, fordon och återkommande tömningar.',
    'Pickup sites, routes, bins, vehicles and recurring collections.',
    'route_based', array['route_based','area_based','delivery_based'],
    '{"entity":"Hämtställe","entities":"Hämtställen","task":"Hämtning","tasks":"Hämtningar","staff":"Förare","route":"Rutt","resources":"Fordon","schedule":"Schema"}'::jsonb,
    '["Kärltömning","Grovavfall","Farligt avfall","Återvinningshämtning","Containerbyte"]'::jsonb,
    '["Sopbil","Lastbil","Container","Kärl","Handscanner"]'::jsonb,
    '["Planerad","På väg","Utförd","Kunde ej utföras","Avvikelse"]'::jsonb,
    '["Ruttordning","Fordonstyp","Kapacitet","Område","Återkommande schema"]'::jsonb,
    '["Starta rutt","Markera hämtat","Kunde ej hämta","Rapportera avvikelse"]'::jsonb,
    '{"all_core_modules": true}'::jsonb
  ),
  (
    'education', 'Skola / utbildning', 'Enheter, vikariepass, elevassistans, måltider och intern service.', 170,
    'Skola / utbildning', 'Education', 'Skola', 'Education',
    'Enheter, vikariepass, elevassistans, måltider och intern service.',
    'School units, substitute shifts, student support, meals and internal service.',
    'calendar_based', array['calendar_based','team_based','case_based','area_based'],
    '{"entity":"Enhet/skola","entities":"Enheter och skolor","task":"Uppdrag","tasks":"Uppdrag","staff":"Personal","route":"Schema","resources":"Resurser","schedule":"Schema"}'::jsonb,
    '["Vikariepass","Elevassistans","Måltidsservice","Lokalvård","Vaktmästeri"]'::jsonb,
    '["Passerkort","Nyckel","Utrustning","Fordon"]'::jsonb,
    '["Öppen","Tilldelad","Bekräftad","Klar","Avvikelse"]'::jsonb,
    '["Tillgänglighet","Behörighet","Enhet","Arbetstid"]'::jsonb,
    '["Bekräfta pass","Checka in","Checka ut","Rapportera avvikelse"]'::jsonb,
    '{"all_core_modules": true}'::jsonb
  ),
  (
    'hotel_facility', 'Hotell / anläggningsservice', 'Rumsstäd, allmänna ytor, event och felanmälan för anläggningar.', 180,
    'Hotell / anläggningsservice', 'Hotel / facility services', 'Hotell', 'Hotel',
    'Rumsstäd, allmänna ytor, event och felanmälan för anläggningar.',
    'Room cleaning, common areas, events and fault reports for facilities.',
    'object_based', array['object_based','team_based','calendar_based','case_based'],
    '{"entity":"Anläggning","entities":"Anläggningar","task":"Uppdrag","tasks":"Uppdrag","staff":"Personal","route":"Runda","resources":"Resurser","schedule":"Schema"}'::jsonb,
    '["Rumsstäd","Allmänstäd","Tvätthantering","Felanmälan","Event/uppställning"]'::jsonb,
    '["Passerkort","Nyckel","Städvagn","Städmaskin","Utrustning"]'::jsonb,
    '["Planerad","Pågår","Klar","Kontrollerad","Avvikelse"]'::jsonb,
    '["Beläggning","Teamkapacitet","Checklistor","Prioritet"]'::jsonb,
    '["Starta uppdrag","Klart","Rapportera problem","Kvittera resurs"]'::jsonb,
    '{"all_core_modules": true}'::jsonb
  ),
  (
    'industrial_maintenance', 'Industri / underhåll', 'Maskiner, linjer, förebyggande underhåll, stopp och beredskap.', 190,
    'Industri / underhåll', 'Industrial maintenance', 'Industri', 'Industry',
    'Maskiner, linjer, förebyggande underhåll, stopp och beredskap.',
    'Machines, lines, preventive maintenance, downtime and on-call.',
    'case_based', array['case_based','project_based','calendar_based','team_based','on_call'],
    '{"entity":"Maskin/linje","entities":"Maskiner och linjer","task":"Underhållsorder","tasks":"Underhållsorder","staff":"Tekniker","route":"Plan","resources":"Utrustning","schedule":"Schema"}'::jsonb,
    '["Förebyggande underhåll","Akut reparation","Inspektion","Smörjning","Revision"]'::jsonb,
    '["Verktyg","Mätinstrument","Reservdel","Lift","Skyddsutrustning"]'::jsonb,
    '["Planerad","Tilldelad","Pågår","Klar","Väntar på del","Avvikelse"]'::jsonb,
    '["Certifikat","Beroenden","Stopptid","Prioritet","Beredskap"]'::jsonb,
    '["Starta order","Klart","Rapportera hinder","Kvittera utrustning"]'::jsonb,
    '{"all_core_modules": true}'::jsonb
  ),
  (
    'other', 'Annan verksamhet', 'Flexibel branschneutral modell för uppdrag, rutter, resurser och personal.', 900,
    'Annan verksamhet', 'Other', 'Annan', 'Other',
    'Flexibel branschneutral modell för uppdrag, rutter, resurser och personal.',
    'Flexible industry-neutral model for tasks, routes, resources and staff.',
    'route_based', array['route_based','case_based','team_based'],
    '{"entity":"Objekt","entities":"Objekt","task":"Uppdrag","tasks":"Uppdrag","staff":"Personal","route":"Rutt","resources":"Resurser","schedule":"Schema"}'::jsonb,
    '["Besök","Service","Kontroll","Leverans","Projektmoment"]'::jsonb,
    '["Bil","Cykel","Nyckel","Verktyg","Utrustning"]'::jsonb,
    '["Planerad","Pågår","Klar","Avvikelse"]'::jsonb,
    '["Tidsfönster","Kompetens","Resurser","Restid"]'::jsonb,
    '["Starta","Klar","Rapportera problem","Kvittera resurs"]'::jsonb,
    '{"all_core_modules": true}'::jsonb
  )
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  name_sv = excluded.name_sv,
  name_en = excluded.name_en,
  short_name_sv = excluded.short_name_sv,
  short_name_en = excluded.short_name_en,
  description_sv = excluded.description_sv,
  description_en = excluded.description_en,
  default_operational_model = excluded.default_operational_model,
  allowed_operational_models = excluded.allowed_operational_models,
  terminology = case when public.industry_types.terminology = '{}'::jsonb then excluded.terminology else public.industry_types.terminology end,
  task_types = case when public.industry_types.task_types = '[]'::jsonb then excluded.task_types else public.industry_types.task_types end,
  resource_types = case when public.industry_types.resource_types = '[]'::jsonb then excluded.resource_types else public.industry_types.resource_types end,
  statuses = case when public.industry_types.statuses = '[]'::jsonb then excluded.statuses else public.industry_types.statuses end,
  planning_rules = case when public.industry_types.planning_rules = '[]'::jsonb then excluded.planning_rules else public.industry_types.planning_rules end,
  mobile_actions = case when public.industry_types.mobile_actions = '[]'::jsonb then excluded.mobile_actions else public.industry_types.mobile_actions end,
  feature_defaults = case when public.industry_types.feature_defaults = '{}'::jsonb then excluded.feature_defaults else public.industry_types.feature_defaults end,
  updated_at = timezone('utc', now());

-- 3. Onboarding templates -----------------------------------------------------
-- Built by a function so unseeded/custom industries always get a sane template.

create or replace function public.coordiqo_default_onboarding_template(p_industry text)
returns jsonb
language plpgsql
stable
as $$
declare
  v_terminology jsonb := '{}'::jsonb;
  v_entity text;
  v_tasks text;
  v_common jsonb;
  v_extra jsonb := '[]'::jsonb;
begin
  select coalesce(it.terminology, '{}'::jsonb) into v_terminology
  from public.industry_types it where it.code = coalesce(p_industry, 'other');

  v_entity := coalesce(v_terminology->>'entities', 'Objekt/kunder/platser');
  v_tasks := coalesce(v_terminology->>'tasks', 'Uppdrag');

  v_common := jsonb_build_array(
    jsonb_build_object('key','company_information','title','Företagsuppgifter','description','Kontrollera namn, organisationsnummer, tidszon och språk.','required',true,'href','/settings'),
    jsonb_build_object('key','industry_model','title','Bransch och arbetssätt','description','Välj bransch och hur arbetet planeras i vardagen.','required',true,'href','/settings/industry'),
    jsonb_build_object('key','team_roles','title','Team och roller','description','Skapa team och bestäm vem som gör vad.','required',true,'href','/teams'),
    jsonb_build_object('key','staff','title','Personal och utförare','description','Lägg in personal som ska utföra arbetet.','required',true,'href','/staff'),
    jsonb_build_object('key','entities','title',v_entity,'description','Registrera det arbetet utförs hos eller på.','required',true,'href','/entities'),
    jsonb_build_object('key','task_types','title',v_tasks || ' och typer','description','Kontrollera vilka typer av arbete som finns.','required',true,'href','/settings/industry'),
    jsonb_build_object('key','resources','title','Resurser','description','Fordon, nycklar, utrustning och annat med ansvar.','required',false,'href','/resources'),
    jsonb_build_object('key','planning_rules','title','Planeringsregler','description','Tidsfönster, kompetenser och regler för planeringen.','required',false,'href','/settings/industry'),
    jsonb_build_object('key','communication','title','Kommunikation','description','Notiser och kontaktvägar för teamet.','required',false,'href','/settings'),
    jsonb_build_object('key','finish','title','Slutför','description','Markera onboarding som klar och börja planera.','required',true,'href','/onboarding')
  );

  v_extra := case coalesce(p_industry, 'other')
    when 'home_care' then jsonb_build_array(
      jsonb_build_object('key','visit_windows','title','Besökstider och dubbelbemanning','description','Sätt tidsfönster för besök och markera insatser som kräver dubbelbemanning.','required',false,'href','/settings/industry'),
      jsonb_build_object('key','continuity','title','Kontinuitet','description','Bestäm hur viktigt det är att samma personal återkommer.','required',false,'href','/settings/industry'),
      jsonb_build_object('key','keys_access','title','Nycklar och passerkort','description','Registrera nycklar och passerkort med tydligt ansvar.','required',false,'href','/resources'),
      jsonb_build_object('key','deviations','title','Avvikelser','description','Gå igenom hur personal rapporterar avvikelser i mobilen.','required',false,'href','/deviations'),
      jsonb_build_object('key','mobile_execution','title','Mobil utförandevy','description','Testa personalens mobilvy för dagens insatser.','required',false,'href','/staff/mobile/day')
    )
    when 'cleaning' then jsonb_build_array(
      jsonb_build_object('key','checklists','title','Checklistor','description','Definiera vad som ingår i varje städtyp.','required',false,'href','/settings/industry'),
      jsonb_build_object('key','keys_access','title','Nycklar','description','Registrera nycklar och passerkort med ansvar.','required',false,'href','/resources'),
      jsonb_build_object('key','recurring_schedule','title','Återkommande schema','description','Sätt upp återkommande städuppdrag.','required',false,'href','/schedule'),
      jsonb_build_object('key','customer_instructions','title','Kundinstruktioner','description','Lägg in särskilda instruktioner per städobjekt.','required',false,'href','/entities')
    )
    when 'property' then jsonb_build_array(
      jsonb_build_object('key','sla_priority','title','SLA och prioritet','description','Bestäm svarstider och prioriteringsregler för ärenden.','required',false,'href','/settings/industry'),
      jsonb_build_object('key','keys_access','title','Nycklar','description','Registrera nycklar med tydligt ansvar.','required',false,'href','/resources'),
      jsonb_build_object('key','fault_intake','title','Felanmälan','description','Sätt upp kanal för inkommande felanmälningar.','required',false,'href','/property'),
      jsonb_build_object('key','service_points','title','Servicepunkter','description','Registrera tekniska utrymmen och driftpunkter.','required',false,'href','/entities')
    )
    when 'courier' then jsonb_build_array(
      jsonb_build_object('key','pickup_dropoff','title','Pickup och dropoff','description','Lägg in avsändare, mottagare och adresser.','required',false,'href','/entities'),
      jsonb_build_object('key','vehicles_capacity','title','Fordon och kapacitet','description','Registrera fordon och deras kapacitet.','required',false,'href','/resources'),
      jsonb_build_object('key','time_windows','title','Tidsfönster','description','Sätt leveransfönster för olika leveranstyper.','required',false,'href','/settings/industry'),
      jsonb_build_object('key','returns','title','Returer och leveransstatusar','description','Gå igenom statusflödet för leveranser och returer.','required',false,'href','/settings/industry')
    )
    when 'transport_logistics' then jsonb_build_array(
      jsonb_build_object('key','vehicles_capacity','title','Fordon och kapacitet','description','Registrera fordon, släp och kapacitet.','required',false,'href','/resources'),
      jsonb_build_object('key','time_windows','title','Tidsfönster','description','Sätt tidsfönster för hämtning och leverans.','required',false,'href','/settings/industry')
    )
    when 'construction' then jsonb_build_array(
      jsonb_build_object('key','projects','title','Projekt och arbetsmoment','description','Skapa första projektet och dess moment.','required',false,'href','/projects'),
      jsonb_build_object('key','dependencies','title','Beroenden','description','Definiera vilka moment som måste ske i ordning.','required',false,'href','/projects'),
      jsonb_build_object('key','certificates','title','Certifikat','description','Registrera personalens certifikat och behörigheter.','required',false,'href','/settings/skills'),
      jsonb_build_object('key','machines_material','title','Maskiner och material','description','Registrera maskiner, verktyg och material.','required',false,'href','/resources'),
      jsonb_build_object('key','calculation','title','Kalkyl och efterkalkyl','description','Testa projektkalkyl och uppföljning.','required',false,'href','/projects')
    )
    when 'security' then jsonb_build_array(
      jsonb_build_object('key','patrol_points','title','Rondpunkter och patrullrutter','description','Definiera bevakningsobjekt, rondpunkter och rutter.','required',false,'href','/entities'),
      jsonb_build_object('key','incidents','title','Incidenter','description','Gå igenom hur incidenter rapporteras och följs upp.','required',false,'href','/deviations'),
      jsonb_build_object('key','on_call','title','Jour','description','Sätt upp beredskap och jourflöden.','required',false,'href','/schedule'),
      jsonb_build_object('key','keys_access','title','Nycklar och passerkort','description','Registrera nycklar och passerkort med ansvar.','required',false,'href','/resources')
    )
    when 'staffing' then jsonb_build_array(
      jsonb_build_object('key','customer_sites','title','Kundplatser','description','Registrera platser där pass ska bemannas.','required',false,'href','/entities'),
      jsonb_build_object('key','availability','title','Kandidater och tillgänglighet','description','Lägg in kandidater och deras tillgänglighet.','required',false,'href','/availability'),
      jsonb_build_object('key','skills','title','Kompetenser','description','Registrera kompetenser som kunder kräver.','required',false,'href','/settings/skills'),
      jsonb_build_object('key','work_time_rules','title','Arbetstidsregler och bekräftelser','description','Sätt regler för arbetstid och hur pass bekräftas.','required',false,'href','/settings/industry')
    )
    when 'municipality' then jsonb_build_array(
      jsonb_build_object('key','units','title','Enheter och förvaltningar','description','Skapa team per enhet eller förvaltning.','required',false,'href','/teams'),
      jsonb_build_object('key','areas','title','Områden','description','Definiera geografiska områden och ansvar.','required',false,'href','/settings/industry'),
      jsonb_build_object('key','meal_delivery','title','Måltidsleverans','description','Sätt upp rutter och mottagare för måltidsleverans.','required',false,'href','/entities'),
      jsonb_build_object('key','sla_deviations','title','SLA och avvikelser','description','Bestäm servicenivåer och avvikelsehantering.','required',false,'href','/deviations')
    )
    else '[]'::jsonb
  end;

  -- Extra industry steps are inserted before the finish step.
  return (v_common - (jsonb_array_length(v_common) - 1)::int) || v_extra || jsonb_build_array(v_common->(jsonb_array_length(v_common) - 1));
end;
$$;

-- Seed onboarding templates where none exists yet.
update public.industry_types
set onboarding_template = public.coordiqo_default_onboarding_template(code),
    updated_at = timezone('utc', now())
where onboarding_template = '[]'::jsonb or onboarding_template is null;

-- 4. Entity presets for the new industries ------------------------------------

insert into public.industry_entity_presets (industry_code, entity_code, label_singular, label_plural, description, sort_order) values
  ('transport_logistics', 'customer', 'Kund', 'Kunder', 'Kunder, avsändare och mottagare för transporter.', 10),
  ('transport_logistics', 'terminal', 'Terminal', 'Terminaler', 'Terminaler, lager och omlastningspunkter.', 20),
  ('energy_infrastructure', 'facility', 'Anläggning', 'Anläggningar', 'Stationer, verk, nät och tekniska anläggningar.', 10),
  ('energy_infrastructure', 'metering_point', 'Mätpunkt', 'Mätpunkter', 'Mätare och kontrollpunkter i nätet.', 20),
  ('telecom_it', 'customer_site', 'Kundplats', 'Kundplatser', 'Platser där installationer och service utförs.', 10),
  ('facility_management', 'facility', 'Anläggning', 'Anläggningar', 'Byggnader och anläggningar med serviceansvar.', 10),
  ('facility_management', 'service_point', 'Servicepunkt', 'Servicepunkter', 'Tekniska utrymmen och driftpunkter.', 20),
  ('waste_recycling', 'pickup_site', 'Hämtställe', 'Hämtställen', 'Adresser och platser med kärl eller containrar.', 10),
  ('education', 'school_unit', 'Enhet/skola', 'Enheter och skolor', 'Skolor, förskolor och utbildningsenheter.', 10),
  ('hotel_facility', 'facility', 'Anläggning', 'Anläggningar', 'Hotell och anläggningar med serviceflöden.', 10),
  ('hotel_facility', 'room_area', 'Rum/yta', 'Rum och ytor', 'Rum, våningar och allmänna ytor.', 20),
  ('industrial_maintenance', 'machine', 'Maskin/linje', 'Maskiner och linjer', 'Maskiner, produktionslinjer och utrustning.', 10)
on conflict (industry_code, entity_code) do update set
  label_singular = excluded.label_singular,
  label_plural = excluded.label_plural,
  description = excluded.description,
  sort_order = excluded.sort_order,
  updated_at = timezone('utc', now());

-- 5. Replace the hardcoded industry check constraint with a registry FK -------

-- Guarantee every referenced code exists before validating the FK.
insert into public.industry_types (code, name, name_sv, description, is_active, sort_order)
select distinct irc.industry_code,
  initcap(replace(irc.industry_code, '_', ' ')),
  initcap(replace(irc.industry_code, '_', ' ')),
  'Automatiskt registrerad från befintlig företagskonfiguration.',
  false,
  950
from public.industry_runtime_configs irc
where irc.industry_code is not null
  and not exists (select 1 from public.industry_types it where it.code = irc.industry_code)
on conflict (code) do nothing;

alter table public.industry_runtime_configs drop constraint if exists industry_runtime_configs_industry_check;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'industry_runtime_configs_industry_code_fkey') then
    alter table public.industry_runtime_configs
      add constraint industry_runtime_configs_industry_code_fkey
      foreign key (industry_code) references public.industry_types(code) not valid;
    alter table public.industry_runtime_configs validate constraint industry_runtime_configs_industry_code_fkey;
  end if;
end $$;

-- 6. Registry-driven company defaults -----------------------------------------
-- ensure_company_industry_defaults now reads task/resource types, operational
-- model and terminology from the registry, with the old hardcoded functions as
-- fallback for codes that lack profile data.

create or replace function public.ensure_company_industry_defaults(target_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_industry text;
  v_operational_model text;
  v_profile record;
  v_preset record;
  v_name text;
  v_code text;
  v_task_types text[];
  v_resource_types text[];
  v_terminology jsonb;
  v_statuses jsonb;
  v_planning_rules jsonb;
  v_mobile_actions jsonb;
  v_modules text[] := public.coordiqo_core_module_codes();
begin
  if target_company_id is null then
    return;
  end if;

  select c.industry_type, c.operational_model
    into v_industry, v_operational_model
  from public.companies c
  where c.id = target_company_id;

  v_industry := coalesce(nullif(v_industry, ''), 'other');

  select * into v_profile from public.industry_types it where it.code = v_industry;

  -- Unknown industry code: fall back to the neutral profile so the runtime
  -- config never references a code missing from the registry.
  if v_profile is null then
    v_industry := 'other';
    select * into v_profile from public.industry_types it where it.code = 'other';
  end if;

  -- 'task_based' is a legacy column default that never was a real model.
  if v_operational_model = 'task_based' then
    v_operational_model := null;
  end if;

  v_operational_model := coalesce(
    nullif(v_operational_model, ''),
    v_profile.default_operational_model,
    case when v_industry = 'courier' then 'delivery_based' when v_industry = 'municipality' then 'area_based' else 'route_based' end
  );

  -- Resolve profile lists with fallback to the legacy hardcoded defaults.
  if v_profile.task_types is not null and jsonb_array_length(v_profile.task_types) > 0 then
    select array_agg(t.value) into v_task_types from jsonb_array_elements_text(v_profile.task_types) as t(value);
  else
    v_task_types := public.coordiqo_default_task_types(v_industry);
  end if;

  if v_profile.resource_types is not null and jsonb_array_length(v_profile.resource_types) > 0 then
    select array_agg(t.value) into v_resource_types from jsonb_array_elements_text(v_profile.resource_types) as t(value);
  else
    v_resource_types := public.coordiqo_default_resource_types(v_industry);
  end if;

  v_terminology := coalesce(v_profile.terminology, '{}'::jsonb);
  v_statuses := coalesce(v_profile.statuses, '[]'::jsonb);
  v_planning_rules := coalesce(v_profile.planning_rules, '[]'::jsonb);
  v_mobile_actions := coalesce(v_profile.mobile_actions, '[]'::jsonb);

  insert into public.company_modules (company_id, module_code, status, enabled_at, settings)
  select target_company_id, module_code, 'active', timezone('utc', now()), jsonb_build_object('source','industry_sync')
  from unnest(v_modules) as m(module_code)
  on conflict (company_id, module_code) do update set
    status = 'active',
    enabled_at = coalesce(public.company_modules.enabled_at, excluded.enabled_at),
    updated_at = timezone('utc', now());

  insert into public.company_settings (company_id, active_modules, ui_label_set)
  values (target_company_id, v_modules, v_industry)
  on conflict (company_id) do update set
    active_modules = array(select distinct unnest(coalesce(public.company_settings.active_modules, '{}'::text[]) || excluded.active_modules)),
    ui_label_set = excluded.ui_label_set,
    updated_at = timezone('utc', now());

  insert into public.industry_runtime_configs (
    company_id, industry_code, operational_model,
    terminology, task_statuses, mobile_actions, planning_rules, settings
  )
  values (
    target_company_id, v_industry, v_operational_model,
    v_terminology, v_statuses, v_mobile_actions, v_planning_rules,
    public.coordiqo_runtime_settings(v_industry, v_operational_model)
  )
  on conflict (company_id) do update set
    industry_code = excluded.industry_code,
    operational_model = excluded.operational_model,
    terminology = case
      when public.industry_runtime_configs.terminology = '{}'::jsonb or public.industry_runtime_configs.industry_code <> excluded.industry_code
      then excluded.terminology else public.industry_runtime_configs.terminology end,
    task_statuses = case
      when public.industry_runtime_configs.task_statuses = '[]'::jsonb or public.industry_runtime_configs.industry_code <> excluded.industry_code
      then excluded.task_statuses else public.industry_runtime_configs.task_statuses end,
    mobile_actions = case
      when public.industry_runtime_configs.mobile_actions = '[]'::jsonb or public.industry_runtime_configs.industry_code <> excluded.industry_code
      then excluded.mobile_actions else public.industry_runtime_configs.mobile_actions end,
    planning_rules = case
      when public.industry_runtime_configs.planning_rules = '[]'::jsonb or public.industry_runtime_configs.industry_code <> excluded.industry_code
      then excluded.planning_rules else public.industry_runtime_configs.planning_rules end,
    settings = coalesce(public.industry_runtime_configs.settings, '{}'::jsonb) || excluded.settings,
    updated_at = timezone('utc', now());

  for v_preset in
    select * from public.industry_entity_presets p where p.industry_code = v_industry and p.is_active = true
  loop
    insert into public.entity_types (company_id, code, label_singular, label_plural, description, source, source_preset_id, is_active, sort_order)
    values (target_company_id, v_preset.entity_code, v_preset.label_singular, v_preset.label_plural, v_preset.description, 'industry_preset', v_preset.id, true, v_preset.sort_order)
    on conflict (company_id, code) do update set
      label_singular = excluded.label_singular,
      label_plural = excluded.label_plural,
      description = excluded.description,
      source_preset_id = excluded.source_preset_id,
      is_active = true,
      updated_at = timezone('utc', now());
  end loop;

  -- Companies without industry-specific entity presets still need one generic entity type.
  if not exists (select 1 from public.industry_entity_presets p where p.industry_code = v_industry and p.is_active = true) then
    insert into public.entity_types (company_id, code, label_singular, label_plural, description, source, is_active, sort_order)
    values (
      target_company_id, 'object',
      coalesce(v_terminology->>'entity', 'Objekt'),
      coalesce(v_terminology->>'entities', 'Objekt'),
      'Generellt objekt för verksamhetens arbete.', 'industry_preset', true, 10
    )
    on conflict (company_id, code) do nothing;
  end if;

  foreach v_name in array coalesce(v_task_types, '{}'::text[]) loop
    v_code := replace(public.slugify_text(v_name), '-', '_');
    insert into public.task_types (company_id, code, name, description, is_active)
    values (target_company_id, v_code, v_name, 'Standardtyp från branschprofil ' || v_industry, true)
    on conflict (company_id, code) do update set
      name = excluded.name,
      is_active = true,
      updated_at = timezone('utc', now());
  end loop;

  foreach v_name in array coalesce(v_resource_types, '{}'::text[]) loop
    v_code := replace(public.slugify_text(v_name), '-', '_');
    insert into public.resource_types (company_id, code, name, description, is_active)
    values (target_company_id, v_code, v_name, 'Standardresurs från branschprofil ' || v_industry, true)
    on conflict (company_id, code) do update set
      name = excluded.name,
      is_active = true,
      updated_at = timezone('utc', now());
  end loop;
end;
$$;

grant execute on function public.ensure_company_industry_defaults(uuid) to authenticated;

-- 7. Registry-aware runtime settings ------------------------------------------

create or replace function public.coordiqo_runtime_settings(p_industry text, p_operational_model text)
returns jsonb
language plpgsql
stable
as $$
declare
  v_profile record;
  v_models jsonb;
  v_primary text;
begin
  select * into v_profile from public.industry_types it where it.code = coalesce(p_industry, 'other');

  v_primary := coalesce(
    nullif(p_operational_model, ''),
    case when v_profile is not null then v_profile.default_operational_model else null end,
    'route_based'
  );

  if v_profile is not null and coalesce(array_length(v_profile.allowed_operational_models, 1), 0) > 0 then
    select jsonb_agg(distinct model) into v_models
    from unnest(array[v_primary] || v_profile.allowed_operational_models) as model;
  else
    v_models := jsonb_build_array(v_primary, 'route_based', 'object_based', 'case_based', 'team_based', 'project_based');
  end if;

  return jsonb_build_object(
    'primaryOperationalModel', v_primary,
    'allCoreModulesEnabled', true,
    'isOperationalModelLocked', false,
    'enabledOperationalModels', v_models,
    'note', 'Operational model is a primary planning lens, not a hard lock. The company can still use projects, resources, tasks, routes, operations and mobile flows together.'
  );
end;
$$;

-- 8. RLS: keep registry publicly readable, writes for platform admins ----------
-- industry_types already has a public read policy from the foundation
-- migrations; ensure a strict write policy exists.

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'industry_types' and policyname = 'industry_types_platform_write') then
    create policy industry_types_platform_write on public.industry_types
      for all using (public.is_platform_admin()) with check (public.is_platform_admin());
  end if;
end $$;
