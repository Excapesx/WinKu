These icons are generated from `../../app-icon.svg`, synchronized from Android's `res/drawable/ic_launcher_fg.xml` and `res/values/colors.xml` by `scripts/sync-android-design.mjs`. The dark background, emerald W, proportions and stroke are the Android launcher identity. Android's OS chooses its own adaptive mask; Windows uses a rounded square.

Generate with `npx tauri icon app-icon.svg --output .tools/generated-icons`, then copy `icon.ico` and `128x128.png` into this folder as `icon.ico` and `icon.png`.

`npm run package` performs the design synchronization and icon generation automatically. In-app marks come from Android `brand_mark.xml`, matching the mobile wordmark rather than recropping the launcher artwork.
