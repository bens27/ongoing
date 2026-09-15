# Project detail design study

Open [index.html](index.html) in a browser. It is a self-contained, editable HTML artifact with
inline scripts, Ongoing's captured design tokens/icons, and two embedded fixture records. Use
**Panel / Factsheet** to switch layouts; use the project selector to compare Sidecar and Ongoing.
Dark/light themes, panel widths, chart exploration, expandable sections, and the searchable
inspector work. Draft next actions stay in memory until the page reloads. External links open real
destinations; this study does not mutate the catalog.

The fixtures are synthetic examples with the shape of catalog records, not
current operational evidence. The factsheet and typography refinement were added on 2026-09-14.
The sidebar is context decoration. Project icons are placeholders from Ongoing's existing roc set.

The [controlling implementation plan](../../plans/active/project-detail-redesign.md) defines
production behavior, integration seams, edge cases, and acceptance criteria. In particular, the
mockup's illustrative priority condition and page-local draft storage must not be copied as
production rules.

The current loopback preview serves this same HTML at:

- [Panel](http://127.0.0.1:7816/?view=panel&project=sidecar)
- [Factsheet](http://127.0.0.1:7816/?view=factsheet&project=sidecar)

Those URLs last only as long as the preview process. The checked-in HTML remains usable without
it. Query parameters `view=factsheet` and `project=ongoing` select the starting view and record.
