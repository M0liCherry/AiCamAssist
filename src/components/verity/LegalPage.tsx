import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
import { APP_NAME, APP_VERSION, CONTRIBUTORS, POLICY_EFFECTIVE_DATE, PROJECT_LICENSE, PUBLISHER, REPO_URL } from "@/config/app";
import { THIRD_PARTY } from "@/config/licenses";
import { LegalThemeSync } from "./LegalThemeSync";

export type PolicyKey = "privacy" | "terms" | "telemetry" | "license" | "accessibility" | "licenses";

type Section = { heading: string; paragraphs?: string[]; bullets?: string[] };
type Policy = { title: string; summary: string; sections: Section[] };

export const policies: Record<PolicyKey, Policy> = {
  privacy: {
    title: "Privacy Policy",
    summary: "What VerityAI stores on your computer, what can leave it, and the choices you control.",
    sections: [
      { heading: "1. Local-first by design", paragraphs: [`${APP_NAME} is a private, local-first application. Your subjects, chapters, notes, extracted text, retrieval chunks and embeddings, chat history, generated podcasts, flashcard decks, quiz attempts, transcripts, and settings are stored in a local embedded database. There is no VerityAI account, no cloud copy, and no server operated by the publisher that receives your content.`] },
      { heading: "2. Data we do not collect", bullets: ["No analytics, usage statistics, advertising identifiers, or tracking pixels.", "No automatic crash uploads. Optional diagnostics are written to a local file only (see the Telemetry & Diagnostics Policy).", "No payment, location, contact, biometric, or health data.", "No account, password, or profile — the app is single-user and offline-capable."] },
      { heading: "3. When data leaves your computer", paragraphs: ["Data is transmitted only in the situations below, each of which you initiate:"], bullets: ["Cloud AI providers (Google Gemini or Anthropic Claude): if you choose one and trigger an AI feature, the text of the notes in the selected scope (or retrieved excerpts), your question, and generation instructions are sent to that provider's API under your own API key and governed by that provider's terms and privacy policy. Embeddings requests (Gemini only) send note chunks for vectorisation. You consent to this explicitly when saving the provider; you can switch to a local model at any time.", "Local models (Ollama, llama.cpp server, LM Studio): requests go to a server running on this computer (127.0.0.1 by default). Nothing is sent to the internet unless you point the endpoint at a remote machine yourself.", "Model downloads: pulling an Ollama model or the first Whisper speech model downloads weights from ollama.com or huggingface.co. Only standard HTTP download requests are made; none of your content is included.", "Website and YouTube import: VerityAI fetches the address you paste, exactly as a browser would.", "Exports: files you export are written wherever you choose to save them."] },
      { heading: "4. API keys", paragraphs: ["API keys you enter are encrypted with AES-256-GCM using a key file stored in your data folder and are never displayed again in full. Anyone with full access to your user account could recover them, so protect your device as you would a password manager. Use “Erase all local data” in Settings to remove them."] },
      { heading: "5. Retention and deletion", paragraphs: ["Data persists until you delete it. Individual notes, chapters, subjects, chats, and generated assets can be deleted in the app. “Erase all local data” removes everything and restarts first-launch setup. Deleting your local data folder removes all stored data."] },
      { heading: "6. Legal bases and your rights", paragraphs: ["Because the publisher does not receive your personal data, most data-protection rights (access, correction, portability, erasure) are exercised directly on your device using the export and delete features. Where a cloud AI provider processes your content, that provider is an independent controller or processor under your agreement with them. Users in the EU/UK, California, and other jurisdictions retain all statutory rights; nothing here limits them."] },
      { heading: "7. Children", paragraphs: ["VerityAI is not directed at children under 13 (or the minimum age of digital consent in your region). Schools deploying the app should review applicable student-privacy rules (e.g. FERPA/COPPA) and the cloud-provider option before use."] },
      { heading: "8. Changes and contact", paragraphs: [`Material changes to this policy ship with a new app version and are noted in the release notes. Questions: ${PUBLISHER.privacyEmail}.`] },
    ],
  },
  terms: {
    title: "Terms & Conditions",
    summary: "Acceptable use, AI limitations, and liability terms for the VerityAI software.",
    sections: [
      { heading: "1. The software", paragraphs: [`These terms cover the ${APP_NAME} application (version ${APP_VERSION}) provided by ${PUBLISHER.name}. By accessing or using it you agree to these terms and to the License, Refunds & Support policy.`] },
      { heading: "2. Acceptable use", bullets: ["Import and process only material you own or are permitted to use for personal study; respect copyright, licence terms, and website terms of service.", "Do not process unlawful content or other people's sensitive personal data without a lawful basis.", "Do not use the software to circumvent access controls of third-party services, including AI provider rate limits or content policies.", "You are responsible for complying with the terms of any AI provider whose API key you connect and for any charges they bill you."] },
      { heading: "3. AI output and hallucinations", paragraphs: ["Summaries, chat answers, podcast scripts, flashcards, and quizzes are produced by machine-learning models from your notes. They can be incomplete, outdated, biased, or simply wrong, may misattribute a citation, and may reproduce errors in your source material. VerityAI displays citations so you can check the underlying passages. Always verify important facts against authoritative sources and your instructors; do not rely on AI output for academic integrity-sensitive submissions, medical, legal, or financial decisions."] },
      { heading: "4. Local models and system resources", paragraphs: ["Running local models requires substantial CPU/GPU, memory, and disk space and may be slow on modest hardware. Model weights are licensed by their respective authors; review each model's licence before use. VerityAI does not warrant the availability, accuracy, or safety of any third-party model."] },
      { heading: "5. Your content", paragraphs: ["You retain all rights to your notes and generated material derived from them. The publisher claims no ownership and has no access to your content."] },
      { heading: "6. Updates", paragraphs: ["Updates may change features, storage formats, or supported providers. Where a migration is required it runs locally on first launch of the new version; back up your data folder before major upgrades."] },
      { heading: "7. Disclaimer of warranty and limitation of liability", paragraphs: ["To the maximum extent permitted by law, the software is provided “as is” and “as available” without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, accuracy, and non-infringement. The publisher is not liable for indirect, incidental, special, consequential, or punitive damages, loss of data, loss of grades or academic standing, or costs charged by third-party AI providers. Statutory consumer rights that cannot be excluded are unaffected."] },
      { heading: "8. Termination and governing law", paragraphs: ["You may stop using the software at any time by stopping use and deleting your data folder. Governing law and venue are those stated in the License, Refunds & Support policy for the edition you obtained; if none is stated, the mandatory consumer law of your place of residence applies."] },
    ],
  },
  telemetry: {
    title: "Telemetry & Diagnostics Policy",
    summary: "VerityAI ships with zero telemetry. This page documents exactly what the optional diagnostics switch does.",
    sections: [
      { heading: "1. No cookies, no analytics", paragraphs: ["The application renders locally and uses no advertising or analytics cookies, no third-party scripts, and no tracking SDKs. Interface preferences (theme, consent timestamps) are stored in the local database, not in cookies."] },
      { heading: "2. Optional local diagnostics (off by default)", paragraphs: ["During first launch, and at any time in Settings → Privacy & diagnostics, you can enable a local diagnostics log. When enabled, unexpected errors (message, short stack trace, timestamp, and the feature involved) are appended to a plain-text file in your data folder. The log never includes note content, API keys, or prompts. Nothing is uploaded automatically; if you want help, you choose whether to attach the file to a support email."] },
      { heading: "3. Crash reporting", paragraphs: ["No automatic crash reporting is enabled. An error produces no network traffic. Should a future version add opt-in crash upload, it will be off by default, described here, and require a separate explicit consent."] },
      { heading: "4. Network activity summary", bullets: ["AI provider APIs — only for the backend you selected, only when you trigger an AI action.", "Model downloads — only when you click Download or transcribe audio for the first time.", "Website/YouTube imports — only for links you paste.", "Update checks — none are performed by this version."] },
      { heading: "5. Changing your choice", paragraphs: ["Toggle diagnostics off in Settings at any time and delete the log file from the logs folder shown there."] },
    ],
  },
  license: {
    title: "License, Refunds & Support",
    summary: "Software licence, pricing status, refund handling, and support commitments.",
    sections: [
      { heading: "1. Licence grant", paragraphs: [`${PUBLISHER.name} grants you a personal, non-exclusive, non-transferable licence to access and use ${APP_NAME} on devices you control for personal study and note-taking. You may not redistribute, sell, sublicense, or reverse engineer the application except to the extent permitted by law or by the open-source licences of its components (see Open-source licenses).`] },
      { heading: "2. Price and purchases", paragraphs: ["This version of VerityAI contains no in-app purchases, subscriptions, trials, or licence keys. Any fees charged by third-party AI providers or model hosts are governed solely by those providers. If a paid edition is offered in the future, the price, billing interval, trial length, renewal rules, and refund terms will be shown before purchase and documented here."] },
      { heading: "3. Refunds", paragraphs: ["Because nothing is charged for this edition, no refund can arise from it. If you obtained VerityAI through a store or reseller, that store's refund policy applies to the transaction. Statutory withdrawal and refund rights in your jurisdiction are never limited by this policy."] },
      { heading: "4. Support", paragraphs: [`Support is provided on a best-effort basis by email at ${PUBLISHER.supportEmail}. Include the app version (shown in Settings → About), your system platform, the AI backend in use, and — if you enabled it — the local diagnostics log. There is no guaranteed response time or uptime commitment for a self-hosted application.`] },
      { heading: "5. Third-party components", paragraphs: ["The application bundles open-source components under MIT, ISC, Apache-2.0, BSD-2-Clause, and similar licences. Their notices are reproduced on the Open-source licenses page and in THIRD_PARTY_NOTICES.md. Model weights downloaded on demand are licensed by their authors."] },
      { heading: "6. Publisher details", bullets: [`Publisher: ${PUBLISHER.name}`, `Repository: ${REPO_URL}`, `License: ${PROJECT_LICENSE}`, `Support: ${PUBLISHER.supportEmail}`, `Version: ${APP_VERSION}`] },
    ],
  },
  accessibility: {
    title: "Accessibility Statement",
    summary: "How VerityAI approaches WCAG 2.1 AA and where the current limitations are.",
    sections: [
      { heading: "1. Commitment", paragraphs: ["VerityAI is built to meet WCAG 2.1 Level AA: semantic landmarks and headings, labelled controls, visible focus indicators, high-contrast colour tokens in both themes, reflow down to narrow window sizes, and reduced-motion support."] },
      { heading: "2. Keyboard operation", bullets: ["Tab / Shift+Tab move through every control; Enter or Space activates buttons and flips flashcards.", "Arrow keys switch podcast length, move between flashcards, navigate menus and quiz options; keys 1/2/3 grade a revealed flashcard.", "Space or Enter on the podcast player toggles playback; Left/Right change the turn.", "Ctrl+K focuses search; Ctrl+S saves the open note; Escape closes dialogs and menus."] },
      { heading: "3. Assistive technology", paragraphs: ["Dynamic regions — chat replies, generation status, playback position, card counters, and scores — use ARIA live regions and status roles. Icons are decorative (aria-hidden) with text labels or accessible names on every control. Transcript highlighting is also conveyed through the “Currently speaking” label and turn counter, not colour alone."] },
      { heading: "4. Known limitations", bullets: ["Text-to-speech voices and word-boundary highlighting depend on the voices installed in Windows.", "Whisper transcription quality varies with audio quality and language.", "Imported documents keep only their text; images and charts are not described automatically."] },
      { heading: "5. Feedback", paragraphs: [`Report accessibility barriers to ${PUBLISHER.supportEmail}; include the screen reader or input method used so the issue can be reproduced.`] },
    ],
  },
  licenses: {
    title: "Open-source licenses",
    summary: "Third-party software, icons, fonts, and model weights used by VerityAI, with their licences.",
    sections: [{ heading: "Notice", paragraphs: ["All bundled interface icons are Lucide (ISC). The interface uses your operating system's font stack; no web fonts are embedded or fetched. No stock photography, audio samples, or third-party media are bundled. Model weights are downloaded on demand under their own licences."] }],
  },
};

export function LegalPage({ policyKey }: { policyKey: PolicyKey }) {
  const policy = policies[policyKey];
  return (
    <main className="legal-page">
      <LegalThemeSync />
      <header className="legal-topbar">
        <a href="/" className="legal-brand"><img src="/logo.png" alt="" style={{ width: 22, height: 22, borderRadius: 4, objectFit: "contain" }} />{APP_NAME}</a>
        <a href="/" className="secondary-button compact"><ArrowLeft size={15} aria-hidden="true" />Back to workspace</a>
      </header>
      <div className="legal-shell">
        <aside className="legal-nav" aria-label="Legal documents">
          <p>Trust center</p>
          {(Object.keys(policies) as PolicyKey[]).map((key) => <a href={`/legal/${key}`} className={key === policyKey ? "active" : ""} aria-current={key === policyKey ? "page" : undefined} key={key}>{policies[key].title}</a>)}
          <div><ShieldCheck size={18} aria-hidden="true" /><p><strong>Local-first</strong>Version {APP_VERSION}. No telemetry, no account, data stays on your PC.</p></div>
        </aside>
        <article className="policy-article">
          <p className="eyebrow">Legal &amp; trust center</p>
          <h1>{policy.title}</h1>
          <p className="policy-summary">{policy.summary}</p>
          <div className="effective-date"><span>Effective: {POLICY_EFFECTIVE_DATE}</span><span>App version {APP_VERSION}</span></div>
          {policy.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}
            </section>
          ))}
          {policyKey === "licenses" && (
            <table className="license-table">
              <caption className="sr-only">Third-party components and licences</caption>
              <thead><tr><th scope="col">Component</th><th scope="col">Licence</th><th scope="col">Notes</th></tr></thead>
              <tbody>
                {THIRD_PARTY.map((item) => (
                  <tr key={item.name}>
                    <td>{item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.name}<ExternalLink size={12} aria-label=" (opens in a new tab)" /></a> : item.name}</td>
                    <td>{item.license}</td>
                    <td>{item.note ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <section className="operator-card">
            <h2>Publisher details</h2>
            <dl>
              <div><dt>Product</dt><dd>{APP_NAME} {APP_VERSION} for Windows</dd></div>
              <div><dt>Publisher</dt><dd>{PUBLISHER.name}</dd></div>
              <div><dt>Repository</dt><dd><a href={REPO_URL} target="_blank" rel="noreferrer">M0liCherry/AiCamAssist</a></dd></div>
              <div><dt>License</dt><dd>{PROJECT_LICENSE}</dd></div>
              <div><dt>Support</dt><dd>{PUBLISHER.supportEmail}</dd></div>
              <div><dt>Privacy</dt><dd>{PUBLISHER.privacyEmail}</dd></div>
            </dl>
            <p>Built by {CONTRIBUTORS.map((c) => c.login).join(", ")}. Publisher fields come from build configuration.</p>
          </section>
          <footer className="policy-footer"><span>© 2026 {PUBLISHER.name}</span><a href="/legal/licenses">Open-source licenses</a></footer>
        </article>
      </div>
    </main>
  );
}
