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
}

function datetimeLocal(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function TaskForm({ action, task, taskTypes, entities, teams, staff, workOrders = [], submitLabel }: TaskFormProps) {
  return (
    <form action={action} className="grid gap-5">
      {task?.id ? <input type="hidden" name="id" value={task.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Titel">
          <input name="title" required defaultValue={task?.title ?? ''} className={inputClassName} placeholder="Ex. Besök, service, kontroll" />
        </Field>
        <Field label="Uppdragstyp">
          <select name="task_type_id" defaultValue={task?.task_type_id ?? ''} className={selectClassName}>
            <option value="">Ingen särskild typ</option>
            {taskTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Status">
          <select name="status" defaultValue={task?.status ?? 'unscheduled'} className={selectClassName}>
            <option value="unscheduled">Oschemalagt</option>
            <option value="scheduled">Schemalagt</option>
            <option value="assigned">Tilldelat</option>
            <option value="in_progress">Pågår</option>
            <option value="blocked">Blockerat</option>
            <option value="completed">Klart</option>
            <option value="cancelled">Avbrutet</option>
          </select>
        </Field>
        <Field label="Prioritet">
          <select name="priority" defaultValue={task?.priority ?? 'normal'} className={selectClassName}>
            <option value="low">Låg</option>
            <option value="normal">Normal</option>
            <option value="high">Hög</option>
            <option value="urgent">Akut</option>
          </select>
        </Field>
        <Field label="Estimerad tid, minuter">
          <input name="estimated_duration_minutes" type="number" min="1" defaultValue={task?.estimated_duration_minutes ?? 60} className={inputClassName} />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Objekt/kund/plats">
          <select name="entity_id" defaultValue={task?.entity_id ?? ''} className={selectClassName}>
            <option value="">Inget objekt</option>
            {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
          </select>
        </Field>
        <Field label="Arbetsorder">
          <select name="work_order_id" defaultValue={task?.work_order_id ?? ''} className={selectClassName}>
            <option value="">Ingen arbetsorder</option>
            {workOrders.map((order) => <option key={order.id} value={order.id}>{order.title ?? order.name}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Tilldelat team">
          <select name="assigned_team_id" defaultValue={task?.assigned_team_id ?? ''} className={selectClassName}>
            <option value="">Ej tilldelat team</option>
            {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </Field>
        <Field label="Tilldelad person">
          <select name="assigned_staff_id" defaultValue={task?.assigned_staff_id ?? ''} className={selectClassName}>
            <option value="">Ej tilldelad person</option>
            {staff.map((person) => <option key={person.id} value={person.id}>{person.full_name ?? person.name}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Tidsfönster start">
          <input name="time_window_start" type="datetime-local" defaultValue={datetimeLocal(task?.time_window_start)} className={inputClassName} />
        </Field>
        <Field label="Tidsfönster slut">
          <input name="time_window_end" type="datetime-local" defaultValue={datetimeLocal(task?.time_window_end)} className={inputClassName} />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Schemalagd start">
          <input name="scheduled_start" type="datetime-local" defaultValue={datetimeLocal(task?.scheduled_start)} className={inputClassName} />
        </Field>
        <Field label="Schemalagd slut">
          <input name="scheduled_end" type="datetime-local" defaultValue={datetimeLocal(task?.scheduled_end)} className={inputClassName} />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="SLA / senast klar">
          <input name="sla_due_at" type="datetime-local" defaultValue={datetimeLocal(task?.sla_due_at)} className={inputClassName} />
        </Field>
        <Field label="Återkommande regel" hint="Förberett för senare scheduler, ex. FREQ=WEEKLY;BYDAY=MO.">
          <input name="recurrence_rule" defaultValue={task?.recurrence_rule ?? ''} className={inputClassName} placeholder="RRULE senare" />
        </Field>
      </div>

      <Field label="Beskrivning">
        <textarea name="description" defaultValue={task?.description ?? ''} className={textareaClassName} />
      </Field>
      <Field label="Instruktioner till utförare">
        <textarea name="instructions" defaultValue={task?.instructions ?? ''} className={textareaClassName} />
      </Field>

      <button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
        {submitLabel}
      </button>
    </form>
  )
}
