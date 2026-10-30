import { useEffect, useState } from 'react';
import type { TransitDataProvider } from '../services/transitProvider';
import type { TransitNetwork } from '../types/transit';

export function useNetwork(provider: TransitDataProvider) {
  const [network, setNetwork] = useState<TransitNetwork | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    provider
      .loadNetwork()
      .then((n) => { if (!cancelled) setNetwork(n); })
      .catch(() => { if (!cancelled) setError('โหลดข้อมูลเส้นทางไม่สำเร็จ'); });
    return () => { cancelled = true; };
  }, [provider]);

  return { network, error };
}