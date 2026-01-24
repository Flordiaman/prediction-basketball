export default function VerbalView({ narrative }) {
  if (!narrative) return null;

  return (
    <section>
      <h2>Summary</h2>
      <p>{narrative.verbal}</p>

      <small>
        Tone: {narrative.tone} · Confidence: {narrative.confidence}
      </small>
    </section>
  );
}
