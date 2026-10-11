// Admin-only CSS (animations + recharts theming through the design tokens, so charts follow light/dark instantly).
const css = `
@keyframes adm-slide { from { transform: translateX(100%); } to { transform: none; } }
@keyframes adm-pop { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: none; } }
@keyframes adm-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.adm-slide { animation: adm-slide .28s cubic-bezier(.2,.8,.2,1); }
.adm-pop { animation: adm-pop .18s ease-out; }
.adm-rise { animation: adm-rise .3s ease-out both; }
@media (prefers-reduced-motion: reduce) { .adm-slide, .adm-pop, .adm-rise { animation: none; } }

.adm-chart .recharts-cartesian-axis-tick-value { fill: var(--c-ink-3); font-size: 11px; font-weight: 500; }
.adm-chart .recharts-cartesian-grid line { stroke: var(--c-line); }
.adm-chart .recharts-cartesian-axis-line, .adm-chart .recharts-cartesian-axis-tick-line { stroke: var(--c-line); }
.adm-chart .recharts-rectangle.recharts-tooltip-cursor { fill: var(--c-surface-2); stroke: none; }
.adm-chart .recharts-curve.recharts-tooltip-cursor { stroke: var(--c-ink-3); stroke-width: 1; }
.adm-chart .recharts-active-dot circle, .adm-chart .recharts-dot { stroke: var(--c-surface); stroke-width: 2; }
.adm-chart .recharts-sector { stroke: var(--c-surface); stroke-width: 2; }
.adm-chart .recharts-bar-rectangle path { stroke: var(--c-surface); stroke-width: 1; }
.adm-chart svg:focus, .adm-chart .recharts-wrapper:focus, .adm-chart *:focus:not(:focus-visible) { outline: none; }

.adm-scroll { scrollbar-width: thin; scrollbar-color: rgb(255 255 255 / .12) transparent; }
.adm-scroll::-webkit-scrollbar { width: 6px; }
.adm-scroll::-webkit-scrollbar-thumb { background: rgb(255 255 255 / .12); border-radius: 6px; }
`;

export const AdminStyles = () => <style>{css}</style>;
