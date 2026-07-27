---
title: 'Backend Architecture Design Review: Map & Routing Platform'
description: 'A rigorous review of a self-hosted OSM map, editing, QC, routing, and tile-serving backend — its app boundaries, decided constraints, risks, and recommendations.'
pubDate: 'Jul 27 2026'
---

> This review was produced by an autonomous collaboration between two coding agents (Anthropic Claude drafting and OpenAI Codex ratifying), grounded strictly in a supplied architecture diagram and requirements list, and converging on a single aligned document.

The Map & Routing Platform is a self-hosted, OSM-based backend for map editing, quality control, routing, search, and tile serving. Its architecture centers on one authoritative Editor DB, followed by independent routing and tile validation and export paths.

This review distinguishes decided constraints from recommendations. Where the source material does not assign schema ownership, persistence, or operational behavior, that absence is identified rather than filled with an assumed component.

## System Summary

The principal flows are:

```text
Editing and QC
  Ops Portal -> MapOps Gateway -> (proxy OSM API)
    -> Editing Engine Layer (Rails Port, CGImap, conflation engine)
    -> (tagged changeset) -> Editor DB

  Geofabrik community data
    -> PBF baseline (osmosis) + daily OSC diffs (osmium/pyosmium)
    -> Editor DB

  Editor DB -> Routing QC & Topology  -> gates routing publish
  Editor DB -> Map Tile QC & Geometry -> gates tile publish

Export and serving
  Editor DB -> Map Sync Worker
    -> Object Storage (S3/R2, static PMTiles)
    -> Tile Serving DB (PostgreSQL + PostGIS)
    -> Routing Serving Data (Valhalla routing tiles)
    -> OpenSearch core index
  Serving services: Martin Tile Server, Valhalla Routing & ETA (tiles in tmpfs/RAM),
    Geocoding & POI Search, Search Query Enricher (Vietnamese NLU/NLP)

Client edge
  Edge API / BFF -> Keycloak (auth token)
                 -> User Profile DB (user data)
                 -> B2B Partner DB (verify quota)
                 -> serving services

Telemetry
  Edge API -> Redpanda event stream -> Telemetry Ingest Worker -> ClickHouse (Analytics DB)
```

Mobile and automotive clients, including their MapLibre render engine and PMTiles client library, are outside the backend repository. The Map Data Editor (JOSM / iD / Rapid) and the Ops Portal QA/QC UI are also external frontends. Production release-control resources live separately in `mobility-deployment`.

## Decided Architectural Constraints

### One Authoritative Editor apidb

The Editor DB is a single persistent OSM apidb implemented with PostgreSQL and PostGIS. It receives both private team-tagged changesets and community map updates.

A dual-apidb design, with separate databases for routing and tiles, was explicitly rejected. This avoids two independently evolving versions of the same OSM source data, but concentrates write availability and downstream read load in one database.

"Single apidb" is a logical data-ownership decision: there is one authoritative source and one OSM element-version history. The architecture must preserve that property.

### Split at QC and Export Time

Routing and tile-specific processing diverge only after data has entered the Editor DB. Routing topology checks, rendering checks, Valhalla builds, PMTiles generation, and tile-serving imports belong downstream of the common source.

Routing- or rendering-specific copies must not become competing editing authorities.

### Independent Routing and Tile Gates

The Routing QC worker independently gates routing publication. The Tile QC worker independently gates tile publication. The two paths have separate release cadences.

This prevents a tile-quality failure from unnecessarily blocking routing artifacts, or a routing-topology failure from blocking tile publication. It also permits production routing and tile artifacts to represent different Editor DB states.

### Separate Production Deployment Control

The backend repository owns application code and app-owned deploy packages. Production release-control resources belong in `mobility-deployment` and reference those packages.

The ownership line should remain explicit: this repository defines how an application is packaged and promoted; `mobility-deployment` controls production invocation and approval.

## Required Application Boundaries

### Edge API / BFF

#### Responsibilities

The Edge API owns the contract presented to mobile and automotive clients and orchestrates requests to backend services. It must preserve compatibility with lagging client releases.

Its in-process domain modules cover:

- Authentication and quota rules
- Search fallback
- Telemetry validation

The Edge API also publishes telemetry to Redpanda and communicates with map, routing, search, identity, profile, and partner-data services. The architecture additionally states that the Edge API authenticates operators against Keycloak, which overlaps with the MapOps operator-identity boundary and is discussed under Keycloak coupling below.

#### Schema and Migrations

No Edge API-owned persistent schema is specified. Durable user and organization data belongs in the User Profile DB and B2B Partner DB respectively.

#### Neighbor Contracts

The Edge API contracts with:

- Keycloak for authentication tokens and sessions
- User Profile DB for favorites and preferences
- B2B Partner DB for organization settings and quota checks
- Map, routing, and search serving services
- Redpanda for telemetry events
- Mobile and automotive clients through a backward-compatible public contract

Compatibility includes more than HTTP response fields. PMTiles layer names, attributes, zoom behavior, artifact addressing, and routing semantics can also be compiled into lagging clients.

### Keycloak Token-Validation Boundary

#### Responsibilities

Keycloak supplies:

- B2C user sessions
- B2B organization tokens
- Keycloak-backed operator identity for MapOps

The backend requires a visible implementation boundary for validating these token classes. Authentication must remain separate from the MapOps custom authorization model.

#### Schema and Migrations

The source does not assign Keycloak schema or realm migrations to an application boundary. The backend does own the code and configuration that interpret Keycloak tokens.

#### Neighbor Contracts

Token validation must define:

- Accepted issuers and audiences
- Token-type distinctions
- Required claims and scopes
- Signing-key retrieval and refresh behavior
- Expiration and clock-skew handling
- Behavior when Keycloak is unavailable

The Edge API and MapOps Gateway should consume consistent validation behavior so their security rules do not drift.

### User Profile DB

#### Responsibilities

The User Profile DB owns favorites and preferences and the associated application behavior.

#### Schema and Migrations

Its schema and migrations are explicitly app-owned. Changes should be deployed through the application boundary that implements its API behavior.

#### Neighbor Contracts

The Edge API is the stated consumer. Other components should use the Edge API contract rather than couple directly to the profile schema.

References from favorites to map entities require stable identifiers or documented handling when those entities change or disappear.

### B2B Partner DB

#### Responsibilities

The B2B Partner DB owns:

- Organization settings
- Quota checks
- Associated application behavior

#### Schema and Migrations

Its schema and migrations are explicitly app-owned.

#### Neighbor Contracts

The Edge API verifies quota and reads organization settings through this boundary. The relationship between a Keycloak B2B token and a partner record must be stable and unambiguous.

The requirements specify quota checks but do not define whether this database also owns request accounting. That behavior must be resolved before implementation because distributed Edge API instances cannot enforce a global usage counter using local state alone.

### MapOps Backend / Editing Gateway

#### Responsibilities

MapOps is the operator-identity and editing-policy boundary. It provides:

- Keycloak-backed operator authentication
- A custom authorization model
- Edit safeguards
- POI orchestration
- Smart proxying of OSM API operations

It is the decided gateway to Rails Port and CGImap.

#### Schema and Migrations

No MapOps-owned persistent schema is required by the source. If its authorization model, safeguards, or audit records require persistence, ownership and migrations must be assigned explicitly rather than placed implicitly in the Editor DB.

#### Neighbor Contracts

Upstream, MapOps receives operations edits from the Ops Portal.

Downstream, it proxies to the Editing Engine Layer:

- Rails Port, providing the full OSM Rails Web API
- CGImap, providing the C++ high-performance OSM read/write API
- The conflation engine, which also resides in that layer

Rails Port and CGImap are both OSM API-compatible and write tagged changesets to the Editor DB. Direct access that bypasses MapOps would bypass its authorization and safeguards, so deployment boundaries must preserve the gateway as the editing entry point.

### Editor DB and Community Ingestion

#### Responsibilities

The Editor DB is the canonical map-editing authority. It must support:

- Initial Geofabrik PBF baseline import through osmosis
- Daily OSC diff application through osmium or pyosmium
- A state file tracking replication sequence
- Private team-tagged changesets
- A conflict queue table for version mismatches between incoming community diffs and team-tagged changesets
- An Ops Portal reviewer workflow to clear the queue
- An export prohibition while the conflict queue remains uncleared

#### Schema and Migrations

The boundary owns the OSM apidb schema and the required local additions, including team-tagging and the conflict queue.

Schema changes must remain compatible with Rails Port and CGImap. Local extensions should be clearly isolated from third-party-owned apidb structures and tested against upgrades of both editing engines.

#### Neighbor Contracts

Inbound contracts include:

- Tagged changesets from Rails Port and CGImap
- Baseline PBF data from Geofabrik
- Incremental OSC replication diffs
- Reviewer decisions from the Ops Portal workflow

Outbound contracts include read access for:

- Routing QC
- Tile QC
- Map Sync Worker after the applicable gates pass

The export gate must be enforced by backend execution, not merely represented as an Ops Portal convention. An export must not proceed while required conflict review is incomplete.

### Routing QC and Topology Validation Worker

#### Responsibilities

This worker validates navigation safety and network topology using Osmose and KeepRight. Its pass/fail result independently controls routing artifact publication.

It requires its own app boundary and workflow descriptor.

#### Schema and Migrations

No persistent schema is specified. If validation results are stored, ownership and migrations should belong to this worker rather than the Editor DB.

#### Neighbor Contracts

The worker reads the Editor DB through a read-only contract and emits a routing-specific gate result consumed by the routing export path.

A gate result must identify the exact Editor DB state it validated. A result that only says "passed" is unsafe if further changes can occur before export.

### Map Tile QC and Geometry Validation Worker

#### Responsibilities

This worker validates:

- Geometry
- Rendering behavior
- Custom map-layer quality

It uses Atlas and Osmose, and its pass/fail result independently controls tile-serving publication. It requires its own app boundary and workflow descriptor.

#### Schema and Migrations

No persistent schema is specified. Any stored workflow state or results should be owned by this worker.

#### Neighbor Contracts

The worker reads the Editor DB through a read-only contract and emits a tile-specific gate result consumed by the tile export path.

Although both QC workers may use Osmose, their workflow descriptors and gate decisions must remain independent.

### Map Sync Worker

#### Responsibilities

The Map Sync Worker is the export fan-out boundary. It produces or imports:

- PBF
- PMTiles
- Valhalla routing bundles
- Routing-serving artifacts
- Tile-serving imports
- Search indexes

Routing and tile publication run on independent cadences and consume their respective QC decisions.

#### Schema and Migrations

No map truth is owned here. The worker should own its export-job metadata and artifact provenance if those records are persisted.

For the Tile Serving DB and the OpenSearch core index, the architecture does not explicitly assign schema or index-migration ownership. Because the Map Sync Worker creates those representations, their contracts and migration procedures should be owned alongside its import logic.

#### Neighbor Contracts

The worker:

- Reads an exportable state from the Editor DB
- Consumes routing and tile QC outcomes
- Writes immutable files to object storage
- Builds Valhalla routing data
- Imports tile layers into PostgreSQL/PostGIS
- Builds the OpenSearch core index

The requirements name routing and tile gates but do not state which gate authorizes search-index publication. That contract must be made explicit without introducing a competing map source.

### Martin Tile Server

#### Responsibilities

Martin serves dynamic vector tiles and live overlays from the Tile Serving DB.

A local-development and deployment boundary is required if dynamic tiles and overlays remain in scope.

#### Schema and Migrations

Martin owns no schema in the source design. It consumes the Tile Serving DB representation produced by the Map Sync Worker.

The owner of that representation must provide compatible migrations and a local dataset or import procedure against which Martin can be tested.

#### Neighbor Contracts

Martin reads PostgreSQL/PostGIS and serves dynamic vector-tile responses. Its contract includes database objects, layer names, attributes, geometry types, and zoom-dependent behavior.

Publishing tile-serving imports must not expose partially imported data to Martin.

### Production Object Storage

#### Responsibilities

Production object storage (S3/R2) holds static PMTiles and must provide:

- Immutable artifact keys
- Checksums
- Release-bundle pointers
- Promotion scripts
- Rollback scripts

#### Schema and Migrations

There is no relational schema. The equivalent contract is the artifact-key and release-manifest format, which must be versioned and app-owned.

#### Neighbor Contracts

The Map Sync Worker writes artifacts and metadata. Production release control promotes or rolls back bundle pointers through resources in `mobility-deployment`.

Because routing and tile publication are independent, their release identity and promotion state must also be independently representable.

## Adjacent Components Without an Explicit Required Boundary

The requirements enumerate boundaries for editing, QC, export, tile serving, storage, and identity, but three parts of the diagram receive no equivalent statement. They are in scope for the backend repository, so their ownership should be settled rather than left implicit.

### Telemetry Ingestion

The Edge API publishes telemetry to the Redpanda event stream; the Telemetry Ingest Worker validates and batches events into ClickHouse, the Analytics DB. Telemetry validation therefore appears twice — as an in-process Edge API module and again in the ingest worker. Which validation is authoritative, and what happens to events that pass the first check and fail the second, needs a defined answer. The ClickHouse table schema and its migration ownership are unassigned.

### Search Serving

Geocoding and POI Search serves the OpenSearch core index built by the Map Sync Worker, and the Search Query Enricher supplies Vietnamese NLU/NLP. Index mapping changes are a compatibility surface shared between the index builder and the query path, and the enricher's behavior is part of the search results lagging clients receive.

### Routing Serving

Valhalla Routing and ETA serves routing tiles from tmpfs or RAM. That makes routing promotion different in kind from an object-storage pointer swap: publishing a new routing bundle implies a memory-resident dataset reload, so capacity, warm-up, and rollback of the in-memory generation all belong to the routing release procedure.

## Principal Risks and Trade-offs

### Single-Master Editor DB

The single Editor DB protects source consistency but is both a bottleneck and a single point of failure.

It receives operator edits and community diffs while supporting QC and export reads. Failure blocks editing, ingestion, validation, and new publication. Long-running QC or export work can also interfere with write latency and database maintenance.

The mitigation must preserve one logical apidb and one write authority.

### Conflict-Queue Correctness

Community diffs and private changesets can modify the same OSM entities from different histories. Detecting a version mismatch is only the beginning; the system also needs deterministic resolution semantics.

Important cases include:

- Concurrent tag changes
- Geometry changes
- Relation-membership changes
- Local or upstream deletion
- Replayed diffs
- Reviewer retries
- A crash during resolution

A conflict queue implemented only as a table, without an explicit state machine and audit history, is unlikely to preserve correctness.

### Replication State-File Durability

The replication state file and Editor DB are separate durability domains. A crash between applying a diff and updating the file can cause either replay or a skipped sequence, depending on operation ordering.

Loss of the file can also make the current replication position uncertain. Its storage, backup, update protocol, and reconciliation with database contents are therefore correctness concerns, not worker-local implementation details.

### Routing and Tile Version Skew

Independent gates intentionally permit routing and tile artifacts to represent different Editor DB states. Users may see a road that is not routable or receive a route over geometry not yet visible in tiles. Search results add a third clock, since no gate is assigned to index publication.

The architecture should bound and expose this skew rather than incorrectly assume all channels advance together.

### Lagging-Client Compatibility

The compatibility obligation covers:

- Edge API request and response formats
- PMTiles layer and attribute schemas
- Artifact URLs and retained bundle generations
- Routing response behavior
- Search behavior used by released clients

Without a support matrix and contract tests, compatibility becomes dependent on individual developer memory.

### Keycloak Coupling

Keycloak participates in consumer identity, B2B identity, and operator identity. An outage or key-rotation error can therefore affect multiple platform surfaces simultaneously.

A second risk is validator drift. The architecture places operator authentication against Keycloak in both the Edge API and MapOps, so two components can interpret issuer, audience, scopes, or token types differently and produce inconsistent authorization behavior.

### Release-Control Ownership

Application packages and production control intentionally live in different repositories. Ambiguous ownership at this boundary can allow package behavior and production automation to evolve incompatibly.

Only the deployment control path should possess authority to promote production pointers.

## Recommendations

### Establish End-to-End Release Identity

Assign every exportable Editor DB state an immutable identity. Record that identity in:

- Routing and tile QC results
- Map Sync jobs
- Artifact manifests
- Release-bundle pointers
- Operational diagnostics

The Map Sync Worker should publish only when the matching QC result applies to the exact exported state. Manifests should include artifact checksums and the authorizing gate result.

### Specify the Conflict Queue as a State Machine

Define queue states, transitions, retry behavior, and reviewer actions. Record the affected OSM entity, incoming and current versions, resolution, reviewer identity, timestamp, and rationale.

Make queue clearance an exporter-enforced precondition, as required. Test tag, geometry, relation, deletion, replay, and interrupted-resolution cases.

### Harden Replication Checkpointing

Place the replication state file on durable, backed-up storage. Define one crash-safe ordering for database commit and checkpoint advancement, and add startup reconciliation that detects disagreement before another diff is applied.

Diff processing should be retry-safe, and sequence gaps or regressions should stop ingestion and raise an alert.

### Protect the Editor DB

Define high availability, backup, point-in-time recovery, and tested restoration for the single authoritative apidb. Use read-only roles for QC and export consumers, schedule heavy work deliberately, and monitor its effect on edit latency and maintenance.

Any physical scaling strategy must retain one logical database and one write authority.

### Make Independent Publication Observable

Maintain separate routing, tile, and search release pointers. Expose their source identities and alert when skew exceeds an agreed operational limit.

Do not force synchronized publication, because that would undo the decided independent-gate model. Instead, make divergence measurable and reversible.

### Formalize Client Compatibility

Publish a supported-client matrix and require additive evolution within its window. Version PMTiles schemas and retain immutable artifact generations while supported clients reference them.

Add contract tests for the oldest supported client behavior, including API payloads, tile layers and attributes, routing responses, and artifact resolution.

### Centralize Keycloak Validation Behavior

Provide one versioned validation implementation or specification consumed by the Edge API and MapOps. Cover B2C, B2B, and operator tokens explicitly, and state which component is authoritative for operator authentication.

Cache signing keys safely, test key rotation, and document outage behavior. Existing read sessions may use bounded cached validation where acceptable, while editing and authorization-sensitive writes should fail closed when identity cannot be established.

### Make Serving Promotions Atomic

For object storage, promote only by changing validated release-bundle pointers; never mutate published artifact keys.

For the Tile Serving DB, define an import and promotion procedure that prevents Martin from observing partial data and permits rollback to the previous complete representation.

For Valhalla, treat the memory-resident tile generation as part of the release: size capacity for holding a new generation alongside the current one where possible, warm before cutover, and keep the previous bundle available for rollback.

### Resolve Search and Telemetry Ownership

Assign search-index publication to an existing release path and document which Editor DB state and QC result authorize it. The search index must carry the same provenance as routing and tile artifacts even if no additional QC worker is introduced. Index mapping changes should be owned and versioned alongside the query-path components that depend on them.

For telemetry, designate one authoritative validation contract shared by the Edge API module and the Telemetry Ingest Worker, define handling for events rejected downstream, and assign ClickHouse schema and migration ownership to the ingest boundary.

### Enforce the Repository Boundary

Keep deploy-package implementation in the backend repository and production invocation, approval, and credentials in `mobility-deployment`. Test the interface between them and version it when package inputs or manifest formats change.

## Verdict

The core architecture is coherent. One authoritative apidb avoids competing map histories, while the QC and export split permits routing and tile products to evolve independently. The MapOps gateway provides the correct policy boundary for operator edits, and separate production deployment control creates a defensible release boundary.

The design's largest gaps are enforcement and ownership details: tying QC to the exact exported state, making replication checkpoints crash-safe, defining conflict resolution as an auditable workflow, assigning the unstated boundaries around search and telemetry, and maintaining compatibility with deployed clients. Addressing those gaps preserves the decided architecture while making its correctness and operational behavior verifiable.
