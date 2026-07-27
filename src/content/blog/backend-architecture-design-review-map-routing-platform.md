---
title: 'Backend Architecture Design Review: Map & Routing Platform (EN/VI)'
description: 'A rigorous EN/VI bilingual review of a self-hosted OSM map, editing, QC, routing, and tile-serving backend — its app boundaries, decided constraints, risks, and recommendations.'
pubDate: 'Jul 27 2026'
updatedDate: 'Jul 27 2026'
---

> This review was produced by an autonomous collaboration between two coding agents (Anthropic Claude drafting and OpenAI Codex ratifying), grounded strictly in a supplied architecture diagram and requirements list, and converging on a single aligned document. This edition is bilingual: each English block is followed by its Vietnamese translation in a quoted block.
>
> **VI —** Bài đánh giá này được tạo ra bởi sự cộng tác tự động giữa hai tác nhân lập trình (Claude của Anthropic soạn thảo và Codex của OpenAI phê duyệt), dựa hoàn toàn trên sơ đồ kiến trúc và danh sách yêu cầu được cung cấp, và hội tụ về một tài liệu thống nhất duy nhất. Bản này song ngữ: mỗi đoạn tiếng Anh được theo sau bởi bản dịch tiếng Việt trong khối trích dẫn.

The Map & Routing Platform is a self-hosted, OSM-based backend for map editing, quality control, routing, search, and tile serving. Its architecture centers on one authoritative Editor DB, followed by independent routing and tile validation and export paths.

> **VI —** Map & Routing Platform là một backend tự vận hành (self-hosted), dựa trên OSM, phục vụ việc chỉnh sửa bản đồ, kiểm soát chất lượng (QC), định tuyến, tìm kiếm và cung cấp tile. Kiến trúc của nó lấy một Editor DB có thẩm quyền duy nhất làm trung tâm, theo sau là các luồng kiểm định và xuất bản (export) cho định tuyến và tile hoạt động độc lập với nhau.

This review distinguishes decided constraints from recommendations. Where the source material does not assign schema ownership, persistence, or operational behavior, that absence is identified rather than filled with an assumed component.

> **VI —** Bài đánh giá này phân biệt rõ giữa các ràng buộc đã được quyết định và các khuyến nghị. Ở những chỗ tài liệu nguồn không chỉ định quyền sở hữu schema, cơ chế lưu trữ (persistence), hay hành vi vận hành, phần thiếu hụt đó được nêu ra thay vì tự ý bổ sung bằng một thành phần giả định.

## System Summary — Tổng quan hệ thống

The principal flows are:

> **VI —** Các luồng chính như sau:

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

> **VI —** Các client di động và ô tô (automotive), bao gồm cả engine dựng hình MapLibre và thư viện client PMTiles của chúng, nằm ngoài repository backend. Trình chỉnh sửa dữ liệu bản đồ (JOSM / iD / Rapid) và giao diện QA/QC của Ops Portal cũng là các frontend bên ngoài. Các tài nguyên kiểm soát phát hành (release-control) trên production nằm riêng trong `mobility-deployment`.

## Decided Architectural Constraints — Các ràng buộc kiến trúc đã quyết định

### One Authoritative Editor apidb — Một apidb Editor có thẩm quyền duy nhất

The Editor DB is a single persistent OSM apidb implemented with PostgreSQL and PostGIS. It receives both private team-tagged changesets and community map updates.

> **VI —** Editor DB là một OSM apidb bền vững (persistent) duy nhất, hiện thực bằng PostgreSQL và PostGIS. Nó nhận cả các changeset gắn thẻ của đội nội bộ (team-tagged) lẫn các cập nhật bản đồ từ cộng đồng.

A dual-apidb design, with separate databases for routing and tiles, was explicitly rejected. This avoids two independently evolving versions of the same OSM source data, but concentrates write availability and downstream read load in one database.

> **VI —** Thiết kế dùng hai apidb, tức tách riêng cơ sở dữ liệu cho định tuyến và cho tile, đã bị bác bỏ một cách rõ ràng. Cách này tránh được việc tồn tại hai phiên bản tiến hóa độc lập của cùng một dữ liệu nguồn OSM, nhưng lại dồn khả năng ghi (write) và tải đọc (read) phía sau vào một cơ sở dữ liệu duy nhất.

"Single apidb" is a logical data-ownership decision: there is one authoritative source and one OSM element-version history. The architecture must preserve that property.

> **VI —** "apidb duy nhất" là một quyết định về quyền sở hữu dữ liệu ở mức logic: chỉ có một nguồn có thẩm quyền và một lịch sử phiên bản phần tử OSM. Kiến trúc phải bảo toàn đặc tính này.

### Split at QC and Export Time — Tách nhánh tại thời điểm QC và Export

Routing and tile-specific processing diverge only after data has entered the Editor DB. Routing topology checks, rendering checks, Valhalla builds, PMTiles generation, and tile-serving imports belong downstream of the common source.

> **VI —** Việc xử lý riêng cho định tuyến và cho tile chỉ tách nhánh sau khi dữ liệu đã đi vào Editor DB. Các bước kiểm tra topology định tuyến, kiểm tra dựng hình (rendering), build Valhalla, tạo PMTiles, và import phục vụ tile đều nằm ở phía sau (downstream) của nguồn dùng chung.

Routing- or rendering-specific copies must not become competing editing authorities.

> **VI —** Các bản sao dành riêng cho định tuyến hoặc dựng hình không được phép trở thành những "thẩm quyền chỉnh sửa" cạnh tranh nhau.

### Independent Routing and Tile Gates — Cổng kiểm soát định tuyến và tile độc lập

The Routing QC worker independently gates routing publication. The Tile QC worker independently gates tile publication. The two paths have separate release cadences.

> **VI —** Worker Routing QC kiểm soát (gate) việc phát hành định tuyến một cách độc lập. Worker Tile QC kiểm soát việc phát hành tile một cách độc lập. Hai luồng này có nhịp phát hành (release cadence) riêng biệt.

This prevents a tile-quality failure from unnecessarily blocking routing artifacts, or a routing-topology failure from blocking tile publication. It also permits production routing and tile artifacts to represent different Editor DB states.

> **VI —** Điều này ngăn một lỗi chất lượng tile chặn oan các artifact định tuyến, hoặc một lỗi topology định tuyến chặn việc phát hành tile. Nó cũng cho phép các artifact định tuyến và tile trên production phản ánh những trạng thái Editor DB khác nhau.

### Separate Production Deployment Control — Kiểm soát triển khai production tách biệt

The backend repository owns application code and app-owned deploy packages. Production release-control resources belong in `mobility-deployment` and reference those packages.

> **VI —** Repository backend sở hữu mã ứng dụng và các gói triển khai (deploy package) thuộc quyền ứng dụng. Các tài nguyên kiểm soát phát hành trên production nằm trong `mobility-deployment` và tham chiếu tới các gói đó.

The ownership line should remain explicit: this repository defines how an application is packaged and promoted; `mobility-deployment` controls production invocation and approval.

> **VI —** Ranh giới sở hữu cần được giữ rõ ràng: repository này định nghĩa cách một ứng dụng được đóng gói và thăng cấp (promote); còn `mobility-deployment` kiểm soát việc gọi chạy và phê duyệt trên production.

## Required Application Boundaries — Các ranh giới ứng dụng bắt buộc

### Edge API / BFF

#### Responsibilities — Trách nhiệm

The Edge API owns the contract presented to mobile and automotive clients and orchestrates requests to backend services. It must preserve compatibility with lagging client releases.

> **VI —** Edge API sở hữu hợp đồng (contract) hiển thị ra cho các client di động và ô tô, đồng thời điều phối (orchestrate) các request tới các dịch vụ backend. Nó phải duy trì khả năng tương thích với những bản client cũ chậm cập nhật (lagging).

Its in-process domain modules cover:

> **VI —** Các module nghiệp vụ chạy nội bộ (in-process) của nó bao gồm:

- Authentication and quota rules
- Search fallback
- Telemetry validation

> **VI —**
> - Quy tắc xác thực và hạn ngạch (quota)
> - Dự phòng tìm kiếm (search fallback)
> - Kiểm định dữ liệu telemetry

The Edge API also publishes telemetry to Redpanda and communicates with map, routing, search, identity, profile, and partner-data services. The architecture additionally states that the Edge API authenticates operators against Keycloak, which overlaps with the MapOps operator-identity boundary and is discussed under Keycloak coupling below.

> **VI —** Edge API cũng đẩy (publish) telemetry vào Redpanda và giao tiếp với các dịch vụ bản đồ, định tuyến, tìm kiếm, danh tính, hồ sơ và dữ liệu đối tác. Kiến trúc còn nêu rằng Edge API xác thực người vận hành (operator) qua Keycloak, phần này chồng lấn với ranh giới danh tính operator của MapOps và sẽ được bàn ở mục "Sự phụ thuộc vào Keycloak" bên dưới.

#### Schema and Migrations — Schema và Migration

No Edge API-owned persistent schema is specified. Durable user and organization data belongs in the User Profile DB and B2B Partner DB respectively.

> **VI —** Không có schema bền vững nào được chỉ định thuộc quyền Edge API. Dữ liệu người dùng và tổ chức mang tính lâu dài lần lượt thuộc về User Profile DB và B2B Partner DB.

#### Neighbor Contracts — Hợp đồng với các thành phần lân cận

The Edge API contracts with:

> **VI —** Edge API có hợp đồng với:

- Keycloak for authentication tokens and sessions
- User Profile DB for favorites and preferences
- B2B Partner DB for organization settings and quota checks
- Map, routing, and search serving services
- Redpanda for telemetry events
- Mobile and automotive clients through a backward-compatible public contract

> **VI —**
> - Keycloak cho token xác thực và phiên (session)
> - User Profile DB cho mục yêu thích và tùy chọn cá nhân
> - B2B Partner DB cho cấu hình tổ chức và kiểm tra hạn ngạch
> - Các dịch vụ phục vụ bản đồ, định tuyến và tìm kiếm
> - Redpanda cho các sự kiện telemetry
> - Các client di động và ô tô thông qua một hợp đồng công khai tương thích ngược

Compatibility includes more than HTTP response fields. PMTiles layer names, attributes, zoom behavior, artifact addressing, and routing semantics can also be compiled into lagging clients.

> **VI —** Tính tương thích không chỉ gói gọn ở các trường trong phản hồi HTTP. Tên lớp (layer) PMTiles, thuộc tính, hành vi zoom, cách định địa chỉ artifact, và ngữ nghĩa định tuyến cũng có thể đã được biên dịch cứng vào trong các client cũ.

### Keycloak Token-Validation Boundary — Ranh giới xác thực token của Keycloak

#### Responsibilities — Trách nhiệm

Keycloak supplies:

> **VI —** Keycloak cung cấp:

- B2C user sessions
- B2B organization tokens
- Keycloak-backed operator identity for MapOps

> **VI —**
> - Phiên người dùng B2C
> - Token tổ chức B2B
> - Danh tính operator (do Keycloak hậu thuẫn) cho MapOps

The backend requires a visible implementation boundary for validating these token classes. Authentication must remain separate from the MapOps custom authorization model.

> **VI —** Backend yêu cầu một ranh giới hiện thực rõ ràng, có thể nhìn thấy, để xác thực các loại token này. Việc xác thực (authentication) phải tách biệt khỏi mô hình phân quyền (authorization) tùy biến của MapOps.

#### Schema and Migrations — Schema và Migration

The source does not assign Keycloak schema or realm migrations to an application boundary. The backend does own the code and configuration that interpret Keycloak tokens.

> **VI —** Tài liệu nguồn không gán schema hay migration realm của Keycloak cho một ranh giới ứng dụng nào. Tuy vậy backend vẫn sở hữu phần mã và cấu hình dùng để diễn giải token Keycloak.

#### Neighbor Contracts — Hợp đồng với các thành phần lân cận

Token validation must define:

> **VI —** Việc xác thực token phải định nghĩa:

- Accepted issuers and audiences
- Token-type distinctions
- Required claims and scopes
- Signing-key retrieval and refresh behavior
- Expiration and clock-skew handling
- Behavior when Keycloak is unavailable

> **VI —**
> - Các issuer và audience được chấp nhận
> - Cách phân biệt các loại token
> - Các claim và scope bắt buộc
> - Hành vi lấy và làm mới khóa ký (signing key)
> - Xử lý hết hạn và lệch đồng hồ (clock-skew)
> - Hành vi khi Keycloak không khả dụng

The Edge API and MapOps Gateway should consume consistent validation behavior so their security rules do not drift.

> **VI —** Edge API và MapOps Gateway nên dùng chung một hành vi xác thực nhất quán để các quy tắc bảo mật của chúng không bị lệch (drift) khỏi nhau.

### User Profile DB

#### Responsibilities — Trách nhiệm

The User Profile DB owns favorites and preferences and the associated application behavior.

> **VI —** User Profile DB sở hữu mục yêu thích, tùy chọn cá nhân và hành vi ứng dụng đi kèm.

#### Schema and Migrations — Schema và Migration

Its schema and migrations are explicitly app-owned. Changes should be deployed through the application boundary that implements its API behavior.

> **VI —** Schema và migration của nó được xác định rõ là thuộc quyền ứng dụng. Các thay đổi nên được triển khai thông qua ranh giới ứng dụng hiện thực hành vi API của nó.

#### Neighbor Contracts — Hợp đồng với các thành phần lân cận

The Edge API is the stated consumer. Other components should use the Edge API contract rather than couple directly to the profile schema.

> **VI —** Edge API là bên tiêu thụ được nêu tên. Các thành phần khác nên dùng hợp đồng của Edge API thay vì gắn kết trực tiếp vào schema hồ sơ.

References from favorites to map entities require stable identifiers or documented handling when those entities change or disappear.

> **VI —** Các tham chiếu từ mục yêu thích tới thực thể bản đồ đòi hỏi định danh ổn định, hoặc phải có cách xử lý được ghi chép rõ khi các thực thể đó thay đổi hoặc biến mất.

### B2B Partner DB

#### Responsibilities — Trách nhiệm

The B2B Partner DB owns:

> **VI —** B2B Partner DB sở hữu:

- Organization settings
- Quota checks
- Associated application behavior

> **VI —**
> - Cấu hình tổ chức
> - Kiểm tra hạn ngạch
> - Hành vi ứng dụng đi kèm

#### Schema and Migrations — Schema và Migration

Its schema and migrations are explicitly app-owned.

> **VI —** Schema và migration của nó được xác định rõ là thuộc quyền ứng dụng.

#### Neighbor Contracts — Hợp đồng với các thành phần lân cận

The Edge API verifies quota and reads organization settings through this boundary. The relationship between a Keycloak B2B token and a partner record must be stable and unambiguous.

> **VI —** Edge API xác minh hạn ngạch và đọc cấu hình tổ chức thông qua ranh giới này. Mối quan hệ giữa một token B2B của Keycloak và một bản ghi đối tác phải ổn định và không mập mờ.

The requirements specify quota checks but do not define whether this database also owns request accounting. That behavior must be resolved before implementation because distributed Edge API instances cannot enforce a global usage counter using local state alone.

> **VI —** Yêu cầu có nêu việc kiểm tra hạn ngạch nhưng không định nghĩa liệu cơ sở dữ liệu này có sở hữu luôn việc hạch toán request (request accounting) hay không. Hành vi đó phải được chốt trước khi hiện thực, bởi vì các instance Edge API phân tán không thể cưỡng chế một bộ đếm sử dụng toàn cục chỉ bằng trạng thái cục bộ.

### MapOps Backend / Editing Gateway

#### Responsibilities — Trách nhiệm

MapOps is the operator-identity and editing-policy boundary. It provides:

> **VI —** MapOps là ranh giới về danh tính operator và chính sách chỉnh sửa. Nó cung cấp:

- Keycloak-backed operator authentication
- A custom authorization model
- Edit safeguards
- POI orchestration
- Smart proxying of OSM API operations

> **VI —**
> - Xác thực operator dựa trên Keycloak
> - Một mô hình phân quyền tùy biến
> - Các cơ chế bảo vệ chỉnh sửa (edit safeguard)
> - Điều phối POI
> - Proxy "thông minh" cho các thao tác OSM API

It is the decided gateway to Rails Port and CGImap.

> **VI —** Nó là gateway đã được quyết định để đi tới Rails Port và CGImap.

#### Schema and Migrations — Schema và Migration

No MapOps-owned persistent schema is required by the source. If its authorization model, safeguards, or audit records require persistence, ownership and migrations must be assigned explicitly rather than placed implicitly in the Editor DB.

> **VI —** Tài liệu nguồn không yêu cầu schema bền vững nào thuộc quyền MapOps. Nếu mô hình phân quyền, các cơ chế bảo vệ, hay bản ghi kiểm toán (audit) của nó cần lưu trữ, thì quyền sở hữu và migration phải được gán một cách tường minh, thay vì đặt ngầm vào trong Editor DB.

#### Neighbor Contracts — Hợp đồng với các thành phần lân cận

Upstream, MapOps receives operations edits from the Ops Portal.

> **VI —** Ở phía trên (upstream), MapOps nhận các chỉnh sửa vận hành từ Ops Portal.

Downstream, it proxies to the Editing Engine Layer:

> **VI —** Ở phía dưới (downstream), nó proxy tới Lớp Editing Engine:

- Rails Port, providing the full OSM Rails Web API
- CGImap, providing the C++ high-performance OSM read/write API
- The conflation engine, which also resides in that layer

> **VI —**
> - Rails Port, cung cấp toàn bộ OSM Rails Web API
> - CGImap, cung cấp API đọc/ghi OSM hiệu năng cao viết bằng C++
> - Conflation engine, cũng nằm trong lớp đó

Rails Port and CGImap are both OSM API-compatible and write tagged changesets to the Editor DB. Direct access that bypasses MapOps would bypass its authorization and safeguards, so deployment boundaries must preserve the gateway as the editing entry point.

> **VI —** Rails Port và CGImap đều tương thích với OSM API và cùng ghi các changeset gắn thẻ vào Editor DB. Truy cập trực tiếp mà vượt qua MapOps sẽ bỏ qua luôn phần phân quyền và các cơ chế bảo vệ của nó, vì vậy ranh giới triển khai phải giữ gateway làm điểm vào (entry point) duy nhất cho việc chỉnh sửa.

### Editor DB and Community Ingestion — Editor DB và việc nạp dữ liệu cộng đồng

#### Responsibilities — Trách nhiệm

The Editor DB is the canonical map-editing authority. It must support:

> **VI —** Editor DB là thẩm quyền chỉnh sửa bản đồ chuẩn tắc (canonical). Nó phải hỗ trợ:

- Initial Geofabrik PBF baseline import through osmosis
- Daily OSC diff application through osmium or pyosmium
- A state file tracking replication sequence
- Private team-tagged changesets
- A conflict queue table for version mismatches between incoming community diffs and team-tagged changesets
- An Ops Portal reviewer workflow to clear the queue
- An export prohibition while the conflict queue remains uncleared

> **VI —**
> - Import baseline PBF ban đầu từ Geofabrik qua osmosis
> - Áp diff OSC hằng ngày qua osmium hoặc pyosmium
> - Một file trạng thái (state file) theo dõi chuỗi replication
> - Các changeset gắn thẻ của đội nội bộ
> - Một bảng hàng đợi xung đột (conflict queue) cho các trường hợp lệch phiên bản giữa diff cộng đồng đến và changeset gắn thẻ nội bộ
> - Một quy trình duyệt (reviewer workflow) trên Ops Portal để giải phóng hàng đợi
> - Cấm export khi hàng đợi xung đột chưa được xử lý xong

#### Schema and Migrations — Schema và Migration

The boundary owns the OSM apidb schema and the required local additions, including team-tagging and the conflict queue.

> **VI —** Ranh giới này sở hữu schema OSM apidb và các phần bổ sung cục bộ cần thiết, bao gồm việc gắn thẻ nội bộ (team-tagging) và hàng đợi xung đột.

Schema changes must remain compatible with Rails Port and CGImap. Local extensions should be clearly isolated from third-party-owned apidb structures and tested against upgrades of both editing engines.

> **VI —** Các thay đổi schema phải giữ tương thích với Rails Port và CGImap. Phần mở rộng cục bộ nên được cô lập rõ ràng khỏi các cấu trúc apidb do bên thứ ba sở hữu, và phải được kiểm thử đối chiếu với các bản nâng cấp của cả hai editing engine.

#### Neighbor Contracts — Hợp đồng với các thành phần lân cận

Inbound contracts include:

> **VI —** Các hợp đồng đầu vào (inbound) gồm:

- Tagged changesets from Rails Port and CGImap
- Baseline PBF data from Geofabrik
- Incremental OSC replication diffs
- Reviewer decisions from the Ops Portal workflow

> **VI —**
> - Changeset gắn thẻ từ Rails Port và CGImap
> - Dữ liệu baseline PBF từ Geofabrik
> - Các diff replication OSC gia tăng
> - Các quyết định duyệt từ quy trình trên Ops Portal

Outbound contracts include read access for:

> **VI —** Các hợp đồng đầu ra (outbound) gồm quyền đọc cho:

- Routing QC
- Tile QC
- Map Sync Worker after the applicable gates pass

> **VI —**
> - Routing QC
> - Tile QC
> - Map Sync Worker, sau khi các cổng kiểm soát tương ứng đã vượt qua

The export gate must be enforced by backend execution, not merely represented as an Ops Portal convention. An export must not proceed while required conflict review is incomplete.

> **VI —** Cổng export phải được cưỡng chế bằng chính việc thực thi ở backend, chứ không chỉ là một quy ước trên Ops Portal. Một tiến trình export không được phép diễn ra khi việc duyệt xung đột bắt buộc chưa hoàn tất.

### Routing QC and Topology Validation Worker — Worker kiểm định định tuyến và topology

#### Responsibilities — Trách nhiệm

This worker validates navigation safety and network topology using Osmose and KeepRight. Its pass/fail result independently controls routing artifact publication.

> **VI —** Worker này kiểm định an toàn dẫn đường (navigation safety) và topology mạng lưới bằng Osmose và KeepRight. Kết quả đạt/không đạt của nó kiểm soát việc phát hành artifact định tuyến một cách độc lập.

It requires its own app boundary and workflow descriptor.

> **VI —** Nó cần có ranh giới ứng dụng riêng và bản mô tả quy trình (workflow descriptor) riêng.

#### Schema and Migrations — Schema và Migration

No persistent schema is specified. If validation results are stored, ownership and migrations should belong to this worker rather than the Editor DB.

> **VI —** Không có schema bền vững nào được chỉ định. Nếu kết quả kiểm định được lưu, thì quyền sở hữu và migration nên thuộc về worker này chứ không phải Editor DB.

#### Neighbor Contracts — Hợp đồng với các thành phần lân cận

The worker reads the Editor DB through a read-only contract and emits a routing-specific gate result consumed by the routing export path.

> **VI —** Worker đọc Editor DB qua một hợp đồng chỉ-đọc (read-only) và phát ra một kết quả cổng dành riêng cho định tuyến, được luồng export định tuyến tiêu thụ.

A gate result must identify the exact Editor DB state it validated. A result that only says "passed" is unsafe if further changes can occur before export.

> **VI —** Một kết quả cổng phải xác định chính xác trạng thái Editor DB mà nó đã kiểm định. Một kết quả chỉ nói "đạt" là không an toàn nếu vẫn còn thay đổi có thể xảy ra trước khi export.

### Map Tile QC and Geometry Validation Worker — Worker kiểm định tile và hình học

#### Responsibilities — Trách nhiệm

This worker validates:

> **VI —** Worker này kiểm định:

- Geometry
- Rendering behavior
- Custom map-layer quality

> **VI —**
> - Hình học (geometry)
> - Hành vi dựng hình (rendering)
> - Chất lượng các lớp bản đồ tùy biến

It uses Atlas and Osmose, and its pass/fail result independently controls tile-serving publication. It requires its own app boundary and workflow descriptor.

> **VI —** Nó dùng Atlas và Osmose, và kết quả đạt/không đạt của nó kiểm soát việc phát hành phục vụ tile một cách độc lập. Nó cần có ranh giới ứng dụng riêng và bản mô tả quy trình riêng.

#### Schema and Migrations — Schema và Migration

No persistent schema is specified. Any stored workflow state or results should be owned by this worker.

> **VI —** Không có schema bền vững nào được chỉ định. Mọi trạng thái quy trình hay kết quả được lưu đều nên thuộc quyền worker này.

#### Neighbor Contracts — Hợp đồng với các thành phần lân cận

The worker reads the Editor DB through a read-only contract and emits a tile-specific gate result consumed by the tile export path.

> **VI —** Worker đọc Editor DB qua một hợp đồng chỉ-đọc và phát ra một kết quả cổng dành riêng cho tile, được luồng export tile tiêu thụ.

Although both QC workers may use Osmose, their workflow descriptors and gate decisions must remain independent.

> **VI —** Mặc dù cả hai worker QC đều có thể dùng Osmose, các bản mô tả quy trình và quyết định cổng của chúng vẫn phải giữ độc lập.

### Map Sync Worker

#### Responsibilities — Trách nhiệm

The Map Sync Worker is the export fan-out boundary. It produces or imports:

> **VI —** Map Sync Worker là ranh giới phân tỏa export (export fan-out). Nó tạo ra hoặc import:

- PBF
- PMTiles
- Valhalla routing bundles
- Routing-serving artifacts
- Tile-serving imports
- Search indexes

> **VI —**
> - PBF
> - PMTiles
> - Các bundle định tuyến Valhalla
> - Các artifact phục vụ định tuyến
> - Các bản import phục vụ tile
> - Các chỉ mục tìm kiếm (search index)

Routing and tile publication run on independent cadences and consume their respective QC decisions.

> **VI —** Việc phát hành định tuyến và tile chạy theo nhịp độc lập và tiêu thụ quyết định QC tương ứng của từng bên.

#### Schema and Migrations — Schema và Migration

No map truth is owned here. The worker should own its export-job metadata and artifact provenance if those records are persisted.

> **VI —** Không có "chân lý bản đồ" (map truth) nào được sở hữu ở đây. Worker nên sở hữu metadata của các job export và nguồn gốc (provenance) của artifact nếu những bản ghi đó được lưu.

For the Tile Serving DB and the OpenSearch core index, the architecture does not explicitly assign schema or index-migration ownership. Because the Map Sync Worker creates those representations, their contracts and migration procedures should be owned alongside its import logic.

> **VI —** Đối với Tile Serving DB và chỉ mục lõi OpenSearch, kiến trúc không gán tường minh quyền sở hữu schema hay migration chỉ mục. Vì Map Sync Worker tạo ra các biểu diễn đó, nên hợp đồng và quy trình migration của chúng nên được sở hữu cùng với logic import của worker.

#### Neighbor Contracts — Hợp đồng với các thành phần lân cận

The worker:

> **VI —** Worker này:

- Reads an exportable state from the Editor DB
- Consumes routing and tile QC outcomes
- Writes immutable files to object storage
- Builds Valhalla routing data
- Imports tile layers into PostgreSQL/PostGIS
- Builds the OpenSearch core index

> **VI —**
> - Đọc một trạng thái có thể export được từ Editor DB
> - Tiêu thụ kết quả QC của định tuyến và tile
> - Ghi các file bất biến (immutable) vào object storage
> - Build dữ liệu định tuyến Valhalla
> - Import các lớp tile vào PostgreSQL/PostGIS
> - Build chỉ mục lõi OpenSearch

The requirements name routing and tile gates but do not state which gate authorizes search-index publication. That contract must be made explicit without introducing a competing map source.

> **VI —** Yêu cầu có nêu tên cổng định tuyến và cổng tile nhưng không nói cổng nào cho phép phát hành chỉ mục tìm kiếm. Hợp đồng đó phải được làm rõ tường minh mà không tạo ra một nguồn bản đồ cạnh tranh mới.

### Martin Tile Server

#### Responsibilities — Trách nhiệm

Martin serves dynamic vector tiles and live overlays from the Tile Serving DB.

> **VI —** Martin phục vụ vector tile động và các lớp phủ (overlay) trực tiếp từ Tile Serving DB.

A local-development and deployment boundary is required if dynamic tiles and overlays remain in scope.

> **VI —** Cần có một ranh giới cho phát triển cục bộ và triển khai nếu tile động cùng các overlay vẫn nằm trong phạm vi.

#### Schema and Migrations — Schema và Migration

Martin owns no schema in the source design. It consumes the Tile Serving DB representation produced by the Map Sync Worker.

> **VI —** Martin không sở hữu schema nào trong thiết kế nguồn. Nó tiêu thụ biểu diễn Tile Serving DB do Map Sync Worker tạo ra.

The owner of that representation must provide compatible migrations and a local dataset or import procedure against which Martin can be tested.

> **VI —** Bên sở hữu biểu diễn đó phải cung cấp migration tương thích và một tập dữ liệu cục bộ hoặc quy trình import để có thể kiểm thử Martin.

#### Neighbor Contracts — Hợp đồng với các thành phần lân cận

Martin reads PostgreSQL/PostGIS and serves dynamic vector-tile responses. Its contract includes database objects, layer names, attributes, geometry types, and zoom-dependent behavior.

> **VI —** Martin đọc PostgreSQL/PostGIS và trả về các phản hồi vector-tile động. Hợp đồng của nó bao gồm các đối tượng cơ sở dữ liệu, tên lớp, thuộc tính, kiểu hình học và hành vi phụ thuộc mức zoom.

Publishing tile-serving imports must not expose partially imported data to Martin.

> **VI —** Việc phát hành các bản import phục vụ tile không được để lộ dữ liệu import dở dang cho Martin.

### Production Object Storage — Object Storage trên production

#### Responsibilities — Trách nhiệm

Production object storage (S3/R2) holds static PMTiles and must provide:

> **VI —** Object storage trên production (S3/R2) lưu các PMTiles tĩnh và phải cung cấp:

- Immutable artifact keys
- Checksums
- Release-bundle pointers
- Promotion scripts
- Rollback scripts

> **VI —**
> - Khóa artifact bất biến
> - Checksum
> - Con trỏ tới bundle phát hành (release-bundle pointer)
> - Script thăng cấp (promotion)
> - Script quay lui (rollback)

#### Schema and Migrations — Schema và Migration

There is no relational schema. The equivalent contract is the artifact-key and release-manifest format, which must be versioned and app-owned.

> **VI —** Không có schema quan hệ. Hợp đồng tương đương ở đây là định dạng khóa artifact và manifest phát hành, vốn phải được đánh phiên bản và thuộc quyền ứng dụng.

#### Neighbor Contracts — Hợp đồng với các thành phần lân cận

The Map Sync Worker writes artifacts and metadata. Production release control promotes or rolls back bundle pointers through resources in `mobility-deployment`.

> **VI —** Map Sync Worker ghi các artifact và metadata. Bộ kiểm soát phát hành production thăng cấp hoặc quay lui các con trỏ bundle thông qua các tài nguyên trong `mobility-deployment`.

Because routing and tile publication are independent, their release identity and promotion state must also be independently representable.

> **VI —** Vì việc phát hành định tuyến và tile là độc lập, nên danh tính phát hành và trạng thái thăng cấp của chúng cũng phải biểu diễn được một cách độc lập.

## Adjacent Components Without an Explicit Required Boundary — Các thành phần lân cận chưa có ranh giới bắt buộc rõ ràng

The requirements enumerate boundaries for editing, QC, export, tile serving, storage, and identity, but three parts of the diagram receive no equivalent statement. They are in scope for the backend repository, so their ownership should be settled rather than left implicit.

> **VI —** Yêu cầu có liệt kê ranh giới cho việc chỉnh sửa, QC, export, phục vụ tile, lưu trữ và danh tính, nhưng ba phần trong sơ đồ lại không có mệnh đề tương đương. Chúng vẫn nằm trong phạm vi của repository backend, nên quyền sở hữu của chúng cần được chốt thay vì để ngầm định.

### Telemetry Ingestion — Nạp dữ liệu telemetry

The Edge API publishes telemetry to the Redpanda event stream; the Telemetry Ingest Worker validates and batches events into ClickHouse, the Analytics DB. Telemetry validation therefore appears twice — as an in-process Edge API module and again in the ingest worker. Which validation is authoritative, and what happens to events that pass the first check and fail the second, needs a defined answer. The ClickHouse table schema and its migration ownership are unassigned.

> **VI —** Edge API đẩy telemetry vào luồng sự kiện Redpanda; Telemetry Ingest Worker kiểm định và gom (batch) sự kiện vào ClickHouse, tức Analytics DB. Do đó việc kiểm định telemetry xuất hiện hai lần — một là module in-process của Edge API, hai là trong worker nạp dữ liệu. Bên kiểm định nào là có thẩm quyền, và điều gì xảy ra với các sự kiện vượt qua kiểm tra thứ nhất nhưng trượt ở kiểm tra thứ hai, cần có câu trả lời rõ ràng. Schema bảng ClickHouse và quyền sở hữu migration của nó chưa được gán.

### Search Serving — Phục vụ tìm kiếm

Geocoding and POI Search serves the OpenSearch core index built by the Map Sync Worker, and the Search Query Enricher supplies Vietnamese NLU/NLP. Index mapping changes are a compatibility surface shared between the index builder and the query path, and the enricher's behavior is part of the search results lagging clients receive.

> **VI —** Geocoding và POI Search phục vụ chỉ mục lõi OpenSearch do Map Sync Worker build, còn Search Query Enricher cung cấp NLU/NLP tiếng Việt. Các thay đổi ánh xạ chỉ mục (index mapping) là một bề mặt tương thích dùng chung giữa bên build chỉ mục và luồng truy vấn, và hành vi của bộ enricher là một phần của kết quả tìm kiếm mà các client cũ nhận được.

### Routing Serving — Phục vụ định tuyến

Valhalla Routing and ETA serves routing tiles from tmpfs or RAM. That makes routing promotion different in kind from an object-storage pointer swap: publishing a new routing bundle implies a memory-resident dataset reload, so capacity, warm-up, and rollback of the in-memory generation all belong to the routing release procedure.

> **VI —** Valhalla Routing và ETA phục vụ các routing tile từ tmpfs hoặc RAM. Điều đó khiến việc thăng cấp định tuyến khác về bản chất so với một cú đổi con trỏ trên object storage: phát hành một bundle định tuyến mới hàm ý phải nạp lại một tập dữ liệu nằm trong bộ nhớ, nên dung lượng, làm nóng (warm-up), và quay lui của thế hệ dữ liệu in-memory đều thuộc về quy trình phát hành định tuyến.

## Principal Risks and Trade-offs — Các rủi ro và đánh đổi chính

### Single-Master Editor DB — Editor DB đơn-master

The single Editor DB protects source consistency but is both a bottleneck and a single point of failure.

> **VI —** Editor DB duy nhất bảo vệ tính nhất quán của nguồn nhưng đồng thời vừa là nút thắt cổ chai (bottleneck) vừa là điểm hỏng đơn (single point of failure).

It receives operator edits and community diffs while supporting QC and export reads. Failure blocks editing, ingestion, validation, and new publication. Long-running QC or export work can also interfere with write latency and database maintenance.

> **VI —** Nó vừa nhận các chỉnh sửa của operator và diff cộng đồng, vừa phục vụ các thao tác đọc của QC và export. Khi hỏng, nó chặn luôn việc chỉnh sửa, nạp dữ liệu, kiểm định và phát hành mới. Các công việc QC hoặc export chạy dài cũng có thể ảnh hưởng tới độ trễ ghi (write latency) và việc bảo trì cơ sở dữ liệu.

The mitigation must preserve one logical apidb and one write authority.

> **VI —** Biện pháp giảm thiểu phải bảo toàn một apidb logic duy nhất và một thẩm quyền ghi duy nhất.

### Conflict-Queue Correctness — Tính đúng đắn của hàng đợi xung đột

Community diffs and private changesets can modify the same OSM entities from different histories. Detecting a version mismatch is only the beginning; the system also needs deterministic resolution semantics.

> **VI —** Diff cộng đồng và changeset nội bộ có thể sửa cùng những thực thể OSM nhưng xuất phát từ các lịch sử khác nhau. Phát hiện lệch phiên bản mới chỉ là bước đầu; hệ thống còn cần ngữ nghĩa giải quyết xung đột có tính tất định (deterministic).

Important cases include:

> **VI —** Các trường hợp quan trọng gồm:

- Concurrent tag changes
- Geometry changes
- Relation-membership changes
- Local or upstream deletion
- Replayed diffs
- Reviewer retries
- A crash during resolution

> **VI —**
> - Thay đổi thẻ (tag) đồng thời
> - Thay đổi hình học
> - Thay đổi thành viên quan hệ (relation-membership)
> - Xóa ở phía cục bộ hoặc phía upstream
> - Diff bị phát lại (replay)
> - Người duyệt thử lại
> - Sự cố sập (crash) giữa lúc đang giải quyết

A conflict queue implemented only as a table, without an explicit state machine and audit history, is unlikely to preserve correctness.

> **VI —** Một hàng đợi xung đột chỉ hiện thực bằng một bảng, mà thiếu một máy trạng thái (state machine) tường minh và lịch sử kiểm toán, khó lòng bảo toàn được tính đúng đắn.

### Replication State-File Durability — Độ bền của file trạng thái replication

The replication state file and Editor DB are separate durability domains. A crash between applying a diff and updating the file can cause either replay or a skipped sequence, depending on operation ordering.

> **VI —** File trạng thái replication và Editor DB là hai miền bền vững (durability domain) tách biệt. Một cú sập giữa lúc áp một diff và lúc cập nhật file có thể gây ra hoặc phát lại (replay) hoặc bỏ sót một số thứ tự (sequence), tùy vào thứ tự các thao tác.

Loss of the file can also make the current replication position uncertain. Its storage, backup, update protocol, and reconciliation with database contents are therefore correctness concerns, not worker-local implementation details.

> **VI —** Mất file cũng có thể khiến vị trí replication hiện tại trở nên bất định. Vì vậy việc lưu trữ, sao lưu, giao thức cập nhật, và đối soát nó với nội dung cơ sở dữ liệu là những mối lo về tính đúng đắn, chứ không phải chi tiết hiện thực cục bộ của worker.

### Routing and Tile Version Skew — Lệch phiên bản giữa định tuyến và tile

Independent gates intentionally permit routing and tile artifacts to represent different Editor DB states. Users may see a road that is not routable or receive a route over geometry not yet visible in tiles. Search results add a third clock, since no gate is assigned to index publication.

> **VI —** Các cổng độc lập cố ý cho phép artifact định tuyến và artifact tile phản ánh những trạng thái Editor DB khác nhau. Người dùng có thể thấy một con đường nhưng không định tuyến được, hoặc nhận một tuyến đường đi qua hình học chưa hiển thị trên tile. Kết quả tìm kiếm thêm vào một "chiếc đồng hồ" thứ ba, vì không có cổng nào được gán cho việc phát hành chỉ mục.

The architecture should bound and expose this skew rather than incorrectly assume all channels advance together.

> **VI —** Kiến trúc nên giới hạn và phơi bày (expose) độ lệch này thay vì giả định sai rằng tất cả các kênh cùng tiến lên đồng bộ.

### Lagging-Client Compatibility — Tương thích với client cũ

The compatibility obligation covers:

> **VI —** Nghĩa vụ tương thích bao trùm:

- Edge API request and response formats
- PMTiles layer and attribute schemas
- Artifact URLs and retained bundle generations
- Routing response behavior
- Search behavior used by released clients

> **VI —**
> - Định dạng request và response của Edge API
> - Schema lớp và thuộc tính của PMTiles
> - URL artifact và các thế hệ bundle được giữ lại
> - Hành vi phản hồi định tuyến
> - Hành vi tìm kiếm mà các client đã phát hành đang dùng

Without a support matrix and contract tests, compatibility becomes dependent on individual developer memory.

> **VI —** Nếu thiếu một ma trận hỗ trợ (support matrix) và các bài kiểm thử hợp đồng (contract test), tính tương thích sẽ phụ thuộc vào trí nhớ của từng lập trình viên.

### Keycloak Coupling — Sự phụ thuộc vào Keycloak

Keycloak participates in consumer identity, B2B identity, and operator identity. An outage or key-rotation error can therefore affect multiple platform surfaces simultaneously.

> **VI —** Keycloak tham gia vào danh tính người dùng cuối, danh tính B2B và danh tính operator. Do đó một sự cố gián đoạn hoặc lỗi xoay khóa (key-rotation) có thể ảnh hưởng đồng thời tới nhiều bề mặt của nền tảng.

A second risk is validator drift. The architecture places operator authentication against Keycloak in both the Edge API and MapOps, so two components can interpret issuer, audience, scopes, or token types differently and produce inconsistent authorization behavior.

> **VI —** Rủi ro thứ hai là "trôi lệch bộ xác thực" (validator drift). Kiến trúc đặt việc xác thực operator qua Keycloak ở cả Edge API lẫn MapOps, nên hai thành phần có thể diễn giải issuer, audience, scope hay loại token khác nhau và tạo ra hành vi phân quyền không nhất quán.

### Release-Control Ownership — Quyền sở hữu kiểm soát phát hành

Application packages and production control intentionally live in different repositories. Ambiguous ownership at this boundary can allow package behavior and production automation to evolve incompatibly.

> **VI —** Các gói ứng dụng và phần kiểm soát production cố ý nằm ở các repository khác nhau. Quyền sở hữu mập mờ tại ranh giới này có thể khiến hành vi của gói và phần tự động hóa production tiến hóa theo hướng không tương thích với nhau.

Only the deployment control path should possess authority to promote production pointers.

> **VI —** Chỉ luồng kiểm soát triển khai mới nên có thẩm quyền thăng cấp các con trỏ trên production.

## Recommendations — Khuyến nghị

### Establish End-to-End Release Identity — Thiết lập danh tính phát hành xuyên suốt

Assign every exportable Editor DB state an immutable identity. Record that identity in:

> **VI —** Gán cho mỗi trạng thái Editor DB có thể export một danh tính bất biến. Ghi lại danh tính đó trong:

- Routing and tile QC results
- Map Sync jobs
- Artifact manifests
- Release-bundle pointers
- Operational diagnostics

> **VI —**
> - Kết quả QC của định tuyến và tile
> - Các job của Map Sync
> - Các manifest artifact
> - Các con trỏ bundle phát hành
> - Chẩn đoán vận hành (operational diagnostics)

The Map Sync Worker should publish only when the matching QC result applies to the exact exported state. Manifests should include artifact checksums and the authorizing gate result.

> **VI —** Map Sync Worker chỉ nên phát hành khi kết quả QC tương ứng áp đúng vào trạng thái đã export. Các manifest nên bao gồm checksum của artifact và kết quả cổng cho phép phát hành.

### Specify the Conflict Queue as a State Machine — Đặc tả hàng đợi xung đột như một máy trạng thái

Define queue states, transitions, retry behavior, and reviewer actions. Record the affected OSM entity, incoming and current versions, resolution, reviewer identity, timestamp, and rationale.

> **VI —** Định nghĩa các trạng thái của hàng đợi, các bước chuyển, hành vi thử lại, và các hành động của người duyệt. Ghi lại thực thể OSM bị ảnh hưởng, phiên bản đến và phiên bản hiện tại, cách giải quyết, danh tính người duyệt, dấu thời gian và lý do.

Make queue clearance an exporter-enforced precondition, as required. Test tag, geometry, relation, deletion, replay, and interrupted-resolution cases.

> **VI —** Biến việc giải phóng hàng đợi thành một điều kiện tiên quyết do bộ export cưỡng chế, đúng như yêu cầu. Kiểm thử các trường hợp thẻ, hình học, quan hệ, xóa, phát lại, và giải quyết bị gián đoạn.

### Harden Replication Checkpointing — Củng cố việc chốt điểm replication

Place the replication state file on durable, backed-up storage. Define one crash-safe ordering for database commit and checkpoint advancement, and add startup reconciliation that detects disagreement before another diff is applied.

> **VI —** Đặt file trạng thái replication trên bộ lưu trữ bền vững, có sao lưu. Định nghĩa một thứ tự an toàn trước sự cố (crash-safe) duy nhất cho việc commit cơ sở dữ liệu và việc tiến checkpoint, đồng thời bổ sung bước đối soát lúc khởi động để phát hiện bất đồng trước khi áp diff kế tiếp.

Diff processing should be retry-safe, and sequence gaps or regressions should stop ingestion and raise an alert.

> **VI —** Việc xử lý diff nên an toàn khi thử lại (retry-safe), và các khoảng trống thứ tự hoặc thụt lùi (regression) phải dừng việc nạp dữ liệu và phát cảnh báo.

### Protect the Editor DB — Bảo vệ Editor DB

Define high availability, backup, point-in-time recovery, and tested restoration for the single authoritative apidb. Use read-only roles for QC and export consumers, schedule heavy work deliberately, and monitor its effect on edit latency and maintenance.

> **VI —** Định nghĩa tính sẵn sàng cao (HA), sao lưu, khôi phục về thời điểm (point-in-time recovery), và quy trình phục hồi đã được kiểm thử cho apidb có thẩm quyền duy nhất. Dùng vai trò chỉ-đọc cho các bên tiêu thụ QC và export, sắp lịch các công việc nặng một cách chủ đích, và giám sát ảnh hưởng của chúng lên độ trễ chỉnh sửa và bảo trì.

Any physical scaling strategy must retain one logical database and one write authority.

> **VI —** Mọi chiến lược mở rộng ở tầng vật lý phải giữ lại một cơ sở dữ liệu logic duy nhất và một thẩm quyền ghi duy nhất.

### Make Independent Publication Observable — Làm cho việc phát hành độc lập có thể quan sát được

Maintain separate routing, tile, and search release pointers. Expose their source identities and alert when skew exceeds an agreed operational limit.

> **VI —** Duy trì các con trỏ phát hành riêng cho định tuyến, tile và tìm kiếm. Phơi bày danh tính nguồn của chúng và cảnh báo khi độ lệch vượt quá một giới hạn vận hành đã thống nhất.

Do not force synchronized publication, because that would undo the decided independent-gate model. Instead, make divergence measurable and reversible.

> **VI —** Đừng cưỡng ép phát hành đồng bộ, vì làm vậy sẽ phá bỏ mô hình cổng độc lập đã quyết định. Thay vào đó, hãy làm cho sự phân kỳ (divergence) đo lường được và đảo ngược được.

### Formalize Client Compatibility — Chính thức hóa tương thích client

Publish a supported-client matrix and require additive evolution within its window. Version PMTiles schemas and retain immutable artifact generations while supported clients reference them.

> **VI —** Công bố một ma trận client được hỗ trợ và yêu cầu tiến hóa theo hướng chỉ thêm (additive) trong phạm vi cửa sổ đó. Đánh phiên bản các schema PMTiles và giữ lại các thế hệ artifact bất biến chừng nào các client được hỗ trợ còn tham chiếu tới chúng.

Add contract tests for the oldest supported client behavior, including API payloads, tile layers and attributes, routing responses, and artifact resolution.

> **VI —** Bổ sung các bài kiểm thử hợp đồng cho hành vi của client cũ nhất còn được hỗ trợ, bao gồm payload API, lớp và thuộc tính tile, phản hồi định tuyến, và cách phân giải artifact.

### Centralize Keycloak Validation Behavior — Tập trung hóa hành vi xác thực Keycloak

Provide one versioned validation implementation or specification consumed by the Edge API and MapOps. Cover B2C, B2B, and operator tokens explicitly, and state which component is authoritative for operator authentication.

> **VI —** Cung cấp một hiện thực hoặc đặc tả xác thực duy nhất, có đánh phiên bản, được cả Edge API và MapOps dùng chung. Bao phủ tường minh token B2C, B2B và operator, và nêu rõ thành phần nào là có thẩm quyền cho việc xác thực operator.

Cache signing keys safely, test key rotation, and document outage behavior. Existing read sessions may use bounded cached validation where acceptable, while editing and authorization-sensitive writes should fail closed when identity cannot be established.

> **VI —** Cache khóa ký một cách an toàn, kiểm thử việc xoay khóa, và ghi chép hành vi khi gián đoạn. Các phiên đọc đang tồn tại có thể dùng xác thực từ cache trong giới hạn cho phép ở những chỗ chấp nhận được, trong khi các thao tác chỉnh sửa và ghi nhạy cảm về phân quyền nên "fail closed" (từ chối an toàn) khi không thể xác lập được danh tính.

### Make Serving Promotions Atomic — Làm cho việc thăng cấp phục vụ có tính nguyên tử

For object storage, promote only by changing validated release-bundle pointers; never mutate published artifact keys.

> **VI —** Với object storage, chỉ thăng cấp bằng cách thay đổi các con trỏ bundle phát hành đã được kiểm định; tuyệt đối không thay đổi (mutate) các khóa artifact đã phát hành.

For the Tile Serving DB, define an import and promotion procedure that prevents Martin from observing partial data and permits rollback to the previous complete representation.

> **VI —** Với Tile Serving DB, định nghĩa một quy trình import và thăng cấp sao cho Martin không quan sát được dữ liệu dở dang và cho phép quay lui về biểu diễn hoàn chỉnh trước đó.

For Valhalla, treat the memory-resident tile generation as part of the release: size capacity for holding a new generation alongside the current one where possible, warm before cutover, and keep the previous bundle available for rollback.

> **VI —** Với Valhalla, hãy coi thế hệ tile nằm trong bộ nhớ là một phần của bản phát hành: định cỡ dung lượng để có thể giữ một thế hệ mới song song với thế hệ hiện tại khi có thể, làm nóng trước khi chuyển đổi (cutover), và giữ bundle trước đó sẵn sàng để quay lui.

### Resolve Search and Telemetry Ownership — Chốt quyền sở hữu tìm kiếm và telemetry

Assign search-index publication to an existing release path and document which Editor DB state and QC result authorize it. The search index must carry the same provenance as routing and tile artifacts even if no additional QC worker is introduced. Index mapping changes should be owned and versioned alongside the query-path components that depend on them.

> **VI —** Gán việc phát hành chỉ mục tìm kiếm vào một luồng phát hành hiện có và ghi chép rõ trạng thái Editor DB nào và kết quả QC nào cho phép nó. Chỉ mục tìm kiếm phải mang cùng nguồn gốc (provenance) như artifact định tuyến và tile, kể cả khi không thêm worker QC mới nào. Các thay đổi ánh xạ chỉ mục nên được sở hữu và đánh phiên bản cùng với các thành phần luồng truy vấn phụ thuộc vào chúng.

For telemetry, designate one authoritative validation contract shared by the Edge API module and the Telemetry Ingest Worker, define handling for events rejected downstream, and assign ClickHouse schema and migration ownership to the ingest boundary.

> **VI —** Với telemetry, chỉ định một hợp đồng kiểm định có thẩm quyền duy nhất, dùng chung bởi module Edge API và Telemetry Ingest Worker, định nghĩa cách xử lý các sự kiện bị từ chối ở phía sau, và gán quyền sở hữu schema ClickHouse cùng migration cho ranh giới nạp dữ liệu.

### Enforce the Repository Boundary — Cưỡng chế ranh giới repository

Keep deploy-package implementation in the backend repository and production invocation, approval, and credentials in `mobility-deployment`. Test the interface between them and version it when package inputs or manifest formats change.

> **VI —** Giữ phần hiện thực gói triển khai trong repository backend, còn phần gọi chạy trên production, phê duyệt và thông tin xác thực (credentials) trong `mobility-deployment`. Kiểm thử giao diện giữa hai bên và đánh phiên bản nó mỗi khi đầu vào của gói hoặc định dạng manifest thay đổi.

## Verdict — Kết luận

The core architecture is coherent. One authoritative apidb avoids competing map histories, while the QC and export split permits routing and tile products to evolve independently. The MapOps gateway provides the correct policy boundary for operator edits, and separate production deployment control creates a defensible release boundary.

> **VI —** Kiến trúc cốt lõi là mạch lạc. Một apidb có thẩm quyền duy nhất tránh được các lịch sử bản đồ cạnh tranh nhau, trong khi việc tách QC và export cho phép sản phẩm định tuyến và tile tiến hóa độc lập. Gateway MapOps cung cấp đúng ranh giới chính sách cho các chỉnh sửa của operator, và việc kiểm soát triển khai production tách biệt tạo ra một ranh giới phát hành vững chắc.

The design's largest gaps are enforcement and ownership details: tying QC to the exact exported state, making replication checkpoints crash-safe, defining conflict resolution as an auditable workflow, assigning the unstated boundaries around search and telemetry, and maintaining compatibility with deployed clients. Addressing those gaps preserves the decided architecture while making its correctness and operational behavior verifiable.

> **VI —** Những khoảng trống lớn nhất của thiết kế nằm ở chi tiết cưỡng chế và quyền sở hữu: gắn QC vào đúng trạng thái đã export, làm cho các checkpoint replication an toàn trước sự cố, định nghĩa việc giải quyết xung đột như một quy trình có thể kiểm toán, gán các ranh giới chưa được nêu quanh tìm kiếm và telemetry, và duy trì tương thích với các client đã triển khai. Khắc phục những khoảng trống đó sẽ bảo toàn kiến trúc đã quyết định trong khi làm cho tính đúng đắn và hành vi vận hành của nó có thể kiểm chứng được.
