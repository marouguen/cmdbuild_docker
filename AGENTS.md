# AGENTS.md

Unofficial Docker packaging of CMDBuild + READY2USE + openMAINT. Each release lives in its own self-contained directory that is built and deployed independently; there is no shared source or build system tying them together.

## Layout

- `cmdbuild-4.2.0/`, `ready2use-2.4-4.1.0/`, `openmaint-2.4.2-4.2.0/` — the currently maintained variants. Each has `Dockerfile`, `docker-compose.yml`, `.env`, and `files/` (war, entrypoint, db config, tomcat config).
- `archive/` — unmaintained older versions; refer to `archive.md` for the tag/source mapping. Don't edit these.
- `docker-build.sh` — builds and tags all three active images (`itmicus/cmdbuild:4.2.0`, `r2u-2.4-4.1.0`, `om-2.4.2-4.2.0`).
- `README.md` is the primary usage doc; per-variant READMEs repeat the same commands.

## Non-obvious gotchas

- **The `.war` files are gitignored (`**/*.war`).** Every `Dockerfile` does `COPY files/*.war`, so images cannot be built from a fresh checkout until the war is dropped into `files/`. This is the #1 way builds fail for a new agent.
- **Run `docker compose` from inside the variant directory**, not from the repo root. Each compose file uses `${VAR}` substitutions that only resolve from that directory's local `.env` (and only cmdbuild/openmaint have a `.env`; ready2use hardcodes creds in its compose). `ready2use` has no pgadmin service.
- **`--wait` is required** in the documented flow, so Docker Compose must be ≥ 2.34.0.
- **Database is created only on the first container start.** `docker-entrypoint.sh` runs `cmdbuild.sh dbconfig create $CMDBUILD_DUMP` inside a `try`, and silently swallows the failure on later runs — so restarting the app container is always safe. To change the DB type or reload a different `CMDBUILD_DUMP`, you must first drop the DB manually (`dbconfig drop`).
- **The app container may stop after the first boot** because the JVM needs at least 3 GB (`JAVA_OPTS=-Xmx6000m -Xms3000m`) inside an 8 GB memory limit. Restart it, then wait for the `cmdbuild/ui` healthcheck.
- **Attachments-to-Postgres must be configured after boot** via three `docker exec` `setconfig` commands (`org.cmdbuild.dms.enabled false` → `service.type postgres` → `enabled true`). This is per-variant (container name differs: `cmdbuild_app` vs `openmaint_app`).
- **App DB user env var name differs per variant**: `CMDBUILD_DB_USER`/`CMDBUILD_DB_PASSWORD` (cmdbuild, openmaint) and `OPENMAINT_DB_USER`/`OPENMAINT_DB_PASSWORD` (openmaint's entrypoint), while ready2use's entrypoint hardcodes `db.username=cmdbuild`. The openmaint compose defaults `OPENMAINT_DB_USER` to `cmdbuild` to match.
- Containers and names are hardcoded (`container_name:`), so running multiple variants on the same host conflicts on ports (DB `5432`, app `8090`) — only one stack at a time.
