# Archived standalone viewer

evo-sim-poc-0.6.16.html is an exact-byte snapshot of the old standalone
evidence/app/evo-sim-poc.html from this inspector working tree. It is not the
active viewer. The active entry is src/view/index.html, served by `npm run view`.

The archived HTML retains the old shell and pending inspector UI work. That UI
has not been ported to index.html merely by archiving this file.
New legacy build/checks use build/legacy-viewer.html, so normal rebuilds do not
recreate the retired evidence/app/evo-sim-poc.html or overwrite this archive.
The archive checksum is recorded in snapshot.sha256; verify from this directory.
