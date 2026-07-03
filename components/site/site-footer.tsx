import Link from 'next/link'

import { getSupportEmail } from '@/lib/config/emails'

const legalLinks = [
  { href: '/integritetspolicy', label: 'Integritetspolicy' },
  { href: '/villkor', label: 'Villkor' },
  { href: '/personuppgiftsbitrade', label: 'Personuppgiftsbiträde' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/sakerhet', label: 'Säkerhet' },
]

export function SiteFooter() {
  const supportEmail = getSupportEmail()

  return (
    <footer className="rounded-3xl border border-slate-200 bg-white px-6 py-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-xs font-bold text-white">Cq</div>
            <p className="font-semibold text-slate-950">Coordiqo</p>
          </div>
          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-600">
            Planering, personal och resurser i ett system — anpassat efter din bransch.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-950">Juridik och trygghet</p>
          <ul className="mt-3 space-y-2">
            {legalLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-sm text-slate-600 transition hover:text-slate-950">{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-950">Kontakt</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li><a href={`mailto:${supportEmail}`} className="transition hover:text-slate-950">{supportEmail}</a></li>
            <li><Link href="/book-demo" className="transition hover:text-slate-950">Boka demo</Link></li>
            <li><Link href="/login" className="transition hover:text-slate-950">Logga in</Link></li>
          </ul>
        </div>
      </div>
      <p className="mt-8 border-t border-slate-100 pt-4 text-xs text-slate-400">© {new Date().getFullYear()} Coordiqo. Alla rättigheter förbehållna.</p>
    </footer>
  )
}
