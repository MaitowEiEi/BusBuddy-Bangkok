import { mockTransitProvider } from './mockTransitProvider';
import { namtangTransitProvider } from './namtangTransitProvider';
import type { TransitDataProvider } from './transitProvider';

/** Real Namtang data by default. Add ?data=mock to the URL to switch back to the demo data. */
const useMock = new URLSearchParams(window.location.search).get('data') === 'mock';

export const activeProvider: TransitDataProvider = useMock ? mockTransitProvider : namtangTransitProvider;