# Deploy BuildSight PH

BuildSight PH serves the built React frontend and FastAPI API from one origin.
Use the approved `main` branch and record the exact Git commit for each release.
Keep the roughly 288 MiB SQLite snapshot on persistent storage outside Git and
the container image. The application opens it read-only and requires no
database server or migration.

| Setting | Purpose |
| --- | --- |
| `BUILDSIGHT_DB_PATH` | Absolute path to the verified snapshot on the host or inside the container |
| `PORT` | Container listener port. Defaults to 8000. Use the hosting platform's assigned value when provided |
| `/healthz` | Process liveness. This can succeed before the snapshot is installed |
| `/api/overview` | Data readiness check. Requires a readable, compatible snapshot |

Choose an existing Linux host with Docker, a native Linux service, or an approved
managed host. The managed-host example below uses Render. DNS, TLS, and access
policy belong to the professor or domain administrator.

## Obtain and verify the SQLite snapshot

1. Request the approved `buildsight_four_source_final.sqlite` release file and
   its SHA-256 digest from the capstone team. Use a restricted Drive share,
   approved institutional storage, or another authenticated handoff. Ask the
   team to confirm the digest through a trusted channel. Use only the standalone
   snapshot. The team should validate any replacement snapshot before handoff.
2. Compute the digest on the computer that received the file and compare all 64
   hex characters with the team's digest.

   **Windows PowerShell**

   ```powershell
   Get-FileHash -Algorithm SHA256 -LiteralPath '.\buildsight_four_source_final.sqlite'
   ```

   **Linux or macOS**

   ```bash
   sha256sum buildsight_four_source_final.sqlite        # Linux
   shasum -a 256 buildsight_four_source_final.sqlite    # macOS
   ```

3. Use SSH/SCP or the hosting provider's approved secure upload. Verify the SSH
   host fingerprint through the provider before trusting it. Keep private
   keys on the operator's computer. Example for a Linux host with an SSH
   account that can write to its home directory:

   ```bash
   ssh deploy@your-server 'install -d -m 0700 buildsight-staging'
   scp buildsight_four_source_final.sqlite deploy@your-server:buildsight-staging/buildsight.sqlite.upload
   ssh deploy@your-server 'sha256sum buildsight-staging/buildsight.sqlite.upload'
   ```

4. Compare the server digest with the verified original. Stop on a mismatch and
   repeat the transfer. Move the verified file into a restricted, persistent
   directory with a versioned filename. Set permissions for the runtime
   identity (UID 10001 for the supplied Docker image, or the dedicated Linux
   service account). This Linux example assumes UID 10001 is available for
   the application's data. Run it in the deploy account's home directory on the server:

   ```bash
   sudo install -d -m 0750 -o root -g 10001 /srv/buildsight-data
   sudo install -m 0440 -o root -g 10001 \
     buildsight-staging/buildsight.sqlite.upload /srv/buildsight-data/buildsight-approved.sqlite
   sudo sha256sum /srv/buildsight-data/buildsight-approved.sqlite
   ```

   Delete the staging copy after checking the installed file. Record the
   checksum and filename in the release notes alongside the Git revision.

## Docker on a Linux server

Install Git and Docker with BuildKit. From a checkout of the repository:

```bash
git switch main
git pull --ff-only origin main
REV=$(git rev-parse --short=12 HEAD)
docker build -t "buildsight-ph:$REV" .
```

Copy `.env.example` to a private runtime file such as `.env`. Keep the container
database path `/var/data/buildsight.sqlite`. With the example port 8000, start:

```bash
docker run -d --name buildsight-ph --restart unless-stopped \
  --env-file .env -p 127.0.0.1:8000:8000 \
  --mount type=bind,source=/srv/buildsight-data/buildsight-approved.sqlite,target=/var/data/buildsight.sqlite,readonly \
  "buildsight-ph:$REV"
```

If you change the container `PORT`, update the container-side port in `-p`.
Put an HTTPS reverse proxy in front of the loopback listener on the host.
Route the whole site, including `/api`, `/assets`, and `/maps`, to that service.
The Docker health check uses the configured port. Run `docker logs buildsight-ph`
if the service fails. On build networks using a private CA, BuildKit can mount
the trusted certificate bundle for dependency downloads:

```bash
docker build --secret id=build_ca,src=/path/to/ca-bundle.pem -t "buildsight-ph:$REV" .
```

## Native Linux with Uvicorn

Install Python 3.12 and Node.js 22 LTS. Build in a versioned release directory
with an independent virtual environment:

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
npm --prefix frontend ci
npm --prefix frontend run build
export BUILDSIGHT_DB_PATH=/srv/buildsight-data/buildsight-approved.sqlite
export PORT=8000
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port "$PORT"
```

For a managed service on your Linux host, use a dedicated account such as
`buildsight`, grant it read and directory traversal permissions on the
snapshot path, and configure a systemd unit. Example for
`/etc/systemd/system/buildsight.service`:

```ini
[Unit]
Description=BuildSight PH
After=network.target

[Service]
User=buildsight
WorkingDirectory=/srv/buildsight/current
Environment=BUILDSIGHT_DB_PATH=/srv/buildsight-data/buildsight-approved.sqlite
Environment=PORT=8000
ExecStart=/srv/buildsight/current/.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port ${PORT}
Restart=on-failure
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

Point `/srv/buildsight/current` at the chosen release and run
`sudo systemctl daemon-reload` and
`sudo systemctl enable --now buildsight`. Use
`journalctl -u buildsight -n 100` for startup logs. Terminate HTTPS at the
host reverse proxy.

## Render (optional)

1. With billing approval, create a Blueprint from `main` using `render.yaml`.
   It specifies a Starter Docker service in Singapore, a 1 GB persistent
   disk at `/var/data`, and manual deployments. A paid web service is required
   for persistent disks and SSH. Confirm the current prices before provisioning.
   [Render pricing](https://render.com/pricing) · [Persistent disks](https://render.com/docs/disks)
2. Use the platform's assigned `PORT` and `/healthz` for process health.
   Configure `BUILDSIGHT_DB_PATH=/var/data/buildsight.sqlite`. After the first
   deploy, add your public SSH key and copy the service's **Connect → SSH**
   destination. Confirm the runtime account can write to the mounted disk
   with `test -w /var/data` over SSH. Resolve any mount permission issues
   before copying the snapshot.
3. Upload to a staging filename and compare the digest before replacing the
   data file. Example:

   ```bash
   TARGET=YOUR_SERVICE@ssh.YOUR_REGION.render.com
   scp -s buildsight_four_source_final.sqlite "$TARGET:/var/data/.buildsight.sqlite.upload"
   ssh "$TARGET" 'sha256sum /var/data/.buildsight.sqlite.upload'
   # Continue after the checksum matches. For updates, preserve the previous file first.
   ssh "$TARGET" 'chmod 600 /var/data/.buildsight.sqlite.upload && mv /var/data/.buildsight.sqlite.upload /var/data/buildsight.sqlite'
   ```

   Keep the last verified snapshot in restricted storage or as a versioned
   backup on the disk if space allows. [Render SSH](https://render.com/docs/ssh) · [SCP transfer](https://render.com/docs/disks#transferring-files)
4. Run the release checks below on the assigned Render URL. If an existing
   Render service points to an older branch, confirm its branch setting is
   `main` before manually deploying the approved commit.

## Verify a release

```bash
BASE=http://127.0.0.1:8000
curl -fsS "$BASE/healthz"
curl -fsS "$BASE/api/overview"
```

The approved snapshot reports **248,220** contracts,
**₱6,379,173,272,392.51** reported contract value,
**65.86%** average ongoing progress, and a **30.27%** low-progress ongoing rate.
Check all six pages and direct links on the final HTTPS URL. Try a region
filter, a project detail refresh, a linked contractor portfolio, and the NCR
price chart. Verify that no database or credential files are reachable from
the static site. See the [release checklist](DEPLOYMENT_CHECKLIST.md).

## Update or roll back

- **Before an update.** Record the active commit or image tag, snapshot path
  and SHA-256, and runtime settings. Retain the previous image or native
  release directory and a verified copy of its snapshot. Run CI and the
  full-snapshot tests for the candidate revision. Test it on a spare local
  port before changing the active service.
- **Docker.** Build a fresh tag from the approved commit. Replace the
  container using the same settings and the selected verified snapshot.
  Roll back by removing the failed container and repeating the launch
  command with the previous image tag, snapshot mount, and settings.
- **Native Linux.** Build a new release directory. Point the `current`
  symlink at it and restart systemd. To roll back, restore the previous
  symlink target and matching runtime database path, then restart. Reload
  systemd if the unit configuration changed.
- **Render.** Use **Manual Deploy** for the approved `main` revision. To roll
  back, use the service's previous successful deploy or redeploy the recorded
  commit. The persistent disk is independent of code deploys. If data also
  changed, restore the previous verified snapshot from backup by staging,
  checking its digest, and renaming on the same filesystem.
- **After either operation.** Repeat the process, data, and HTTPS checks.
  A healthy process with a 503 from the overview API usually means the
  snapshot path, compatibility, or permissions need attention.
