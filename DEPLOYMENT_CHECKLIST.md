# BuildSight PH deployment checklist

Use the [deployment guide](DEPLOYMENT.md) for commands and platform options.

## Before provisioning

- [ ] Identify who controls the approved host, TLS, and the reported team domain, `buildsightph.online`.
- [ ] Confirm the hosting plan and any cost with the professor.
- [ ] Select a reviewed commit from `main` and record it in the release notes.
- [ ] Confirm CI passed and run the snapshot tests against the approved dataset.
- [ ] Obtain the SQLite snapshot and trusted SHA-256 digest from the team.
- [ ] Review the snapshot for publication and choose persistent storage outside Git and the image.

## Set up and verify

- [ ] Transfer the snapshot over an approved secure channel and verify the destination checksum.
- [ ] Grant read access to the runtime account and configure `BUILDSIGHT_DB_PATH`.
- [ ] Set the host-assigned port if required. Keep the app behind the HTTPS proxy or managed ingress.
- [ ] Confirm `/healthz` returns 200 and verify the exact baseline through `/api/overview`.
- [ ] Open Overview, Projects, Regions, Contractors, Material Prices, and About over HTTPS. Refresh direct project and contractor links.
- [ ] Check search, regional filtering, map rendering, and the mobile layout in a browser.
- [ ] Confirm credentials and the SQLite file are absent from the repository, image, and public URLs.
- [ ] Confirm the professor's preferred access policy before sharing the final URL.

## Before announcing a release

- [ ] Record the active commit or image tag, snapshot digest and path, runtime settings, and release date.
- [ ] Keep a previous release and verified database copy available for rollback.
- [ ] Record who can restore the last known-good release and where logs are available.
- [ ] Configure a custom domain only after the domain administrator approves the final hosting setup.
