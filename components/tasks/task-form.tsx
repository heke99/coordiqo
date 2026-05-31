import { Field, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'

type Option = { id: string; name?: string; full_name?: string; label_singular?: string; title?: string; code?: string }

type TaskFormProps = {
  action: (formData: FormData) => void | Promise<void>
  task?: any
  taskTypes: Option[]
  entities: Option[]
  teams: Option[]
  staff: Option[]
  workOrders?: Option[]
  submitLabel: string
  industryType?: string | null
}

function datetimeLocal(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function taskCopy(industryType?: string | null) {
  switch (industryType) {
    case 'home_care':
      return {
        title: 'Insats/besök',
        titlePlaceholder: 'Ex. Morgonbesök, dusch, läkemedelspåminnelse',
        entityLabel: 'Vårdtagare/patient',
        instructions: 'Instruktioner till personal',
        description: 'Omsorgsbeskrivning',
        durationHint: 'Hemtjänst arbetar ofta i minuter, men du kan växla till timmar vid längre insatser.',
      }
    case 'property':
      return {
        title: 'Felanmälan/åtgärd',
        titlePlaceholder: 'Ex. Vattenläcka, låsbyte, besiktning',
        entityLabel: 'Fastighet/lägenhet/hyresgäst',
        instructions: 'Access, nycklar och utförarinstruktioner',
        description: 'Ärendebeskrivning',
        durationHint: 'Fastighetsuppdrag kan planeras i minuter eller timmar beroende på åtgärd.',
      }
    case 'cleaning':
      return {
        title: 'Städuppdrag',
        titlePlaceholder: 'Ex. Veckostäd, flyttstäd, trappstädning',
        entityLabel: 'Städobjekt/kund',
        instructions: 'Checklistor och kundinstruktioner',
        description: 'Uppdragsbeskrivning',
        durationHint: 'Städ kan anges i timmar för större objekt eller minuter för korta stopp.',
      }
    case 'municipality':
      return {
        title: 'Kommunuppdrag',
        titlePlaceholder: 'Ex. Måltidsleverans, intern transport, fastighetsservice',
        entityLabel: 'Mottagare/objekt/enhet',
        instructions: 'Instruktioner, access, kontaktväg och kommunal enhet',
        description: 'Uppdragsbeskrivning',
        durationHint: 'Kommunala uppdrag styrs ofta av område, enhet, tidsfönster och resurser.',
      }
    case 'courier':
      return {
        title: 'Leverans',
        titlePlaceholder: 'Ex. Pickup + dropoff, expressleverans, retur',
        entityLabel: 'Kund/mottagare',
        instructions: 'Leveransinstruktioner, portkod, kontakt och mottagarkrav',
        description: 'Leveransbeskrivning',
        durationHint: 'Bud/kurir använder pickup, dropoff, tidsfönster, fordon och kapacitet.',
      }
    case 'field_service':
      return {
        title: 'Serviceuppdrag',
        titlePlaceholder: 'Ex. Installation, felsökning, servicebesök',
        entityLabel: 'Servicepunkt/kund/anläggning',
        instructions: 'Tekniska instruktioner',
        description: 'Servicebeskrivning',
        durationHint: 'Serviceuppdrag kan anges i timmar vid längre teknikerjobb.',
      }
    default:
      return {
        title: 'Titel',
        titlePlaceholder: 'Ex. Besök, service, kontroll',
        entityLabel: 'Objekt/kund/plats',
        instructions: 'Instruktioner till utförare',
        description: 'Beskrivning',
        durationHint: 'Välj minuter eller timmar. Systemet sparar alltid minuter bakom kulisserna.',
      }
  }
}

export function TaskForm({ action, task, taskTypes, entities, teams, staff, workOrders = [], submitLabel, industryType }: TaskFormProps) {
  const copy = taskCopy(industryType)
  const savedMinutes = Number(task?.estimated_duration_minutes ?? 60)
  const defaultUnit = savedMinutes >= 120 && savedMinutes % 60 === 0 ? 'hours' : 'minutes'
  const defaultDurationValue = defaultUnit === 'hours' ? savedMinutes / 60 : savedMinutes

  return (
    <form action={action} className="grid gap-5">
      {task?.id ? <input type="hidden" name="id" value={task.id} /> : null}
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-950">Branschstyrda uppdragsuppgifter</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">Formuläret använder samma task-tabell men ändrar språk och prioriterade fält efter bransch. Nästa planeringsbatch kan bygga regler ovanpå detta.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label={copy.title}>
          <input name="title" required defaultValue={task?.title ?? ''} className={inputClassName} placeholder={copy.titlePlaceholder} />
        </Field>
        <Field label="Uppdragstyp">
          <select name="task_type_id" defaultValue={task?.task_type_id ?? ''} className={selectClassName}>
            <option value="">Ingen särskild typ</option>
            {taskTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Field label="Status"><select name="status" defaultValue={task?.status ?? 'unscheduled'} className={selectClassName}><option value="unscheduled">Oschemalagt</option><option value="scheduled">Schemalagt</option><option value="assigned">Tilldelat</option><option value="in_progress">Pågår</option><option value="blocked">Blockerat</option><option value="completed">Klart</option><option value="cancelled">Avbrutet</option></select></Field>
        <Field label="Prioritet"><select name="priority" defaultValue={task?.priority ?? 'normal'} className={selectClassName}><option value="low">Låg</option><option value="normal">Normal</option><option value="high">Hög</option><option value="urgent">Akut</option></select></Field>
        <Field label="Tid"><input name="duration_value" type="number" min="1" step="0.25" defaultValue={defaultDurationValue} className={inputClassName} /></Field>
        <Field label="Enhet"><select name="duration_unit" defaultValue={defaultUnit} className={selectClassName}><option value="minutes">Minuter</option><option value="hours">Timmar</option></select></Field>
      </div>
      <p className="-mt-3 text-xs text-slate-500">{copy.durationHint}</p>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label={copy.entityLabel}><select name="entity_id" defaultValue={task?.entity_id ?? ''} className={selectClassName}><option value="">Inget objekt</option>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></Field>
        <Field label="Arbetsorder"><select name="work_order_id" defaultValue={task?.work_order_id ?? ''} className={selectClassName}><option value="">Ingen arbetsorder</option>{workOrders.map((order) => <option key={order.id} value={order.id}>{order.title ?? order.name}</option>)}</select></Field>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-950">Kart- och routingunderlag</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">Koordinater används av operationskartan, restidsberäkning och ruttoptimering. Om uppdraget saknar koordinater försöker systemet använda objektets huvudadress.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="Platslabel"><input name="location_label" defaultValue={task?.location_label ?? ''} className={inputClassName} placeholder="Ex. Kundens entré, lastkaj, port A" /></Field>
          <Field label="Latitud"><input name="location_latitude" type="number" step="0.0000001" defaultValue={task?.location_latitude ?? ''} className={inputClassName} placeholder="55.60498" /></Field>
          <Field label="Longitud"><input name="location_longitude" type="number" step="0.0000001" defaultValue={task?.location_longitude ?? ''} className={inputClassName} placeholder="13.00382" /></Field>
        </div>
      </div>


      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Tilldelat team"><select name="assigned_team_id" defaultValue={task?.assigned_team_id ?? ''} className={selectClassName}><option value="">Ej tilldelat team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field>
        <Field label="Tilldelad person"><select name="assigned_staff_id" defaultValue={task?.assigned_staff_id ?? ''} className={selectClassName}><option value="">Ej tilldelad person</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.full_name ?? person.name}</option>)}</select></Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2"><Field label="Tidsfönster start"><input name="time_window_start" type="datetime-local" defaultValue={datetimeLocal(task?.time_window_start)} className={inputClassName} /></Field><Field label="Tidsfönster slut"><input name="time_window_end" type="datetime-local" defaultValue={datetimeLocal(task?.time_window_end)} className={inputClassName} /></Field></div>
      <div className="grid gap-4 md:grid-cols-2"><Field label="Schemalagd start"><input name="scheduled_start" type="datetime-local" defaultValue={datetimeLocal(task?.scheduled_start)} className={inputClassName} /></Field><Field label="Schemalagd slut"><input name="scheduled_end" type="datetime-local" defaultValue={datetimeLocal(task?.scheduled_end)} className={inputClassName} /></Field></div>
      <div className="grid gap-4 md:grid-cols-2"><Field label="SLA / senast klar"><input name="sla_due_at" type="datetime-local" defaultValue={datetimeLocal(task?.sla_due_at)} className={inputClassName} /></Field><Field label="Återkommande regel" hint="Förberett för senare scheduler, ex. FREQ=WEEKLY;BYDAY=MO."><input name="recurrence_rule" defaultValue={task?.recurrence_rule ?? ''} className={inputClassName} placeholder="RRULE senare" /></Field></div>

      {industryType === 'courier' ? (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-950">Bud/Kurir-fält</p>
          <p className="mt-1 text-xs text-slate-500">Sparas i uppdragets metadata och används i operationsvyn/ruttmotorn.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Pickup-adress"><input name="cf_pickup_address" defaultValue={task?.custom_fields?.pickup_address ?? ''} className={inputClassName} placeholder="Lager, butik eller avsändare" /></Field>
            <Field label="Dropoff-adress"><input name="cf_dropoff_address" defaultValue={task?.custom_fields?.dropoff_address ?? ''} className={inputClassName} placeholder="Mottagare / leveransadress" /></Field>
            <Field label="Paket/antal"><input name="cf_package_count" type="number" min="0" defaultValue={task?.custom_fields?.package_count ?? ''} className={inputClassName} /></Field>
            <Field label="Vikt kg"><input name="cf_weight_kg" type="number" min="0" step="0.1" defaultValue={task?.custom_fields?.weight_kg ?? ''} className={inputClassName} /></Field>
            <Field label="Fordonstyp"><input name="cf_vehicle_type" defaultValue={task?.custom_fields?.vehicle_type ?? ''} className={inputClassName} placeholder="Bil, cykel, kylbil, lastbil" /></Field>
            <Field label="Leveransreferens"><input name="cf_delivery_reference" defaultValue={task?.custom_fields?.delivery_reference ?? ''} className={inputClassName} /></Field>
          </div>
        </div>
      ) : null}

      {industryType === 'municipality' ? (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-950">Kommun-fält</p>
          <p className="mt-1 text-xs text-slate-500">Sparas i uppdragets metadata och används i operationsvyn/områdesplanering.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Enhet/förvaltning"><input name="cf_municipal_unit" defaultValue={task?.custom_fields?.municipal_unit ?? ''} className={inputClassName} placeholder="Ex. LSS, Park, Måltid, Fastighet" /></Field>
            <Field label="Område/distrikt"><input name="cf_area_label" defaultValue={task?.custom_fields?.area_label ?? ''} className={inputClassName} placeholder="Ex. Nord, Centrum, Område A" /></Field>
            <Field label="Servicekategori"><input name="cf_service_category" defaultValue={task?.custom_fields?.service_category ?? ''} className={inputClassName} placeholder="Måltidsleverans, intern service, tillsyn" /></Field>
            <Field label="Kräver två personal"><select name="cf_requires_two_staff" defaultValue={task?.custom_fields?.requires_two_staff ?? ''} className={selectClassName}><option value="">Ej valt</option><option value="true">Ja</option><option value="false">Nej</option></select></Field>
          </div>
        </div>
      ) : null}

      <Field label={copy.description}><textarea name="description" defaultValue={task?.description ?? ''} className={textareaClassName} /></Field>
      <Field label={copy.instructions}><textarea name="instructions" defaultValue={task?.instructions ?? ''} className={textareaClassName} /></Field>

      <button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">{submitLabel}</button>
    </form>
  )
}
