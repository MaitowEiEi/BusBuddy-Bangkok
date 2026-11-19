import { useEffect, useState } from 'react';
import { useT } from '../lib/i18n';
import type { TransitDataProvider } from '../services/transitProvider';
import type { TransitNetwork } from '../types/transit';

export function useNetwork(provider: TransitDataProvider) {
  const tr = useT();
  const [network, setNetwork] = useState<TransitNetwork | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    provider
      .loadNetwork()
      .then((n) => {
        if (!cancelled) {
          setNetwork(n);
          setHasError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setHasError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [provider]);

  const error = hasError ? tr('โหลดข้อมูลเส้นทางไม่สำเร็จ', 'Failed to load transit network data') : null;
  return { network, error };
}
