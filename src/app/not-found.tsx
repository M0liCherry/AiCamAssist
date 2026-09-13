import { ArrowLeft, FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <main className="not-found-page">
      <div className="not-found-brand"><img src="/logo.png" alt="" style={{ width: 20, height: 20, borderRadius: 4, objectFit: "contain" }} />VerityAI</div>
      <section>
        <span aria-hidden="true"><FileQuestion size={34} /></span>
        <p className="eyebrow">404 error</p>
        <h1>That page isn’t in your notes.</h1>
        <p>The resource may have moved, or the address may be incomplete.</p>
        <a href="/" className="primary-button"><ArrowLeft size={16} aria-hidden="true" />Return to workspace</a>
      </section>
    </main>
  );
}
