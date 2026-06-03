Put station brand logo images in this folder.

Current logo files mapped in `src/ev-map-card.ts`:

- `altervim.png`
- `charge24.jpg`
- `ea-anywhere.png`
- `elexa.png`
- `ev_station_pluz.jpg`
- `evolt.jpg`
- `ginka.png`
- `igreen.png`
- `mea.jpg`
- `mg.jpg`
- `on-ion.png`
- `pea_volta.png`
- `rever.png`
- `sharge.png`
- `shell.png`
- `spark.jpg`
- `susco.png`
- `tesla.png`

The card matches each logo by aliases against both `station.brand` and `station.name`, so the TomTom station name does not need to be exact. Use square PNG/JPG images for best results. The card falls back to brand initials if an image is missing or fails to load.
