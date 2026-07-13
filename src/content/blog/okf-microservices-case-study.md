---
title: 'From Microservices Repo to Knowledge Bundle: Applying OKF to Online Boutique'
description: 'A real case study: applying the Open Knowledge Format (OKF) to the Online Boutique microservices demo, with the exact generator commands. Bilingual: English + Tiếng Việt.'
pubDate: 'Jul 11 2026'
updatedDate: 'Jul 13 2026'
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

## FAQ

### General OKF questions

**What is the difference between a Concept and a Bundle?**

A **Knowledge Bundle** is the unit of distribution: a directory tree of UTF-8 Markdown files with YAML frontmatter. A **Concept** is one document inside it — every non-reserved `.md` file in the bundle is a Concept. In the Online Boutique case study above, `knowledge/okf/` is the bundle and `services/cartservice.md` is one of its 20 Concepts.

**What is actually *required* for a valid Concept?**

Only one thing: a parseable YAML frontmatter block with a non-empty `type`. Everything else — `title`, `description`, `resource`, `tags`, `timestamp` — is optional, and producers may freely add their own extension keys (the case study adds `source_path`, `source_fingerprint`, `language`). Missing optional fields, unknown types or keys, and broken links are non-fatal by design.

**Do I need special tooling, a server, or network access to use OKF?**

No. OKF requires no schema registry, no central authority, no required tooling, and no network. If you can `cat` a file you can read a Concept; if you can `git clone` a repo you can ship a bundle. Tools like the okf-bundle generator (python3 + pyyaml, no network) are conveniences for *producing* bundles, not requirements for *consuming* them.

**How is an OKF bundle version-controlled and reviewed?**

The bundle is just files in the repo, so git handles it natively: pull requests, diffs, blame, and code review all work unchanged. Knowledge edits go through the same review process as source code. There is no proprietary metadata store, no export step, and nothing to migrate away from — which is also how OKF avoids vendor lock-in: your knowledge is plain Markdown in a directory you already own.

**What are `index.md` and `log.md`?**

They are OKF's two reserved files. Each directory's `index.md` lists that directory's Concepts and subdirectories with one-line descriptions, giving readers (and agents) progressive disclosure — navigate one level at a time instead of ingesting everything. Only the *root* `index.md` may carry frontmatter, and only the key `okf_version` (e.g. `"0.1"`). `log.md` is a dated, newest-first change history for the bundle.

**Is conformance actually checked?**

Yes — OKF v0.1 §9 defines conformance, and the generator's `validate.py` enforces it: parseable frontmatter on every Concept, a non-empty `type`, and well-formed reserved files. Everything else is permissive: unknown types/keys, broken links, and missing indexes produce at most warnings, never hard failures. A `--strict` flag additionally enforces the reference writer profile (`type`/`title`/`description`/`timestamp`).

### Browsing OKF as a wiki website

**Can I browse an OKF bundle like a wiki?**

Yes — and this is a direct consequence of the format, not a feature bolted on. A bundle is plain Markdown plus a per-directory `index.md` (generated recursively by `reindex`, one in *every* directory). That means **any** Markdown renderer or static-site generator can present it as a browsable wiki: MkDocs, Docusaurus, Backstage TechDocs, GitHub's or GitLab's built-in Markdown rendering, or the OKF reference *knowledge-catalog* viewer. The mapping is mechanical: the `index.md` files become the wiki's navigation, and each Concept becomes a wiki page. Because Concepts also cross-link with ordinary Markdown links, the result reads as a graph, not just a tree.

One thing to be clear about: **OKF itself does not ship or mandate a website or server.** Presentation is a separate, pluggable layer that you choose. The cheapest option is doing nothing — pushing `knowledge/okf/` to GitHub already gives you a clickable, rendered wiki via GitHub's own Markdown view.

### Enterprise scale: multiple GitHub orgs

**We have several GitHub orgs — say `abc-infra`, `abc-dev`, `abc-data` — each with many interrelated repos. Does OKF have built-in support for a company-wide wiki across all of them?**

Honest answer: **no.** OKF v0.1 has no built-in cross-repo or cross-org federation primitive — no bundle registry, no org/tenant concept, no automatic cross-repo linking, no "join" operation in the spec. A bundle lives in one directory, typically one repo.

What OKF *does* give you is a minimal model (directories + `index.md` + Markdown links + `resource` URIs) that composes at scale by **convention**. The practical pattern:

1. **Per-repo bundles.** Each repo in each org carries its own `knowledge/okf/` bundle, versioned and reviewed with that repo's code — exactly as in the case study.
2. **An aggregator ("super-bundle") catalog repo.** Create one separate repo that nests all the per-repo bundles — via git submodules or a scheduled sync — with a top-level folder per org:

   ```
   abc-knowledge-catalog/
   ├── index.md                  # generated: links to the three orgs
   ├── log.md
   ├── abc-infra/
   │   ├── index.md              # generated: links to this org's repos
   │   ├── network-gateway/      # ← that repo's knowledge/okf bundle
   │   └── k8s-platform/
   ├── abc-dev/
   │   ├── index.md
   │   ├── storefront/
   │   └── billing-api/
   └── abc-data/
       ├── index.md
       └── warehouse-pipelines/
   ```

3. **Run `reindex` at the aggregate root.** Because `reindex` walks recursively and writes an `index.md` in every directory, it generates the whole org → repo → concept navigation tree automatically:

   ```bash
   python3 tools/okf-bundle/scripts/reindex.py --bundle .
   ```

4. **Express cross-org relationships with ordinary Markdown links** between Concepts, and/or with shared `resource` URIs. `resource` is a free-form URI — the generator defaults it to `repo://<source_path>`, but a full git URL or `https://` URL works, which is exactly the hook for pointing Concepts at their real source across repos. There is no enforcement; broken cross-links are non-fatal by design.
5. **Point one static-site/wiki generator** (MkDocs, Docusaurus, Backstage TechDocs, or the knowledge-catalog viewer) at the aggregate root. The per-directory `index.md` files give it the org/repo/concept navigation for free.

So the organization of the company-wide wiki is something **you design** — via directory structure, indexes, and links — not something OKF provides as a feature. That is consistent with OKF's deliberate minimalism: the same rules that govern one repo's bundle scale to many repos and many orgs without any new format machinery.

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

---

## Câu hỏi thường gặp (FAQ)

### Câu hỏi chung về OKF

**Concept và Bundle khác nhau như thế nào?**

**Knowledge Bundle** là đơn vị phân phối: một cây thư mục gồm các tệp Markdown UTF-8 có YAML frontmatter. **Concept** là một tài liệu bên trong bundle — mỗi tệp `.md` không thuộc nhóm reserved đều là một Concept. Trong case study Online Boutique ở trên, `knowledge/okf/` là bundle và `services/cartservice.md` là một trong 20 Concept của nó.

**Một Concept hợp lệ thực sự *bắt buộc* những gì?**

Chỉ một thứ: một khối YAML frontmatter phân tích được, với trường `type` không rỗng. Mọi thứ còn lại — `title`, `description`, `resource`, `tags`, `timestamp` — đều tùy chọn, và producer được tự do thêm các khóa mở rộng riêng (case study thêm `source_path`, `source_fingerprint`, `language`). Thiếu trường tùy chọn, type hay khóa lạ, link hỏng — tất cả đều không gây lỗi nghiêm trọng, theo đúng thiết kế.

**Tôi có cần công cụ đặc biệt, server hay kết nối mạng để dùng OKF không?**

Không. OKF không yêu cầu schema registry, không có cơ quan trung tâm, không bắt buộc công cụ nào, và không cần mạng. Nếu bạn có thể `cat` một tệp thì bạn đọc được Concept; nếu bạn có thể `git clone` một repo thì bạn phân phối được bundle. Các công cụ như generator okf-bundle (chỉ cần python3 + pyyaml, không cần mạng) là tiện ích để *tạo* bundle, không phải điều kiện để *đọc* bundle.

**Bundle OKF được quản lý phiên bản và review như thế nào?**

Bundle chỉ là các tệp trong repo, nên git xử lý nó một cách tự nhiên: pull request, diff, blame và code review đều hoạt động như bình thường. Việc sửa tri thức đi qua đúng quy trình review như mã nguồn. Không có kho metadata độc quyền, không có bước export, không có gì phải "di cư" khỏi — đó cũng chính là cách OKF tránh vendor lock-in: tri thức của bạn là Markdown thuần trong một thư mục mà bạn vốn đã sở hữu.

**`index.md` và `log.md` là gì?**

Đó là hai tệp reserved (dành riêng) của OKF. `index.md` của mỗi thư mục liệt kê các Concept và thư mục con của thư mục đó kèm mô tả một dòng, tạo ra cơ chế progressive disclosure (tiết lộ dần) — người đọc, hoặc agent, điều hướng từng cấp một thay vì phải nạp tất cả. Chỉ `index.md` ở *gốc* bundle mới được mang frontmatter, và chỉ với khóa `okf_version` (ví dụ `"0.1"`). `log.md` là lịch sử thay đổi của bundle, ghi theo ngày, mục mới nhất ở trên cùng.

**Tính chuẩn (conformance) có thực sự được kiểm tra không?**

Có — OKF v0.1 §9 định nghĩa conformance, và `validate.py` của generator thực thi nó: frontmatter phân tích được trên mọi Concept, `type` không rỗng, và các tệp reserved đúng định dạng. Phần còn lại là permissive: type/khóa lạ, link hỏng và index thiếu chỉ tạo ra warning, không bao giờ là hard failure. Cờ `--strict` bổ sung thêm writer profile tham chiếu (`type`/`title`/`description`/`timestamp`).

### Duyệt OKF như một website wiki

**Tôi có thể duyệt một OKF bundle như một wiki không?**

Có — và đó là hệ quả trực tiếp của định dạng, không phải một tính năng gắn thêm. Một bundle là Markdown thuần cộng với `index.md` trong từng thư mục (được `reindex` sinh ra một cách đệ quy, thư mục nào cũng có). Nghĩa là **bất kỳ** trình render Markdown hay static-site generator (công cụ sinh website tĩnh) nào cũng có thể trình bày nó thành một wiki duyệt được: MkDocs, Docusaurus, Backstage TechDocs, trình render Markdown sẵn có của GitHub/GitLab, hoặc trình xem tham chiếu *knowledge-catalog* của OKF. Cách ánh xạ hoàn toàn cơ học: các tệp `index.md` trở thành thanh điều hướng của wiki, còn mỗi Concept trở thành một trang wiki. Vì các Concept còn liên kết chéo bằng link Markdown thông thường, kết quả đọc như một đồ thị chứ không chỉ là một cái cây.

Một điểm cần nói rõ: **bản thân OKF không kèm theo và không bắt buộc bất kỳ website hay server nào.** Lớp trình bày là một tầng tách rời, có thể cắm-thay tùy chọn. Phương án rẻ nhất là không làm gì cả — chỉ cần push `knowledge/okf/` lên GitHub, bạn đã có một wiki render sẵn, click được, nhờ chính chế độ hiển thị Markdown của GitHub.

### Quy mô doanh nghiệp: nhiều GitHub org

**Chúng tôi có nhiều GitHub org — ví dụ `abc-infra`, `abc-dev`, `abc-data` — mỗi org có nhiều repo liên quan đến nhau. OKF có hỗ trợ tích hợp sẵn cho một wiki toàn công ty trải trên tất cả các org đó không?**

Câu trả lời thẳng thắn: **không.** OKF v0.1 không có primitive tích hợp sẵn nào cho việc liên kết (federation) giữa nhiều repo hay nhiều org — không có registry cho bundle, không có khái niệm org/tenant, không có cơ chế tự động liên kết chéo giữa các repo, không có phép "join" nào trong spec. Một bundle sống trong một thư mục, thường là một repo.

Thứ OKF *thực sự* cung cấp là một mô hình tối giản (thư mục + `index.md` + link Markdown + URI `resource`) có thể ghép lại ở quy mô lớn bằng **quy ước**. Mẫu thực hành cụ thể:

1. **Bundle theo từng repo.** Mỗi repo trong mỗi org mang bundle `knowledge/okf/` riêng của nó, được quản lý phiên bản và review cùng với mã nguồn của repo đó — đúng như trong case study.
2. **Một repo catalog đóng vai trò aggregator ("super-bundle").** Tạo một repo riêng lồng tất cả các bundle của từng repo vào — qua git submodule (cơ chế nhúng repo con vào repo cha) hoặc một job đồng bộ định kỳ — với mỗi org là một thư mục cấp cao nhất:

   ```
   abc-knowledge-catalog/
   ├── index.md                  # sinh tự động: liên kết tới ba org
   ├── log.md
   ├── abc-infra/
   │   ├── index.md              # sinh tự động: liên kết tới các repo của org này
   │   ├── network-gateway/      # ← bundle knowledge/okf của repo đó
   │   └── k8s-platform/
   ├── abc-dev/
   │   ├── index.md
   │   ├── storefront/
   │   └── billing-api/
   └── abc-data/
       ├── index.md
       └── warehouse-pipelines/
   ```

3. **Chạy `reindex` tại gốc của aggregate.** Vì `reindex` duyệt đệ quy và ghi một `index.md` vào mọi thư mục, nó tự động sinh ra toàn bộ cây điều hướng org → repo → concept:

   ```bash
   python3 tools/okf-bundle/scripts/reindex.py --bundle .
   ```

4. **Diễn đạt quan hệ xuyên org bằng link Markdown thông thường** giữa các Concept, và/hoặc bằng các URI `resource` dùng chung. `resource` là một URI tự do — generator mặc định đặt nó là `repo://<source_path>`, nhưng một URL git đầy đủ hay `https://` đều hợp lệ; đây chính là điểm móc để trỏ Concept về nguồn thật của nó xuyên qua các repo. Không có cơ chế cưỡng chế nào; link chéo bị hỏng là non-fatal theo thiết kế.
5. **Trỏ một static-site/wiki generator** (MkDocs, Docusaurus, Backstage TechDocs, hoặc trình xem knowledge-catalog) vào gốc của aggregate. Các tệp `index.md` theo từng thư mục cung cấp sẵn cho nó cấu trúc điều hướng org/repo/concept.

Tóm lại, cách tổ chức wiki toàn công ty là thứ **bạn tự thiết kế** — qua cấu trúc thư mục, index và link — chứ không phải một tính năng OKF cung cấp sẵn. Điều này nhất quán với triết lý tối giản có chủ đích của OKF: cùng một bộ quy tắc áp dụng cho bundle của một repo cũng mở rộng được sang nhiều repo và nhiều org, mà không cần thêm bất kỳ cơ chế định dạng mới nào.
