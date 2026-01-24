export default function BehaviorLayers({ layers }) {
  if (!layers || layers.length === 0) {
    return <div>No behavior layers.</div>;
  }

  return (
    <section>
      <h3>Behavior</h3>
      <ul>
        {layers.map((layer) => (
          <li key={layer.id}>
            <strong>{layer.label}</strong> — {layer.status}
            <div>{layer.summary}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
