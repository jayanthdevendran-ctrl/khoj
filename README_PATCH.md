# KHOJ changes in this build

## Excel import (admin)
- Open `/admin/dashboard` and upload the `.xlsx` workbook.
- The importer reads the `Teams` worksheet columns `Team Name`, `Project`, `Team Members`, `Premise`, `Room`, and `Logo File`.
- Embedded images in the Excel drawing layer are matched to their worksheet rows, resized when practical, uploaded to Supabase Storage, and saved as each team's `logo_url`.
- Review/edit the extracted rows before importing. Re-imports update records using stable row-derived slugs instead of duplicating the same imported project rows.
- The importer uses the existing `floorplans` Storage bucket for the logo files, so the existing floorplan migration and admin storage policies must be installed.
- Excel location data does not include map coordinates; imported room markers start at `(50, 50)` on the third floor and should be positioned to match the actual floorplan.

## Map changes
- The home-page map now loads the uploaded third-floor image from the `floorplans` table instead of a blank background.
- The interactive map opens on the third floor by default. The floor selector offers Third Floor and Ground Floor; First Floor was removed from the visitor selector.
- The “Near You” panel and the simulated checkpoint/location selector were removed. Project markers and amenities remain selectable/filterable.
- Uploaded team logos are displayed in the admin project table, project cards, and project detail pages.

## Dependencies and validation
- `fflate` is declared as a direct dependency for reading embedded images from `.xlsx` archives.
- Source syntax was checked with the TypeScript transpiler. A full `next build` was not run because npm dependencies could not be installed in the editing environment.
