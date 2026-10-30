import { useApp } from '../../state/AppContext';
import { viewKey } from '../../types/ui';
import { PlanPanel } from '../plan/PlanPanel';
import { HomePanel } from './HomePanel';
import { PlacePanel } from './PlacePanel';
import { RoutePanel } from './RoutePanel';
import { StopPanel } from './StopPanel';
import { VehiclePanel } from './VehiclePanel';
import { VehiclesPanel } from './VehiclesPanel';

export function PanelRouter() {
  const { view } = useApp();
  const key = viewKey(view);
  switch (view.kind) {
    case 'home': return <HomePanel key={key} />;
    case 'stop': return <StopPanel key={key} stopId={view.stopId} />;
    case 'route': return <RoutePanel key={key} variantId={view.variantId} />;
    case 'vehicle': return <VehiclePanel key={key} vehicleId={view.vehicleId} />;
    case 'place': return <PlacePanel key={key} placeId={view.placeId} />;
    case 'vehicles': return <VehiclesPanel key={key} />;
    case 'plan': return <PlanPanel key={key} toStopId={view.toStopId} toPlaceId={view.toPlaceId} />;
  }
}