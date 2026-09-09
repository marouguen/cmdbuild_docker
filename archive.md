# Archived Versions

Unmaintained older Docker builds for CMDBuild, READY2USE, and openMAINT. These are frozen; don't edit anything under `archive/`. For the current releases, see [README.md](README.md).

All build contexts below live under `archive/` and are run from the repo root. There are two generations of `Dockerfile`, which differ in how the application war is obtained:

- **3.x-era builds (app 3.0–3.4.4, ready2use ≤ 2.0-3.3, openmaint ≤ 2.3-3.4.1-d)** — download the war from SourceForge at build time. They build from a fresh checkout with no extra files.
- **4.x-era builds (cmdbuild 4.0.0/4.1.0, ready2use-2.4-4.0.4, openmaint-2.4-4.0.4 / om-2.4-4.1.0)** — `COPY files/*.war` from a gitignored file, so you must drop the matching war into the variant's `files/` first or the build fails.

## CMDBuild application images

| Image | Build command |
|-------|---------------|
| `itmicus/cmdbuild:4.1.0` | `docker build -t itmicus/cmdbuild:4.1.0 archive/cmdbuild-4.1.0/.` |
| `itmicus/cmdbuild:4.0.0` | `docker build -t itmicus/cmdbuild:4.0.0 archive/cmdbuild-4.0.0/.` |
| `itmicus/cmdbuild:app-3.4.4` | `docker build -t itmicus/cmdbuild:app-3.4.4 archive/3.4.4/cmdbuild/.` |
| `itmicus/cmdbuild:app-3.4.2` | `docker build -t itmicus/cmdbuild:app-3.4.2 archive/3.4.2/cmdbuild/.` |
| `afcarvalho1991/cmdbuild:app-3.4.1` | `docker build -t afcarvalho1991/cmdbuild:app-3.4.1 archive/3.4.1/cmdbuild/.` |
| `afcarvalho1991/cmdbuild:app-3.4` | `docker build -t afcarvalho1991/cmdbuild:app-3.4 archive/3.4/cmdbuild/.` |
| `itmicus/cmdbuild:app-3.3` | `docker build -t itmicus/cmdbuild:app-3.3 archive/3.3/cmdbuild/.` |
| `itmicus/cmdbuild:app-3.2.1` | `docker build -t itmicus/cmdbuild:app-3.2.1 archive/3.2.1/cmdbuild/.` |
| `itmicus/cmdbuild:app-3.2` | `docker build -t itmicus/cmdbuild:app-3.2 archive/3.2/cmdbuild/.` |
| `itmicus/cmdbuild:app-3.1.1` | `docker build -t itmicus/cmdbuild:app-3.1.1 archive/3.1.1/cmdbuild/.` |
| `itmicus/cmdbuild:app-3.1` | `docker build -t itmicus/cmdbuild:app-3.1 archive/3.1/cmdbuild/.` |
| `itmicus/cmdbuild:db-3.0` | `docker build -t itmicus/cmdbuild:db-3.0 archive/3.0/postgres/.` |

`db-3.0` is the PostgreSQL image used by the 3.1–3.4.1 app stacks, `ready2use-2.0*`, and `openmaint-2.0-3.2*` compose files (later compose files use `postgis/postgis`). `3.0/` has no compose file.

## READY2USE images

| Image | Build command |
|-------|---------------|
| `itmicus/cmdbuild:r2u-2.4-4.0.4` | `docker build -t itmicus/cmdbuild:r2u-2.4-4.0.4 archive/ready2use-2.4-4.0.4/.` |
| `itmicus/cmdbuild:r2u-2.3-3.4.1-d` | `docker build -t itmicus/cmdbuild:r2u-2.3-3.4.1-d archive/ready2use-2.3-3.4.1-d/.` |
| `itmicus/cmdbuild:r2u-2.0-3.3` | `docker build -t itmicus/cmdbuild:r2u-2.0-3.3 archive/ready2use-2.0-3.3/.` |
| `itmicus/cmdbuild:r2u-2.0-3.2.1` | `docker build -t itmicus/cmdbuild:r2u-2.0-3.2.1 archive/ready2use-2.0-3.2.1/.` |
| `itmicus/cmdbuild:r2u-2.0-3.2` | `docker build -t itmicus/cmdbuild:r2u-2.0-3.2 archive/ready2use-2.0-3.2/.` |
| `itmicus/cmdbuild:r2u-2.0-3.1.1` | `docker build -t itmicus/cmdbuild:r2u-2.0-3.1.1 archive/ready2use-2.0-3.1.1/.` |
| `itmicus/cmdbuild:r2u-2.0` | `docker build -t itmicus/cmdbuild:r2u-2.0 archive/ready2use-2.0/.` |

## openMAINT images

| Image | Build command |
|-------|---------------|
| `itmicus/cmdbuild:om-2.4-4.1.0` | `docker build -t itmicus/cmdbuild:om-2.4-4.1.0 archive/openmaint-2.4-4.1.0/.` |
| `itmicus/cmdbuild:om-2.4-4.0.4` | `docker build -t itmicus/cmdbuild:om-2.4-4.0.4 archive/openmaint-2.4-4.0.4/.` |
| `itmicus/cmdbuild:om-2.3-3.4.1-d` | `docker build -t itmicus/cmdbuild:om-2.3-3.4.1-d archive/openmaint-2.3-3.4.1-d/.` |
| `afcarvalho1991/cmdbuild:om-2.3-3.4.1-d` | `docker build -t afcarvalho1991/cmdbuild:om-2.3-3.4.1-d archive/openmaint-2.3-3.4.1-d/.` |
| `itmicus/cmdbuild:om-2.0-3.3` | `docker build -t itmicus/cmdbuild:om-2.0-3.3 archive/openmaint-2.0-3.3/.` |
| `itmicus/cmdbuild:om-2.0-3.2.1` | `docker build -t itmicus/cmdbuild:om-2.0-3.2.1 archive/openmaint-2.0-3.2.1/.` |
| `itmicus/cmdbuild:om-2.0-3.2` | `docker build -t itmicus/cmdbuild:om-2.0-3.2 archive/openmaint-2.0-3.2/.` |
| `afcarvalho1991/cmdbuild:om-2.1-3.3-b` | `docker build -t afcarvalho1991/cmdbuild:om-2.1-3.3-b archive/openmaint-2.1-3.3-b/.` |

The `openmaint-2.3-3.4.1-d/` compose file references the `afcarvalho1991` image; the `itmicus` variant is the same source built under a different account.

## Deploy

Every directory except `3.0/` carries a `docker-compose.yml`. Build the images first (the compose files reference the tags above), then run from the repo root:

```bash
docker compose -f archive/<dir>/docker-compose.yml up -d
```

Notes:

- The archived compose files are older (schema `version: "2.4"`) and use the same fixed container names and port `8090` as the current variants — run one stack at a time.
- First-boot caveats from the main README apply: the app container may stop once after the initial DB load — restart it.