import { useId } from 'react';
import { useApp } from '../../state/AppContext';

export function EndpointSelect({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const { network, origin } = useApp();
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3"
      >
        <option value="">— เลือกป้ายหรือสถานที่ —</option>
        {origin && <option value="origin">{`จุดเริ่มต้นของฉัน: ${origin.labelTh}`}</option>}
        <optgroup label="สถานที่">
          {network.places.map((p) => <option key={p.id} value={`place:${p.id}`}>{p.nameTh}</option>)}
        </optgroup>
        <optgroup label="ป้ายรถเมล์">
          {network.stops.map((s) => <option key={s.id} value={`stop:${s.id}`}>{`ป้าย${s.nameTh}`}</option>)}
        </optgroup>
      </select>
    </div>
  );
}