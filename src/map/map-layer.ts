import type { Map as MaplibreMap } from 'maplibre-gl';

export interface MapLayer {
  id: string;
  render(map: MaplibreMap): void;
  update?(map: MaplibreMap): void;
  remove(map: MaplibreMap): void;
  setVisible(map: MaplibreMap, visible: boolean): void;
}
