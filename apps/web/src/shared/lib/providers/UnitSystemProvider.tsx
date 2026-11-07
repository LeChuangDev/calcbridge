/** 全局单位制状态：页头切换、写入 localStorage、跨页面复用。 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { UnitSystem } from '@/shared/lib/unitSystem';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';

interface UnitContextValue {
  system: UnitSystem;
  setSystem: (system: UnitSystem) => void;
}

function loadSystem(): UnitSystem {
  try {
    return localStorage.getItem(STORAGE_KEYS.unitSystem) === 'imperial' ? 'imperial' : 'metric';
  } catch {
    return 'metric';
  }
}

const UnitSystemContext = createContext<UnitContextValue>({
  system: 'metric',
  setSystem: () => {},
});

export function UnitSystemProvider({ children }: { children: ReactNode }) {
  const [system, setSystem] = useState<UnitSystem>(loadSystem);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.unitSystem, system);
    } catch {
      /* 本地存储不可用时忽略 */
    }
  }, [system]);

  return (
    <UnitSystemContext.Provider value={{ system, setSystem }}>
      {children}
    </UnitSystemContext.Provider>
  );
}

export function useUnitSystem(): UnitContextValue {
  return useContext(UnitSystemContext);
}
