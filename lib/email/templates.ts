import { getCompanyName, getSupportEmail } from '@/lib/config/emails'

/**
 * Swedish plain-text email templates. All templates are safe to send to
 * customers: no internal/system terminology, no technical identifiers.
 */

type DemoReceivedInput = { contactName: string; language?: string | null }

export function demoRequestReceivedEmail({ contactName, language }: DemoReceivedInput) {
  if (language === 'en') {
    return {
      subject: `We received your ${getCompanyName()} demo request`,
      bodyText: [
        `Hi ${contactName},`,
        '',
        `Thanks for your interest in ${getCompanyName()}. We will contact you shortly to understand your business, show the right industry flow and help you set up a pilot.`,
        '',
        'Best regards,',
        `The ${getCompanyName()} team`,
      ].join('\n'),
    }
  }

  return {
    subject: 'Vi har tagit emot din demoansökan',
    bodyText: [
      `Hej ${contactName},`,
      '',
      `Tack för ditt intresse för ${getCompanyName()}. Vi återkommer inom kort för att förstå er verksamhet, visa rätt branschflöde och hjälpa er sätta upp en pilot.`,
      '',
      'Vänliga hälsningar,',
      `${getCompanyName()}-teamet`,
    ].join('\n'),
  }
}

type InternalLeadInput = {
  companyName: string
  orgNumber?: string | null
  contactName: string
  email: string
  phone?: string | null
  industryLabel?: string | null
  employeeCount?: string | null
  weeklyJobs?: string | null
  needs: string[]
  language: string
  message?: string | null
}

export function internalNewLeadEmail(input: InternalLeadInput) {
  return {
    subject: `Ny demoansökan: ${input.companyName}`,
    bodyText: [
      'Ny demoansökan i Coordiqo',
      '',
      `Företag: ${input.companyName}`,
      `Org.nr: ${input.orgNumber ?? '-'}`,
      `Kontakt: ${input.contactName}`,
      `E-post: ${input.email}`,
      `Telefon: ${input.phone ?? '-'}`,
      `Bransch: ${input.industryLabel ?? '-'}`,
      `Antal anställda: ${input.employeeCount ?? '-'}`,
      `Uppdrag/vecka: ${input.weeklyJobs ?? '-'}`,
      `Behov: ${input.needs.join(', ') || '-'}`,
      `Språk: ${input.language}`,
      '',
      input.message ? `Meddelande: ${input.message}` : 'Meddelande: -',
    ].join('\n'),
  }
}

type CompanyCreatedInput = { companyName: string; contactName: string }

export function companyCreatedEmail({ companyName, contactName }: CompanyCreatedInput) {
  return {
    subject: `Er ${getCompanyName()}-miljö är skapad`,
    bodyText: [
      `Hej ${contactName},`,
      '',
      `Er företagsmiljö för ${companyName} är nu skapad i ${getCompanyName()}.`,
      'Nästa steg är att er första administratör loggar in, byter lösenord och slutför onboarding — vi guidar er genom stegen.',
      '',
      `Har ni frågor? Kontakta oss på ${getSupportEmail()}.`,
      '',
      'Vänliga hälsningar,',
      `${getCompanyName()}-teamet`,
    ].join('\n'),
  }
}

type FirstAdminInviteInput = { companyName: string; fullName: string; loginUrl: string }

export function firstAdminInviteEmail({ companyName, fullName, loginUrl }: FirstAdminInviteInput) {
  return {
    subject: `Välkommen till ${getCompanyName()} — ditt administratörskonto för ${companyName}`,
    bodyText: [
      `Hej ${fullName},`,
      '',
      `Du har fått ett administratörskonto för ${companyName} i ${getCompanyName()}.`,
      '',
      `1. Logga in: ${loginUrl}`,
      '2. Byt ditt tillfälliga lösenord (du blir ombedd direkt).',
      '3. Följ onboarding-stegen för att göra klart grunderna.',
      '',
      `Behöver du hjälp? Kontakta oss på ${getSupportEmail()}.`,
      '',
      'Vänliga hälsningar,',
      `${getCompanyName()}-teamet`,
    ].join('\n'),
  }
}

type OnboardingReminderInput = { companyName: string; nextStepTitle: string; loginUrl: string }

export function onboardingReminderEmail({ companyName, nextStepTitle, loginUrl }: OnboardingReminderInput) {
  return {
    subject: `Fortsätt er onboarding i ${getCompanyName()}`,
    bodyText: [
      'Hej,',
      '',
      `Er onboarding för ${companyName} är inte klar ännu. Nästa steg: ${nextStepTitle}.`,
      `Fortsätt här: ${loginUrl}`,
      '',
      'Vänliga hälsningar,',
      `${getCompanyName()}-teamet`,
    ].join('\n'),
  }
}

type PilotFollowUpInput = { companyName: string; contactName: string }

export function pilotFollowUpEmail({ companyName, contactName }: PilotFollowUpInput) {
  return {
    subject: `Hur går piloten med ${getCompanyName()}?`,
    bodyText: [
      `Hej ${contactName},`,
      '',
      `Vi vill gärna höra hur piloten för ${companyName} går. Fungerar planeringen som ni vill? Finns det något vi kan justera i er branschuppsättning?`,
      '',
      `Svara på detta mejl eller kontakta oss på ${getSupportEmail()} så bokar vi en uppföljning.`,
      '',
      'Vänliga hälsningar,',
      `${getCompanyName()}-teamet`,
    ].join('\n'),
  }
}

type SupportReceivedInput = { subject: string }

export function supportRequestReceivedEmail({ subject }: SupportReceivedInput) {
  return {
    subject: `Vi har tagit emot ditt supportärende: ${subject}`,
    bodyText: [
      'Hej,',
      '',
      `Vi har tagit emot ditt supportärende "${subject}" och återkommer så snart vi kan.`,
      '',
      'Vänliga hälsningar,',
      `${getCompanyName()}-supporten`,
    ].join('\n'),
  }
}
