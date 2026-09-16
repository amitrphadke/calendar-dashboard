Drop JPEG/PNG/WebP files directly in this folder and they'll rotate on the
dashboard, most recent filename order — no manifest to maintain by hand,
`scripts/gen-photos-manifest.mjs` builds one automatically.

This folder is meant to be synced from wherever your real photos live (an
rclone job pulling a Google Photos album export, a Nextcloud share, a
folder on the same machine) — see the "Photos" section in README.md for why
there's no live Google Photos / iCloud integration built in.
