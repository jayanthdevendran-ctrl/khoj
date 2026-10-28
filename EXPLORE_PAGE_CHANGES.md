# Wiring into app/explore/page.tsx

Three small edits. Everything else in the page stays the same.

## 1. Imports

Add near the top:

```tsx
import { useCompassHeading } from "@/lib/useCompassHeading";
import { useFloorplan } from "@/lib/useFloorplan";
```

## 2. Inside the component, alongside the other useState calls

```tsx
const floorplanUrl = useFloorplan(floor);
const { heading, needsPermission, requestPermission } = useCompassHeading();
```

## 3. Pass the new props to MapSvg, and add a compass-enable button

Replace the existing `<MapSvg ... />` block with:

```tsx
<MapSvg
  floor={floor}
  projects={filteredProjects}
  pois={filteredPois}
  locationsById={LOCATIONS_BY_ID}
  categoryColorByProjectId={CATEGORY_COLOR_BY_PROJECT}
  currentLocationId={state.currentLocationId}
  selectedProjectId={selected?.id}
  onSelectProject={setSelected}
  floorplanUrl={floorplanUrl}
  heading={heading}
/>

{needsPermission && (
  <button
    onClick={requestPermission}
    className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium shadow-card dark:bg-night/90"
  >
    🧭 Enable compass
  </button>
)}
```

(`needsPermission` is only ever true on iOS Safari, which requires a tap
before it will share the compass — Android just starts working.)

That's it — the map now shows the real uploaded floorplan once one exists
for the current floor (a plain background is shown otherwise), and the
"you are here" dot gets a heading cone that rotates live as the visitor
turns.
