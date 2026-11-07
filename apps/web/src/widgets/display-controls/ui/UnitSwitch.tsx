import { useUnitSystem } from '@/shared/lib/providers/UnitSystemProvider';

export function UnitSwitch() {
  const { system, setSystem } = useUnitSystem();
  return (
    <div
      className="head-unit-switch"
      role="group"
      aria-label="长度单位制"
      title="切换长度单位：公制 mm / 英制 mil；过孔镀层同步切换 oz"
    >
      <button
        type="button"
        className={system === 'metric' ? 'active' : ''}
        aria-pressed={system === 'metric'}
        onClick={() => setSystem('metric')}
      >
        公制
      </button>
      <button
        type="button"
        className={system === 'imperial' ? 'active' : ''}
        aria-pressed={system === 'imperial'}
        onClick={() => setSystem('imperial')}
      >
        英制
      </button>
    </div>
  );
}
