export type IndustryCode =
  | 'home_care'
  | 'healthcare'
  | 'cleaning'
  | 'property'
  | 'construction'
  | 'parking'
  | 'staffing'
  | 'field_service'
  | 'security'
  | 'municipality'
  | 'courier'
  | 'other'

export type OperationalModelCode =
  | 'route_based'
  | 'area_based'
  | 'object_based'
  | 'case_based'
  | 'calendar_based'
  | 'patrol_based'
  | 'team_based'
  | 'project_based'
  | 'delivery_based'
  | 'on_call'

export type IndustryPreset = {
  code: IndustryCode
  label: string
  shortLabel: string
  description: string
  operationalModels: OperationalModelCode[]
  terminology: {
    entity: string
    entities: string
    task: string
    tasks: string
    staff: string
    route: string
    resources: string
  }
  taskTypes: string[]
  resourceTypes: string[]
  statuses: string[]
  planningRules: string[]
  mobileActions: string[]
}

export const INDUSTRY_LABELS: Record<string, string> = {
  home_care: 'Hemtjänst / omsorg',
  healthcare: 'Vård / hemsjukvård',
  cleaning: 'Städ',
  property: 'Fastighet',
  construction: 'Bygg / projekt',
  parking: 'Parkeringsövervakning',
  staffing: 'Bemanning',
  field_service: 'Tekniker / fältservice',
  security: 'Bevakning / patrull',
  municipality: 'Kommunal verksamhet',
  courier: 'Bud / kurir / leverans',
  transport_logistics: 'Transport och logistik',
  energy_infrastructure: 'Energi / VA / infrastruktur',
  telecom_it: 'Telekom / IT-service',
  facility_management: 'Facility management',
  waste_recycling: 'Avfall / återvinning',
  education: 'Skola / utbildning',
  hotel_facility: 'Hotell / anläggningsservice',
  industrial_maintenance: 'Industri / underhåll',
  other: 'Annan verksamhet',
}

export const OPERATIONAL_MODEL_LABELS: Record<string, string> = {
  route_based: 'Ruttbaserad',
  area_based: 'Områdesbaserad',
  object_based: 'Objektbaserad',
  case_based: 'Ärendebaserad',
  calendar_based: 'Kalenderbaserad',
  patrol_based: 'Patrullbaserad',
  team_based: 'Teambaserad',
  project_based: 'Projektbaserad',
  delivery_based: 'Leveransbaserad',
  on_call: 'Jourbaserad',
}

export const INDUSTRY_PRESETS: Record<IndustryCode, IndustryPreset> = {
  home_care: {
    code: 'home_care',
    label: 'Hemtjänst',
    shortLabel: 'Hemtjänst',
    description: 'Besök, kontinuitet, rätt kompetens, nycklar och daglig omsorgsplanering.',
    operationalModels: ['route_based', 'area_based', 'team_based'],
    terminology: { entity: 'Vårdtagare', entities: 'Vårdtagare', task: 'Insats', tasks: 'Insatser', staff: 'Personal', route: 'Rutt', resources: 'Resurser' },
    taskTypes: ['Morgonbesök', 'Lunchbesök', 'Kvällsbesök', 'Tillsyn', 'Läkemedelspåminnelse', 'Dubbelbemanning'],
    resourceTypes: ['Nyckel', 'Passerkort', 'Medicinväska', 'Bil', 'Cykel'],
    statuses: ['Planerad', 'Påbörjad', 'Klar', 'Avvikelse', 'Kunde ej utföras'],
    planningRules: ['Kontinuitet', 'Kompetenskrav', 'Tidsfönster', 'Nyckelansvar', 'Restid'],
    mobileActions: ['Starta besök', 'Markera klart', 'Rapportera avvikelse', 'Kvittera resurs'],
  },
  healthcare: {
    code: 'healthcare',
    label: 'Vård och hemsjukvård',
    shortLabel: 'Vård',
    description: 'Patientbesök, legitimation, medicinsk utrustning och tidsstyrda insatser.',
    operationalModels: ['route_based', 'case_based', 'team_based'],
    terminology: { entity: 'Patient', entities: 'Patienter', task: 'Vårduppdrag', tasks: 'Vårduppdrag', staff: 'Vårdpersonal', route: 'Rutt', resources: 'Utrustning' },
    taskTypes: ['Hembesök', 'Provtagning', 'Omläggning', 'Uppföljning', 'Akutbesök'],
    resourceTypes: ['Medicinsk utrustning', 'Väska', 'Bil', 'Nyckel', 'Passerkort'],
    statuses: ['Planerad', 'Påbörjad', 'Klar', 'Avvikelse', 'Akut'],
    planningRules: ['Legitimation', 'Certifikat', 'Tidsfönster', 'Kontinuitet', 'Resurskrav'],
    mobileActions: ['Starta uppdrag', 'Klarmarkera', 'Rapportera hinder', 'Kvittera resurs'],
  },
  cleaning: {
    code: 'cleaning',
    label: 'Städ',
    shortLabel: 'Städ',
    description: 'Objekt, checklistor, återkommande städ, nycklar och maskiner.',
    operationalModels: ['route_based', 'object_based', 'team_based'],
    terminology: { entity: 'Städobjekt', entities: 'Städobjekt', task: 'Städuppdrag', tasks: 'Städuppdrag', staff: 'Personal', route: 'Rutt', resources: 'Resurser' },
    taskTypes: ['Kontorsstäd', 'Trappstäd', 'Flyttstäd', 'Byggstäd', 'Fönsterputs'],
    resourceTypes: ['Nyckel', 'Passerkort', 'Städmaskin', 'Bil', 'Cykel', 'Material'],
    statuses: ['Planerad', 'Påbörjad', 'Klar', 'Avvikelse'],
    planningRules: ['Objektkrav', 'Material', 'Restid', 'Återkommande schema'],
    mobileActions: ['Starta städ', 'Klar', 'Rapportera problem', 'Kvittera resurs'],
  },
  property: {
    code: 'property',
    label: 'Fastighet och hyresvärd',
    shortLabel: 'Fastighet',
    description: 'Fastigheter, felanmälan, nycklar, servicepunkter och driftteam.',
    operationalModels: ['object_based', 'case_based', 'route_based'],
    terminology: { entity: 'Objekt', entities: 'Objekt', task: 'Ärende', tasks: 'Ärenden', staff: 'Personal', route: 'Rutt', resources: 'Resurser' },
    taskTypes: ['Felanmälan', 'Besiktning', 'Låsbyte', 'Driftkontroll', 'Underhåll'],
    resourceTypes: ['Nyckel', 'Passerkort', 'Servicebil', 'Verktyg', 'Maskin'],
    statuses: ['Öppen', 'Tilldelad', 'Pågår', 'Klar', 'Blockerad'],
    planningRules: ['SLA', 'Nyckelansvar', 'Kompetens', 'Område'],
    mobileActions: ['Starta ärende', 'Klar', 'Rapportera hinder', 'Kvittera resurs'],
  },
  construction: {
    code: 'construction',
    label: 'Bygg',
    shortLabel: 'Bygg',
    description: 'Projekt, arbetsmoment, maskiner, team och certifikat.',
    operationalModels: ['project_based', 'team_based', 'object_based'],
    terminology: { entity: 'Arbetsplats', entities: 'Arbetsplatser', task: 'Moment', tasks: 'Moment', staff: 'Personal', route: 'Arbetsplan', resources: 'Maskiner/verktyg' },
    taskTypes: ['Rivning', 'Snickeri', 'El', 'VVS', 'Målning', 'Besiktning'],
    resourceTypes: ['Borrmaskin', 'Maskin', 'Servicebil', 'Verktygsväska', 'Lift', 'Material'],
    statuses: ['Planerad', 'Pågår', 'Klar', 'Blockerad', 'Avvikelse'],
    planningRules: ['Certifikat', 'Beroenden', 'Maskinkrav', 'Teamkapacitet'],
    mobileActions: ['Starta moment', 'Klart', 'Rapportera hinder', 'Kvittera maskin'],
  },
  parking: {
    code: 'parking',
    label: 'Parkeringsövervakning',
    shortLabel: 'Parkering',
    description: 'Zoner, patruller, kontrollpunkter och incidenter.',
    operationalModels: ['patrol_based', 'route_based', 'area_based'],
    terminology: { entity: 'Zon', entities: 'Zoner', task: 'Kontroll', tasks: 'Kontroller', staff: 'Patrull', route: 'Patrullrutt', resources: 'Resurser' },
    taskTypes: ['Zonkontroll', 'Incident', 'Rond', 'Uppföljning'],
    resourceTypes: ['Bil', 'Handdator', 'Cykel', 'Kamera', 'Passerkort'],
    statuses: ['Planerad', 'Pågår', 'Klar', 'Avvikelse'],
    planningRules: ['Zon', 'Patrullfrekvens', 'Restid', 'Prioritet'],
    mobileActions: ['Starta kontroll', 'Klar', 'Rapportera incident', 'Kvittera resurs'],
  },
  staffing: {
    code: 'staffing',
    label: 'Bemanning',
    shortLabel: 'Bemanning',
    description: 'Kundplatser, pass, kandidater och tillgänglighet.',
    operationalModels: ['calendar_based', 'team_based', 'case_based'],
    terminology: { entity: 'Kundplats', entities: 'Kundplatser', task: 'Pass', tasks: 'Pass', staff: 'Kandidat', route: 'Plan', resources: 'Resurser' },
    taskTypes: ['Dagpass', 'Kvällspass', 'Nattpass', 'Akut bemanning'],
    resourceTypes: ['Passerkort', 'Kläder', 'Utrustning', 'Bil'],
    statuses: ['Öppen', 'Tilldelad', 'Bekräftad', 'Klar', 'Avvikelse'],
    planningRules: ['Tillgänglighet', 'Kompetens', 'Arbetstid', 'Kundkrav'],
    mobileActions: ['Bekräfta pass', 'Checka in', 'Checka ut', 'Rapportera avvikelse'],
  },
  field_service: {
    code: 'field_service',
    label: 'Tekniker och service',
    shortLabel: 'Service',
    description: 'Serviceorder, SLA, tekniker, reservdelar och fordon.',
    operationalModels: ['route_based', 'case_based', 'object_based'],
    terminology: { entity: 'Servicepunkt', entities: 'Servicepunkter', task: 'Serviceorder', tasks: 'Serviceorder', staff: 'Tekniker', route: 'Rutt', resources: 'Resurser' },
    taskTypes: ['Installation', 'Felsökning', 'Servicebesök', 'Akutjobb', 'Uppföljning'],
    resourceTypes: ['Servicebil', 'Verktygsväska', 'Reservdel', 'Handdator', 'Nyckel'],
    statuses: ['Planerad', 'På väg', 'Pågår', 'Klar', 'Kunde ej utföras'],
    planningRules: ['SLA', 'Kompetens', 'Reservdelar', 'Restid'],
    mobileActions: ['På väg', 'Starta jobb', 'Klart', 'Rapportera hinder'],
  },
  security: {
    code: 'security',
    label: 'Bevakning',
    shortLabel: 'Bevakning',
    description: 'Patruller, rondpunkter, incidenter och jour.',
    operationalModels: ['patrol_based', 'route_based', 'on_call'],
    terminology: { entity: 'Bevakningsobjekt', entities: 'Bevakningsobjekt', task: 'Rond/uppdrag', tasks: 'Ronder/uppdrag', staff: 'Väktare', route: 'Patrullrutt', resources: 'Resurser' },
    taskTypes: ['Rond', 'Larmutryckning', 'Öppning', 'Stängning', 'Incident'],
    resourceTypes: ['Bil', 'Nyckel', 'Passerkort', 'Radio', 'Larmtagg'],
    statuses: ['Planerad', 'Påbörjad', 'Klar', 'Incident', 'Avvikelse'],
    planningRules: ['Rondfrekvens', 'Behörighet', 'Nyckelansvar', 'Jour'],
    mobileActions: ['Starta rond', 'Markera punkt klar', 'Rapportera incident', 'Kvittera resurs'],
  },
  municipality: {
    code: 'municipality',
    label: 'Kommunal verksamhet',
    shortLabel: 'Kommun',
    description: 'Kommunal drift med enheter, områden, måltidsleverans, LSS, fastighet, park och intern service.',
    operationalModels: ['area_based', 'route_based', 'case_based', 'team_based'],
    terminology: { entity: 'Mottagare/objekt', entities: 'Mottagare och objekt', task: 'Kommunuppdrag', tasks: 'Kommunuppdrag', staff: 'Utförare', route: 'Rutt/område', resources: 'Kommunresurser' },
    taskTypes: ['Måltidsleverans', 'Tillsynsbesök', 'Intern transport', 'Fastighetsservice', 'Park/drift', 'LSS-insats', 'Skoltransport'],
    resourceTypes: ['Kommunbil', 'Cykel', 'Nyckel', 'Passerkort', 'Matlåda/kylbox', 'Verktyg', 'Maskin'],
    statuses: ['Planerad', 'Tilldelad', 'Påbörjad', 'Klar', 'Hinder', 'Avvikelse'],
    planningRules: ['Enhet', 'Område', 'Tidsfönster', 'Fordon', 'Behörighet', 'Resursansvar'],
    mobileActions: ['Påbörja uppdrag', 'Slutför uppdrag', 'Rapportera hinder', 'Kvittera resurs'],
  },
  courier: {
    code: 'courier',
    label: 'Bud och kurir',
    shortLabel: 'Bud/Kurir',
    description: 'Pickup, dropoff, multi-stop routes, fordon, tidsfönster, kapacitet och leveransavvikelser.',
    operationalModels: ['delivery_based', 'route_based', 'area_based'],
    terminology: { entity: 'Mottagare/kund', entities: 'Mottagare och kunder', task: 'Leverans', tasks: 'Leveranser', staff: 'Bud', route: 'Leveransrutt', resources: 'Fordon/utrustning' },
    taskTypes: ['Pickup', 'Delivery', 'Pickup + dropoff', 'Retur', 'Express', 'Multi-stop route', 'Schemalagd leverans'],
    resourceTypes: ['Bil', 'Cykel', 'Elscooter', 'Budväska', 'Kylbox', 'Handscanner', 'Lastbil'],
    statuses: ['Planerad', 'Tilldelad', 'Hämtad', 'På väg', 'Levererad', 'Misslyckad', 'Returnerad'],
    planningRules: ['Pickup/dropoff', 'Tidsfönster', 'Fordonstyp', 'Kapacitet', 'Prioritet', 'Ruttordning'],
    mobileActions: ['Hämtat paket', 'På väg', 'Levererat', 'Kunde ej leverera', 'Rapportera avvikelse'],
  },
  other: {
    code: 'other',
    label: 'Annan verksamhet',
    shortLabel: 'Annan',
    description: 'Flexibel branschneutral modell för uppdrag, rutter, resurser och personal.',
    operationalModels: ['route_based', 'case_based', 'team_based'],
    terminology: { entity: 'Objekt', entities: 'Objekt', task: 'Uppdrag', tasks: 'Uppdrag', staff: 'Personal', route: 'Rutt', resources: 'Resurser' },
    taskTypes: ['Besök', 'Service', 'Kontroll', 'Leverans', 'Projektmoment'],
    resourceTypes: ['Bil', 'Cykel', 'Nyckel', 'Verktyg', 'Utrustning'],
    statuses: ['Planerad', 'Pågår', 'Klar', 'Avvikelse'],
    planningRules: ['Tidsfönster', 'Kompetens', 'Resurser', 'Restid'],
    mobileActions: ['Starta', 'Klar', 'Rapportera problem', 'Kvittera resurs'],
  },
}


export const COMPANY_CORE_MODULES = [
  'foundation',
  'industry_engine',
  'industry_runtime',
  'entities',
  'tasks',
  'planning',
  'planning_core',
  'ai_planning_assistant',
  'planning_templates',
  'project_planning',
  'resources',
  'resource_responsibility',
  'operations',
  'routes',
  'mobile_staff',
  'availability_engine',
  'rules_engine',
  'audit_control',
  'document_storage',
] as const

export const OPERATIONAL_MODEL_HELP: Record<OperationalModelCode, string> = {
  route_based: 'För bolag där arbetsdagen körs som rutter mellan flera stopp.',
  area_based: 'För bolag som planerar efter område, distrikt eller kommunal enhet.',
  object_based: 'För bolag där objekt, kunder, patienter, fastigheter eller platser är huvudingången.',
  case_based: 'För ärenden, serviceorder och uppdrag som styrs av status och prioritet.',
  calendar_based: 'För pass, schema och bemanning där kalendern är viktigast.',
  patrol_based: 'För rond, patrull, bevakning och återkommande kontrollpunkter.',
  team_based: 'För verksamheter där teamkapacitet och gemensamma pass styr dagen.',
  project_based: 'För projekt, arbetsmoment, kalkyl och längre jobb med flera steg.',
  delivery_based: 'För pickup, dropoff, leveranser och multi-stop-flöden.',
  on_call: 'För jour, akuta uppdrag och snabb omplanering.',
}

export function uniqueOperationalModels(primary: string | null | undefined, presetModels: readonly OperationalModelCode[]) {
  const models = new Set<OperationalModelCode>()
  if (primary && primary in OPERATIONAL_MODEL_LABELS) models.add(primary as OperationalModelCode)
  for (const model of presetModels) models.add(model)
  return Array.from(models)
}

export function allCompanyCoreModules() {
  return [...COMPANY_CORE_MODULES]
}

export const CORE_MODULES = [
  { code: 'foundation', label: 'Plattformsgrund', description: 'Inloggning, företag, roller, team och företagsisolering.' },
  { code: 'industry_engine', label: 'Branschmotor', description: 'Styr språk, navigation, moduler och objektpresets per företag.' },
  { code: 'resources', label: 'Personal och resurser', description: 'Personalprofiler, fordon, utrustning och organisation.' },
  { code: 'entities', label: 'Objektregister', description: 'Flexibel modell för kunder, platser, fastigheter, patienter och andra objekt.' },
  { code: 'tasks', label: 'Uppdrag och arbetsorder', description: 'Ärenden, besök, arbetsorder och statusflöden.' },
  { code: 'planning', label: 'Planering', description: 'Tilldelning, dagplan och senare optimering.' },
  { code: 'operations', label: 'Operationsvy', description: 'Daglig kontrollpanel, status och avvikelser.' },
  { code: 'routes', label: 'Rutter och leveranser', description: 'Ruttordning, stopp, pickup/dropoff och restidsunderlag.' },
  { code: 'mobile_staff', label: 'Mobil personalvy', description: 'Dagens rutt, check-in/out och utförande i fält.' },
]

export function getIndustryLabel(code: string | null | undefined) {
  if (!code) return 'Bransch ej vald'
  if (INDUSTRY_LABELS[code]) return INDUSTRY_LABELS[code]
  // Unknown (registry-defined) codes: show a readable label instead of the raw code.
  const pretty = code.replace(/_/g, ' ')
  return pretty.charAt(0).toUpperCase() + pretty.slice(1)
}

export function getOperationalModelLabel(code: string | null | undefined) {
  if (!code) return 'Operativ modell ej vald'
  return OPERATIONAL_MODEL_LABELS[code] ?? code
}

export function getIndustryPreset(code: string | null | undefined) {
  return INDUSTRY_PRESETS[(code as IndustryCode) ?? 'other'] ?? INDUSTRY_PRESETS.other
}
