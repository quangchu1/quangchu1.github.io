---
title: 'From Microservices Repo to Knowledge Bundle: Applying OKF to Online Boutique'
description: 'A real case study: applying the Open Knowledge Format (OKF) to the Online Boutique microservices demo, with the exact generator commands. Bilingual: English + Tiếng Việt.'
pubDate: 'Jul 11 2026'
heroImage: '../../assets/blog-placeholder-2.jpg'
---


> **🇬🇧 English** · [🇻🇳 Tiếng Việt](#tiếng-việt)  
> *This post is bilingual. Scroll down for the Vietnamese version — Bài viết song ngữ; bản tiếng Việt ở bên dưới.*

Most microservices repos know a lot about themselves — which service is written in what language, where its code lives, how the pieces fit — but that knowledge is scattered across directories and Dockerfiles where neither a new engineer nor an AI agent can pick it up quickly. This is a walkthrough of taking Google Cloud's public "Online Boutique" demo and turning it into a conformant Open Knowledge Format (OKF) bundle with a small, reusable generator. The result: 20 machine- and human-readable knowledge concepts, checked straight into the repo.

## WHAT

The **Open Knowledge Format (OKF)** is a universal, vendor-neutral way to represent knowledge as plain Markdown files with YAML frontmatter, organized in a directory tree. It is deliberately minimal — no schema registry, no central authority, no required tooling. If you can `cat` a file you can read it; if you can `git clone` a repo you can ship it. The unit of distribution is a **Knowledge Bundle** (a directory of documents), and each document is a **Concept** with a required `type` field plus optional keys like `title`, `description`, `resource`, `tags`, and `timestamp`.

What we applied it to is the [Online Boutique microservices demo](https://github.com/GoogleCloudPlatform/microservices-demo) — Google Cloud's public, Apache-2.0-licensed e-commerce app. It's a cloud-first demo of 10+ microservices spread across multiple languages, which makes it an honest stand-in for a real production codebase.

## WHY

Why bother turning a working microservices repo into an OKF bundle? Because the format's properties map neatly onto problems every polyglot codebase has:

- **Human- and agent-readable.** No SDK or query language stands between a reader and the content. An engineer can `cat` a service concept; an LLM can load it verbatim into context.
- **Version-controllable out of the box.** The bundle lives in git alongside the code, so pull requests, diffs, blame, and review just work. Knowledge curation becomes a normal engineering activity.
- **Portable and lock-in free.** A bundle is just a directory — no proprietary metadata store to feed or escape from.
- **Progressive disclosure built in.** Auto-generated `index.md` files let a reader (or agent) navigate one level at a time instead of ingesting the whole repo.
- **Graph-shaped.** Concepts cross-link with normal Markdown links, so relationships between services can be expressed richer than the directory tree implies.

In short: the same artifacts, reviewed the same way, that the team already collaborates on for source code — now covering the knowledge *about* that source code.

## HOW

### What the okf-bundle generator is

The bundle wasn't hand-written. It was produced by a small, **reusable "okf-bundle" generator** — no service, no SDK, just Python and shell. It ships *inside* the case-study repo under `tools/okf-bundle/`, so the whole bundle is reproducible from the repo itself. The only prerequisites are **python3 + pyyaml**.

Its components:

- **`okf_lib/`** — a tiny library: `document.py` (parse / serialize / validate OKF concept docs), `index.py` (regenerate `index.md`), `paths.py`, and `repo_sources.py` (the *detectors*).
- **Five pipeline scripts** — `discover.py`, `enrich.py`, `reindex.py`, `logstamp.py`, `validate.py`.
- **`okf-build.sh`** — a one-command wrapper that runs all five in order.
- **`detectors.toml`** — selects which detectors run: `microservice`, `packages`, `openapi`, `sql`, `json-schema`, `adr`, `runbook`, `readme-doc`.

The one that matters most here is the **microservice detector**. It treats each service directory under `src/`, `services/`, `apps/`, or `cmd/` as a `type: Service` concept, and detects the language from marker files it finds there — `go.mod`, `package.json`, `*.csproj` / `*.sln`, `requirements.txt`, `Dockerfile`.

### How we ran it

The whole thing is one command from the repo root:

```bash
tools/okf-bundle/scripts/okf-build.sh --repo . --bundle knowledge/okf --summary "Initial OKF bundle for Online Boutique microservices demo."
```

That wrapper simply runs the five steps in order. Here they are individually:

```bash
python3 tools/okf-bundle/scripts/discover.py  --repo . --bundle knowledge/okf --out /tmp/candidates.json --detectors tools/okf-bundle/detectors.toml
python3 tools/okf-bundle/scripts/enrich.py    --repo . --bundle knowledge/okf --candidates /tmp/candidates.json
python3 tools/okf-bundle/scripts/reindex.py   --bundle knowledge/okf
python3 tools/okf-bundle/scripts/logstamp.py  --bundle knowledge/okf --summary "..."
python3 tools/okf-bundle/scripts/validate.py  --bundle knowledge/okf     # add --strict for the writer profile
```

Briefly, what each step does:

1. **discover** — walks the repo; the detectors turn matching files into concept *candidates*, emitted as JSON.
2. **enrich** — writes one Markdown concept per service or doc, with YAML frontmatter. It's idempotent: a concept is only rewritten when its source fingerprint or template version changes.
3. **reindex** — (re)generates the `index.md` navigation files; the root `index.md` carries `okf_version: "0.1"`.
4. **logstamp** — appends a dated entry to `log.md`, but only when something actually changed.
5. **validate** — enforces OKF v0.1 §9: parseable frontmatter, a non-empty `type` on every concept, and well-formed reserved files.

### The result

The generator produced this layout under `knowledge/okf/`:

```
knowledge/okf/
├── index.md            # root listing (carries okf_version: "0.1")
├── log.md              # dated change history
├── services/           # 12 Service concepts (one per microservice)
│   ├── index.md
│   ├── cartservice.md  # e.g. C#/.NET
│   ├── checkoutservice.md
│   └── ...
└── references/         # docs mirrored as Reference concepts
```

The microservice detector found and catalogued all **12 services**, each as its own `type: Service` concept with a language/runtime and source path:

- adservice
- cartservice
- checkoutservice
- currencyservice
- emailservice
- frontend
- loadgenerator
- paymentservice
- productcatalogservice
- recommendationservice
- shippingservice
- shoppingassistantservice

Here's a real generated concept — `services/cartservice.md` — showing exactly what a Service concept looks like:

```markdown
---
type: Service
resource: repo://src/cartservice
title: cartservice
description: C#/.NET microservice `cartservice` in `src/cartservice`.
tags:
- microservice
timestamp: '2026-07-11T02:51:34+00:00'
source_path: src/cartservice
source_fingerprint: sha256:5ef87708fc103124
okf_template_version: '1'
language: C#/.NET
---

# cartservice

C#/.NET microservice `cartservice` in `src/cartservice`.

# Service
```

Notice the frontmatter mixes the OKF-required `type` with producer-defined extension keys (`source_path`, `source_fingerprint`, `okf_template_version`, `language`) — exactly the "minimally opinionated, freely extensible" model the spec calls for. The `source_fingerprint` is what makes `enrich` idempotent.

The final tally and verdict:

- **20 OKF concepts total** — **12 Service** concepts (one per microservice) + **8 Reference** concepts (project docs).
- Reserved files in place: `index.md` for progressive disclosure at the bundle root and per-folder, plus a dated `log.md` change history.
- **Validation: OKF v0.1 §9 conformant — 0 hard failures, 0 warnings.**
- **Idempotent** — re-running the pipeline yields no diff.

### Reproduce it yourself

Everything above is in the case-study repo, so you can regenerate the exact bundle:

```bash
git clone https://github.com/quangchu1/okf-microservices-demo
cd okf-microservices-demo
tools/okf-bundle/scripts/okf-build.sh --repo . --bundle knowledge/okf
```

## Takeaway

OKF didn't ask us to adopt a platform or learn a query language — it asked us to write down what the repo already knew, in Markdown, and check it into git. A Python-and-shell generator walked the Online Boutique demo, recognized its 12 microservices and 8 docs, and emitted a conformant OKF v0.1 bundle with zero failures and zero warnings, reproducibly and idempotently. That's the whole pitch: knowledge that lives next to the code, reads like the code, and is reviewed like the code — usable by a new teammate and an LLM alike.

**Links:**

- Case-study repo (this work): https://github.com/quangchu1/okf-microservices-demo
- Upstream demo (public): https://github.com/GoogleCloudPlatform/microservices-demo
- OKF / Knowledge Catalog (public): https://github.com/GoogleCloudPlatform/knowledge-catalog

---

## Tiếng Việt

> **🇻🇳 Tiếng Việt** · [🇬🇧 English](#what) (bản tiếng Anh ở trên)

## LÀ GÌ

**Open Knowledge Format (OKF)** là một cách phổ quát, trung lập với nhà cung cấp để biểu diễn tri thức dưới dạng các tệp Markdown thuần có YAML frontmatter, được tổ chức trong một cây thư mục. Nó được thiết kế tối giản có chủ đích — không có schema registry, không có cơ quan trung tâm, không bắt buộc dùng công cụ nào. Nếu bạn có thể `cat` một tệp thì bạn có thể đọc nó; nếu bạn có thể `git clone` một repo thì bạn có thể phân phối nó. Đơn vị phân phối là một **Knowledge Bundle** (một thư mục tài liệu), và mỗi tài liệu là một **Concept** với trường `type` bắt buộc cùng các khóa tùy chọn như `title`, `description`, `resource`, `tags`, và `timestamp`.

Thứ chúng tôi áp dụng là [Online Boutique microservices demo](https://github.com/GoogleCloudPlatform/microservices-demo) — ứng dụng thương mại điện tử công khai, được cấp phép Apache-2.0 của Google Cloud. Đây là một bản demo cloud-first gồm hơn 10 microservice trải trên nhiều ngôn ngữ, khiến nó trở thành một đại diện trung thực cho một codebase production thực tế.

## TẠI SAO

Tại sao phải bận tâm biến một repo microservices đang hoạt động tốt thành một OKF bundle? Vì các đặc tính của định dạng này ánh xạ gọn gàng vào những vấn đề mà mọi codebase đa ngôn ngữ đều gặp:

- **Con người và agent đều đọc được.** Không có SDK hay ngôn ngữ truy vấn nào đứng giữa người đọc và nội dung. Một kỹ sư có thể `cat` một service Concept; một LLM có thể nạp nguyên văn nó vào context.
- **Có thể quản lý phiên bản ngay từ đầu.** Bundle sống trong git cùng với mã nguồn, nên pull request, diff, blame và review đều hoạt động như bình thường. Việc chăm chút tri thức trở thành một hoạt động kỹ thuật thông thường.
- **Di động và không bị lock-in.** Một bundle chỉ là một thư mục — không có kho metadata độc quyền nào để phải nạp dữ liệu vào hoặc tìm cách thoát ra.
- **Progressive disclosure (tiết lộ dần) được tích hợp sẵn.** Các tệp `index.md` được sinh tự động cho phép người đọc, hoặc agent, điều hướng từng cấp một thay vì phải nạp toàn bộ repo.
- **Có dạng đồ thị.** Các Concept liên kết chéo với nhau bằng các link Markdown thông thường, nên quan hệ giữa các service có thể được diễn đạt phong phú hơn những gì cây thư mục ngụ ý.

Nói ngắn gọn: vẫn là các artifact đó, được review theo cùng cách mà đội ngũ vốn đã dùng để cộng tác trên mã nguồn — giờ bao phủ cả tri thức *về* chính mã nguồn đó.

## CÁCH THỰC HIỆN

### okf-bundle generator là gì

Bundle này không được viết tay. Nó được tạo bởi một **generator "okf-bundle" nhỏ, có thể tái sử dụng** — không service, không SDK, chỉ Python và shell. Nó được đóng gói *bên trong* repo case-study tại `tools/okf-bundle/`, nên toàn bộ bundle có thể được tái tạo từ chính repo. Yêu cầu tiên quyết duy nhất là **python3 + pyyaml**.

Các thành phần của nó:

- **`okf_lib/`** — một thư viện nhỏ: `document.py` (phân tích / tuần tự hóa / kiểm định tài liệu Concept OKF), `index.py` (tái tạo `index.md`), `paths.py`, và `repo_sources.py` (các *detectors*).
- **Năm pipeline script** — `discover.py`, `enrich.py`, `reindex.py`, `logstamp.py`, `validate.py`.
- **`okf-build.sh`** — một wrapper một lệnh chạy cả năm script theo thứ tự.
- **`detectors.toml`** — chọn detector nào được chạy: `microservice`, `packages`, `openapi`, `sql`, `json-schema`, `adr`, `runbook`, `readme-doc`.

Phần quan trọng nhất ở đây là **microservice detector**. Nó xem mỗi thư mục service nằm dưới `src/`, `services/`, `apps/`, hoặc `cmd/` là một Concept `type: Service`, và phát hiện ngôn ngữ từ các tệp đánh dấu mà nó tìm thấy ở đó — `go.mod`, `package.json`, `*.csproj` / `*.sln`, `requirements.txt`, `Dockerfile`.

### Cách chúng tôi chạy nó

Toàn bộ chỉ là một lệnh từ thư mục gốc của repo:

```bash
tools/okf-bundle/scripts/okf-build.sh --repo . --bundle knowledge/okf --summary "Initial OKF bundle for Online Boutique microservices demo."
```

Wrapper đó chỉ đơn giản chạy năm bước theo thứ tự. Đây là từng bước riêng lẻ:

```bash
python3 tools/okf-bundle/scripts/discover.py  --repo . --bundle knowledge/okf --out /tmp/candidates.json --detectors tools/okf-bundle/detectors.toml
python3 tools/okf-bundle/scripts/enrich.py    --repo . --bundle knowledge/okf --candidates /tmp/candidates.json
python3 tools/okf-bundle/scripts/reindex.py   --bundle knowledge/okf
python3 tools/okf-bundle/scripts/logstamp.py  --bundle knowledge/okf --summary "..."
python3 tools/okf-bundle/scripts/validate.py  --bundle knowledge/okf     # add --strict for the writer profile
```

Tóm tắt việc mỗi bước làm:

1. **discover** — duyệt toàn repo; các detector biến những tệp khớp thành các Concept *candidate*, xuất ra dưới dạng JSON.
2. **enrich** — viết một Concept Markdown cho mỗi service hoặc tài liệu, kèm YAML frontmatter. Nó có tính idempotent: một Concept chỉ được viết lại khi source fingerprint hoặc phiên bản template của nó thay đổi.
3. **reindex** — tạo lại các tệp điều hướng `index.md`; tệp `index.md` gốc mang `okf_version: "0.1"`.
4. **logstamp** — nối thêm một mục có ngày vào `log.md`, nhưng chỉ khi thực sự có gì đó thay đổi.
5. **validate** — thực thi OKF v0.1 §9: frontmatter phân tích được, một `type` không rỗng trên mọi Concept, và các tệp reserved đúng định dạng.

### Kết quả

Generator đã tạo bố cục sau dưới `knowledge/okf/`:

```
knowledge/okf/
├── index.md            # root listing (carries okf_version: "0.1")
├── log.md              # dated change history
├── services/           # 12 Service concepts (one per microservice)
│   ├── index.md
│   ├── cartservice.md  # e.g. C#/.NET
│   ├── checkoutservice.md
│   └── ...
└── references/         # docs mirrored as Reference concepts
```

Microservice detector đã tìm và lập danh mục toàn bộ **12 service**, mỗi service là một Concept `type: Service` riêng với một ngôn ngữ/runtime và source path:

- adservice
- cartservice
- checkoutservice
- currencyservice
- emailservice
- frontend
- loadgenerator
- paymentservice
- productcatalogservice
- recommendationservice
- shippingservice
- shoppingassistantservice

Đây là một Concept được sinh thực tế — `services/cartservice.md` — cho thấy chính xác một Service Concept trông như thế nào:

```markdown
---
type: Service
resource: repo://src/cartservice
title: cartservice
description: C#/.NET microservice `cartservice` in `src/cartservice`.
tags:
- microservice
timestamp: '2026-07-11T02:51:34+00:00'
source_path: src/cartservice
source_fingerprint: sha256:5ef87708fc103124
okf_template_version: '1'
language: C#/.NET
---

# cartservice

C#/.NET microservice `cartservice` in `src/cartservice`.

# Service
```

Hãy chú ý rằng frontmatter trộn trường `type` bắt buộc của OKF với các khóa mở rộng do producer tự định nghĩa (`source_path`, `source_fingerprint`, `okf_template_version`, `language`) — đúng với mô hình "ít áp đặt, tự do mở rộng" mà spec yêu cầu. `source_fingerprint` chính là thứ khiến `enrich` có tính idempotent.

Con số cuối cùng và kết luận:

- **Tổng cộng 20 OKF Concept** — **12 Concept Service** (một cho mỗi microservice) + **8 Concept Reference** (tài liệu dự án).
- Các tệp reserved đã có sẵn: `index.md` cho progressive disclosure tại gốc bundle và theo từng thư mục, cộng với `log.md` ghi lịch sử thay đổi theo ngày.
- **Kiểm định: chuẩn OKF v0.1 §9 — 0 hard failure, 0 warning.**
- **Idempotent** — chạy lại pipeline không tạo ra diff nào.

### Tự tái tạo

Mọi thứ ở trên đều nằm trong repo case-study, nên bạn có thể tái tạo chính xác bundle đó:

```bash
git clone https://github.com/quangchu1/okf-microservices-demo
cd okf-microservices-demo
tools/okf-bundle/scripts/okf-build.sh --repo . --bundle knowledge/okf
```

## Điều cốt lõi

OKF không yêu cầu chúng tôi phải áp dụng một nền tảng hay học một ngôn ngữ truy vấn — nó chỉ yêu cầu chúng tôi viết ra những gì repo vốn đã biết, bằng Markdown, và đưa vào git. Một generator bằng Python và shell đã duyệt bản demo Online Boutique, nhận diện 12 microservice và 8 tài liệu của nó, rồi phát ra một OKF v0.1 bundle chuẩn với không lỗi và không cảnh báo, theo cách có thể tái tạo và idempotent. Đó là toàn bộ thông điệp: tri thức sống cạnh mã nguồn, đọc như mã nguồn, và được review như mã nguồn — dùng được cho cả một đồng đội mới lẫn một LLM.

**Liên kết:**

- Repo case-study (công việc này): https://github.com/quangchu1/okf-microservices-demo
- Demo upstream (công khai): https://github.com/GoogleCloudPlatform/microservices-demo
- OKF / Knowledge Catalog (công khai): https://github.com/GoogleCloudPlatform/knowledge-catalog
