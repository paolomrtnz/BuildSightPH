import { useEffect, useRef } from 'react';
import type { FeatureCollection, Geometry } from 'geojson';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Comparison } from './shared';

type Boundary = { adm1_psgc: number; adm1_en: string };

export function RegionMap({ boundaries, rows, region, onSelect }: {
  boundaries: FeatureCollection<Geometry, Boundary>;
  rows: Comparison[];
  region: string;
  onSelect: (id: string) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const layer = useRef<L.GeoJSON>(null);
  const selected = useRef(region);
  selected.current = region;
  const mapping = new Map(rows.map(row => [Number(row.psgc_code), row]));
  const style = (feature?: { properties: Boundary }) => {
    const row = feature && mapping.get(feature.properties.adm1_psgc);
    const active = row && String(row.region_id) === selected.current;
    return {
      color: active ? '#6ae8f0' : row ? '#f3c966' : '#69758b',
      fillColor: active ? '#22d6e7' : row ? '#ad7917' : '#424e64',
      weight: active ? 3 : 1.2, fillOpacity: active ? .85 : .65,
    };
  };

  useEffect(() => {
    if (!element.current) return;
    const map = L.map(element.current, { scrollWheelZoom: false });
    const shapes = L.geoJSON(boundaries, {
      style,
      onEachFeature(feature, shape) {
        const row = mapping.get(feature.properties.adm1_psgc);
        const label = document.createElement('span');
        label.textContent = row ? row.region_name : `${feature.properties.adm1_en} · no mapped contracts`;
        shape.bindTooltip(label, { sticky: true });
        if (row) shape.on('click', () => onSelect(String(row.region_id)));
      },
    }).addTo(map);
    layer.current = shapes;
    map.fitBounds(shapes.getBounds(), { padding: [12, 12] });
    return () => { map.remove(); layer.current = null; };
  }, [boundaries, rows, onSelect]);

  useEffect(() => { layer.current?.setStyle(style); }, [region, rows]);

  return <div className="region-map" ref={element} role="region" aria-label="Interactive Philippines regional boundary map" />;
}
