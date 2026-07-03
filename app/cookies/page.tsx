import { LegalPage } from '@/components/site/legal-page'
import { getLegalEmail } from '@/lib/config/emails'

export const metadata = { title: 'Cookies – Coordiqo' }

export default function CookiesPage() {
  const legalEmail = getLegalEmail()

  return (
    <LegalPage title="Cookies" updated="juli 2026">
      <section>
        <h2>Vilka cookies vi använder</h2>
        <p>
          Coordiqo använder endast nödvändiga cookies. De behövs för inloggning och för att hålla din session säker.
          Utan dem fungerar inte tjänsten.
        </p>
      </section>
      <section>
        <h2>Inga spårningscookies</h2>
        <p>
          Vi använder inga cookies för marknadsföring, annonsering eller spårning över andra webbplatser. Vi använder
          inte heller tredjeparts-analyscookies på webbplatsen.
        </p>
      </section>
      <section>
        <h2>Frågor</h2>
        <p>Kontakta oss på <a href={`mailto:${legalEmail}`} className="font-semibold underline underline-offset-2">{legalEmail}</a> om du har frågor om cookies.</p>
      </section>
    </LegalPage>
  )
}
