# CMDBuild 4.2.0 with READY2USE 2.4 and openMAINT 2.4 in Docker

![cmdbuild_logo](https://www.tecnoteca.com/immagini/logo_cmdbuild.png/@@images/bf2e13f9-7a90-4e41-ba76-cf8fe5a87d50.png)

[CMDBuild](http://www.cmdbuild.org/en) — web environment for configuring custom solutions for IT Governance and asset management.
[READY2USE](http://www.cmdbuild.org/en/prodotti/ready2use) — pre-configured CMDBuild, ready for production.
[openMAINT](http://www.openmaint.org) — open source Property & Facility Management solution (buildings, installations, movable assets, maintenance).

This is the **unofficial** repository with all versions of CMDBuild.
Please open issues on [GitHub](https://github.com/itmicus/cmdbuild_docker/issues).

---

## Table of Contents

- [Requirements](#requirements)
- [Which variant?](#which-variant)
- [Deploy with docker compose](#deploy-with-docker-compose)
- [Connect & credentials](#connect--credentials)
- [Environment variables](#environment-variables)
- [Troubleshooting](#troubleshooting)
- [Build images locally](#build-images-locally)
- [Changelog](#changelog)

---

## Requirements

- **Docker Compose ≥ 2.34.0** — the documented flow uses `docker compose up -d --wait`, which requires this version.
- **At least 8 GB RAM** for the app container (Tomcat/JVM reserves 3 GB minimum).

## Which variant?

| Variant | Directory | Base CMDBuild | Notes |
|---------|-----------|---------------|-------|
| **CMDBuild** | `cmdbuild-4.2.0/` | 4.2.0 | Plain CMDBuild with demo DB + pgAdmin |
| **READY2USE** | `ready2use-2.4-4.1.0/` | 4.1.0 | Pre-configured; no `.env`, no pgAdmin service |
| **openMAINT** | `openmaint-2.4.2-4.2.0/` | 4.2.0 | Property & Facility Management + pgAdmin |

Only **one variant** can run at a time: all containers use fixed names and the same host ports (`5432` for Postgres, `8090` for the app, `5050` for pgAdmin). Stop the current stack before starting another.

---

## Deploy with docker compose

The images are pulled from Docker Hub (`itmicus/cmdbuild:*`). Each compose file resolves `${VAR}` from its own directory's `.env`, so **run every command from inside the variant directory**.

### CMDBuild 4.2.0 (demo database)

```bash
cd cmdbuild-4.2.0
docker compose up -d --wait

# configure attachments to PostgreSQL (required once per stack)
docker exec -it cmdbuild_app /usr/local/tomcat/webapps/cmdbuild/cmdbuild.sh restws setconfig org.cmdbuild.dms.enabled false
docker exec -it cmdbuild_app /usr/local/tomcat/webapps/cmdbuild/cmdbuild.sh restws setconfig org.cmdbuild.dms.service.type postgres
docker exec -it cmdbuild_app /usr/local/tomcat/webapps/cmdbuild/cmdbuild.sh restws setconfig org.cmdbuild.dms.enabled true
```

Open http://localhost:8090/cmdbuild/ui/

### openMAINT 2.4.2 (demo database)

```bash
cd openmaint-2.4.2-4.2.0
docker compose up -d --wait

# configure attachments to PostgreSQL (required once per stack)
docker exec -it openmaint_app /usr/local/tomcat/webapps/cmdbuild/cmdbuild.sh restws setconfig org.cmdbuild.dms.enabled false
docker exec -it openmaint_app /usr/local/tomcat/webapps/cmdbuild/cmdbuild.sh restws setconfig org.cmdbuild.dms.service.type postgres
docker exec -it openmaint_app /usr/local/tomcat/webapps/cmdbuild/cmdbuild.sh restws setconfig org.cmdbuild.dms.enabled true
```

Open http://localhost:8090/cmdbuild/ui/

### READY2USE 2.4 (CMDBuild 4.1.0)

```bash
cd ready2use-2.4-4.1.0
docker compose up -d --wait
```

Open http://localhost:8090/cmdbuild/ui/
READY2USE ships with the **demo database by default** (`CMDBUILD_DUMP` is already `demo.dump.xz`). It has no pgAdmin service.

**Switching the database dump** (`demo.dump.xz` / `empty.dump.xz` / `test.dump.xz`): `CMDBUILD_DUMP` is hardcoded in each `docker-compose.yml`, so edit that line. The DB is only created on the *first* container start, so after changing it you must also drop the old database first — see [Troubleshooting](#troubleshooting).

---

## Connect & credentials

Default credentials for all variants (change them before production use):

| Service | URL | Login | Password |
|---------|-----|-------|----------|
| **CMDBuild / openMAINT / READY2USE** | http://localhost:8090/cmdbuild/ui | `admin` | `admin` |
| **Demo users** (CMDBuild) | — | `demouser` / `guest` | `demouser` / `guest` |
| **PostgreSQL (DB)** | `localhost:5432` | `postgres` | `postgres` |
| **pgAdmin** (cmdbuild & openmaint only) | http://localhost:5050 (localhost only) | `admin@example.com` | `admin` |
| **Tomcat Manager** (READY2USE only) | http://localhost:8090/manager | `admin` | `password` |

> The CMDBuild and openMAINT images **remove the Tomcat Manager app** for security; it only exists in the READY2USE image.

---

## Environment variables

### cmdbuild-4.2.0 and openmaint-2.4.2-4.2.0 (`.env`)

| Variable | Default (cmdbuild / openmaint) | Description |
|----------|--------------------------------|-------------|
| `POSTGRES_USER` | `postgres` | PostgreSQL superuser |
| `POSTGRES_PASSWORD` | `postgres` | PostgreSQL superuser password |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `POSTGRES_HOST` | `cmdbuild_db` / `openmaint_db` | PostgreSQL hostname |
| `POSTGRES_DB` | `cmdbuild_4` / `openmaint` | CMDBuild database name |
| `CMDBUILD_DB_USER` / `CMDBUILD_DB_PASSWORD` | `cmdbuild` | CMDBuild app DB user (cmdbuild only) |
| `OPENMAINT_DB_USER` / `OPENMAINT_DB_PASSWORD` | `openmaint` | CMDBuild app DB user (openmaint only) |
| `JAVA_OPTS` | `-Xmx6000m -Xms3000m` | JVM options for Tomcat |
| `PGADMIN_DEFAULT_EMAIL` / `PGADMIN_DEFAULT_PASSWORD` | `admin@example.com` / `admin` | pgAdmin login |

READY2USE has no `.env` — DB creds and `CMDBUILD_DUMP` are hardcoded in `ready2use-2.4-4.1.0/docker-compose.yml`.

### Change credentials

- `.env` — all database/app/pgAdmin credentials (cmdbuild & openmaint)
- `docker-compose.yml` — READY2USE credentials and any `CMDBUILD_DUMP` change
- `files/tomcat-users.xml` — Tomcat Manager user (only used by READY2USE)
- `files/context.xml` — Tomcat datasource/manager context

### `CMDBUILD_DUMP` values

| Variant | Available dumps |
|---------|-----------------|
| CMDBuild 4.2.0 | `demo.dump.xz`, `empty.dump.xz`, `test.dump.xz` |
| openMAINT 2.4.2 | `demo.dump.xz`, `empty.dump.xz` |
| READY2USE 2.4 | `demo.dump.xz`, `empty.dump.xz` |

---

## Troubleshooting

- **The app container may stop after the first boot.** The JVM reserves 3 GB (`-Xmx6000m -Xms3000m`) inside the 8 GB container limit, so it can be restarted after the initial DB load. Restart it (`docker compose restart cmdbuild_app` / `openmaint_app`), then wait for the `http://localhost:8080/cmdbuild/ui` healthcheck.
- **The database is only created on the first container start.** `docker-entrypoint.sh` runs `dbconfig create $CMDBUILD_DUMP` in a `try` block and silently swallows errors on later runs, so restarting the app container is always safe. To load a different `CMDBUILD_DUMP` or change the DB type, drop the existing DB first:
  ```bash
  docker compose exec cmdbuild_app /usr/local/tomcat/webapps/cmdbuild/cmdbuild.sh dbconfig drop -configfile /usr/local/tomcat/conf/cmdbuild/database.conf
  ```
  (substitute `openmaint_app` for openMAINT)
- **"Postgres is unavailable - sleeping"** in the app logs means the DB isn't ready yet — the entrypoint waits for port 5432, but the DB healthcheck may still take a couple of minutes.

---

## Build images locally

Not required to deploy (images are pulled from Docker Hub), but useful to test local changes:

```bash
sh docker-build.sh
# builds and tags itmicus/cmdbuild:4.2.0, itmicus/cmdbuild:r2u-2.4-4.1.0, itmicus/cmdbuild:om-2.4.2-4.2.0
```

> Each `Dockerfile` does `COPY files/*.war`, and the `.war` files are **gitignored (`**/*.war`)**. Images cannot be built from a fresh checkout until you place the war file in the variant's `files/` directory. This only matters if you build locally — `docker compose up` uses prebuilt Hub images.

Archived older versions live in `archive/` — see `archive.md` for the tag/source mapping. Don't edit them.

---

## Changelog

| Date | Updates |
|------|---------|
| **31/07/2026** | Add to openMAINT 2.4.2 on CMDBuild 4.2.0 with configure attachments to postgres. |
| **13/07/2026** | Add to CMDBuild 4.2.0 configure attachments to postgres. |
| **08/07/2026** | Add CMDBuild 4.2.0 — @itmicus. Minimum Docker Compose version v2.34.0. Added PGAdmin for managing CMDBuild DB. |
| **21/10/2025** | Add CMDBuild 4.1.0, READY2USE 2.4 (on CMDBuild 4.1.0), openMAINT 2.4 (on CMDBuild 4.1.0). Refactoring, up to PostgreSQL 17 / Tomcat 11 — @itmicus. |
| **21/10/2025** | Add CMDBuild 4.0.0, READY2USE 2.4 (on CMDBuild 4.0.4), openMAINT 2.4 (on CMDBuild 4.0.4). Refactoring, up to PostgreSQL 17 / Tomcat 11 — @itmicus. |
| **06/08/2023** | Add CMDBuild 3.4.2, READY2USE 2.3 (on CMDBuild 3.4.1) — @itmicus. |
| **21/02/2023** | Add CMDBuild 3.4, CMDBuild 3.4.1, and openMAINT 3.2 (on CMDBuild 3.4.1) — @afcarvalho1991 and @quinont contribution. |
| **29/12/2020** | Add openMAINT 2.1 on CMDBuild 3.3b — @afcarvalho1991 contribution. |
| **12/10/2020** | Add CMDBuild 3.3, READY2USE 2.0 and openMAINT 2.0 on CMDBuild 3.2.1 — @afcarvalho1991 contribution. |
| **11/06/2020** | Add CMDBuild 3.2.1, READY2USE 2.0 and openMAINT 2.0 on CMDBuild 3.2. |
| **19/02/2020** | Add CMDBuild 3.2, READY2USE 2.0 and openMAINT 2.0 on CMDBuild 3.2. |
| **27/10/2019** | Add CMDBuild 3.1.1, READY2USE 2.0 and openMAINT 2.0 on CMDBuild 3.1.1. |
| **04/08/2019** | Add READY2USE 2.0 and openMAINT 2.0. |
| **12/07/2019** | Add CMDBuild 3.1 with old version READY2USE (still waiting 2.0). |
