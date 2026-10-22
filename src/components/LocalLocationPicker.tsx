type Location = { address: string; latitude: number; longitude: number };
export default function LocalLocationPicker({ value, onChange }: { value: Location; onChange: (value: Location) => void }) {
  return <div className="form-grid">
    <p className="muted">Informe o endereço da obra. As coordenadas são opcionais.</p>
    <label>Endereço<input value={value.address} onChange={event => onChange({ ...value, address: event.target.value })} placeholder="Rua, número, bairro e cidade" required /></label>
    <label>Latitude (opcional)<input type="number" step="any" min="-90" max="90" value={value.latitude} onChange={event => onChange({ ...value, latitude: Number(event.target.value) })} /></label>
    <label>Longitude (opcional)<input type="number" step="any" min="-180" max="180" value={value.longitude} onChange={event => onChange({ ...value, longitude: Number(event.target.value) })} /></label>
  </div>;
}
