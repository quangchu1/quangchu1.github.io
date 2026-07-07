---
title: 'Open Knowledge Format: Knowledge You Can Read, Diff, and Ship'
description: 'Google Cloud''s Open Knowledge Format (OKF) explained — what it is, why it matters, and how to use it. Bilingual: English + Tiếng Việt.'
pubDate: 'Jul 07 2026'
heroImage: '../../assets/blog-placeholder-1.jpg'
---

> **🇬🇧 English** · [🇻🇳 Tiếng Việt](#tiếng-việt)  
> *This post is bilingual. Scroll down for the Vietnamese version — Bài viết song ngữ; bản tiếng Việt ở bên dưới.*

AI agents do not just need access to data; they need the meaning around that data: what a table represents, which fields matter, where a metric came from, and what playbook to follow when something breaks. GoogleCloudPlatform's `knowledge-catalog` repository is about making that context easier to create, enrich, move, and consume. Its most important idea is the Open Knowledge Format, or OKF: a small, vendor-neutral way to store knowledge as Markdown files with YAML frontmatter.

## WHAT

**Knowledge Catalog** is Google Cloud's AI-powered data catalog and metadata management platform, formerly known as Dataplex. The project describes it as a way to build a dynamic knowledge graph over structured and unstructured data so AI agents get semantics and business context, not just raw assets.

The open-source `knowledge-catalog` repository contains tools, agents, samples, and demos around that goal. The center of gravity is **Open Knowledge Format (OKF)**.

**OKF** is an open format for representing knowledge: the metadata, context, and curated insight around data and systems. It is intentionally simple. An OKF corpus is a directory of UTF-8 Markdown files with YAML frontmatter. There is no schema registry, no central authority, and no required SDK. If you can read files, you can read OKF; if you can clone a repository, zip a folder, or serve static files, you can distribute it.

The core terms are small:

- **Knowledge Bundle**: a self-contained directory tree of knowledge documents. This is the unit you share, commit, archive, or serve.
- **Concept**: one unit of knowledge inside a bundle, represented by one Markdown file. A concept can describe a tangible asset, such as a BigQuery table, or an abstract one, such as a metric, API, business process, or playbook.
- **Concept ID**: the path to the concept file inside the bundle, without the `.md` suffix. For example, `tables/users.md` has concept ID `tables/users`.
- **Frontmatter**: a YAML metadata block at the top of a concept file, surrounded by `---` lines.
- **Body**: the Markdown content after the frontmatter.
- **Links**: normal Markdown links between concepts. OKF uses these to express relationships, but the meaning of the relationship comes from the surrounding prose.
- **Citations**: links to external sources that support claims in the concept body.

Every concept document needs parseable frontmatter with a non-empty `type` field. Other fields, such as `title`, `description`, `resource`, `tags`, and `timestamp`, are recommended but optional. Producers may add their own extra keys, and consumers should preserve and tolerate keys they do not understand.

Two reserved filenames give a bundle structure:

- `index.md` is an optional directory listing. It supports **progressive disclosure**, meaning a human or agent can inspect what is in a directory before loading every document.
- `log.md` is an optional chronological history for that directory, newest entries first.

All other `.md` files are concept documents.

## WHY

The problem OKF addresses is not just "where do we put metadata?" It is "how do we keep knowledge useful when both humans and agents need to read, write, review, and move it?"

A lot of catalog knowledge ends up trapped inside a service-owned store. That can work inside one platform, but it creates familiar problems: proprietary APIs, hard-to-review changes, limited portability, and migrations that depend on exports instead of ordinary source control. OKF takes a different path. It treats knowledge as files.

That choice matters for several reasons:

- **Human-readable**: an engineer can open a concept in any editor or terminal and understand it without a special UI.
- **Agent-readable**: an LLM can load the Markdown directly into context. The body can contain prose, tables, examples, schemas, and links in the same format people already write.
- **Git-native**: bundles can live in source control. Pull requests, diffs, review, blame, and history all work with no new workflow.
- **Portable**: a bundle is just a directory. It can be a git repository, a tarball, a zip archive, a subdirectory in a larger repo, or content hosted from a static file server.
- **No vendor lock-in**: OKF is not tied to a model provider, agent framework, serving system, or catalog product. The repo explicitly calls out humans, custom scripts, Google ADK agents, LangChain agents, existing catalog exports, static sites, search indexes, graph viewers, and knowledge-management tools as possible producers or consumers.
- **Structured and unstructured at once**: frontmatter captures the fields machines commonly filter on; Markdown captures the richer explanation people and models need.
- **Minimally opinionated**: OKF does not define a fixed taxonomy of concept types, prescribe infrastructure, or replace domain-specific schemas such as Avro, Protobuf, or OpenAPI. It references those kinds of schemas instead of absorbing them.

This is the practical appeal: OKF makes knowledge reviewable like code and readable like documentation, while still being structured enough for tools and agents to traverse.

## HOW

An OKF bundle works because it standardizes only a few conventions.

A bundle is a directory tree. Each non-reserved Markdown file is a concept. Each concept starts with YAML frontmatter. The only required field is `type`. The body is standard Markdown. Concepts link to each other with ordinary Markdown links, either bundle-relative links such as `/tables/customers.md` or normal relative links such as `./customers.md`.

A minimal concept looks like this:

```markdown
---
type: BigQuery Table
title: Orders
description: One row per completed customer order.
resource: https://console.cloud.google.com/bigquery?p=acme&d=sales&t=orders
tags: [sales, orders]
timestamp: 2026-05-28T00:00:00Z
---

# Schema

| Column        | Type    | Description                                  |
|---------------|---------|----------------------------------------------|
| `order_id`    | STRING  | Unique order identifier.                     |
| `customer_id` | STRING  | FK to [customers](/tables/customers.md).     |
| `total_usd`   | NUMERIC | Order total in USD.                          |

Part of the [sales dataset](/datasets/sales.md).

# Citations

[1] [BigQuery table schema](https://console.cloud.google.com/bigquery?p=acme&d=sales&t=orders)
```

A small bundle might look like this:

```text
my_bundle/
├── index.md
├── log.md
├── datasets/
│   ├── index.md
│   └── sales.md
└── tables/
    ├── index.md
    ├── orders.md
    └── customers.md
```

To produce a bundle by hand:

1. Create a directory for the bundle.
2. Add one Markdown file per concept.
3. Put YAML frontmatter at the top of every concept file, including at least `type`.
4. Use headings, lists, tables, and fenced code blocks in the body so the content is easy to scan and easy for agents to retrieve.
5. Link related concepts with Markdown links. Prefer bundle-relative links starting with `/` when you want links to stay stable as files move inside subdirectories.
6. Add citations under `# Citations` when the body relies on external material.
7. Optionally add `index.md` files for navigation and `log.md` files for history.
8. Commit the directory to git.

To produce a bundle automatically, the OKF package includes a reference agent. The examples in the repo show it running against public BigQuery datasets such as GA4 Google Merchandise Store, Stack Overflow, and Bitcoin. The agent can write one OKF document per dataset or table from BigQuery metadata, then optionally run a web pass from seed documentation URLs to enrich the bundle with additional context and references.

A typical command looks like this:

```bash
.venv/bin/python -m reference_agent enrich \
    --source bq \
    --dataset bigquery-public-data.stackoverflow \
    --web-seed-file samples/stackoverflow/seeds.txt \
    --out ./bundles/stackoverflow
```

The web pass is bounded: it uses explicit seed URLs, a maximum page count, depth controls, and allowed-host filtering. You can skip it with `--no-web` or focus on one concept with `--concept tables/posts_questions`.

To consume a bundle, read the files. That is the point. A consumer can parse frontmatter, render Markdown, follow links, build a search index, or turn the cross-links into a graph. OKF's conformance model is deliberately forgiving: consumers should not reject a bundle just because optional fields are missing, a `type` is unknown, an extra frontmatter key appears, an `index.md` file is missing, or a link points to knowledge that has not been written yet.

The repo includes a concrete consumer: a `visualize` command that turns a bundle into a single self-contained HTML file with a force-directed concept graph, a detail panel, rendered Markdown, search, type filtering, and computed backlinks.

```bash
.venv/bin/python -m reference_agent visualize --bundle ./bundles/stackoverflow
```

The broader repository also includes toolbox projects around Knowledge Catalog itself. **Metadata as Code** (`kcmd`) manages catalog metadata as YAML and Markdown artifacts, supports pull and push against the catalog service, and exposes a CLI, libraries, and an MCP server for agent workflows. The **Enrichment Agent** builds on that metadata-as-code workflow to extract information from sources and enrich catalog metadata so it becomes better context for agents.

Together, these pieces show the two directions OKF is designed for: producing knowledge from catalogs and documentation, and consuming knowledge through files, viewers, search, or agents.

## Takeaway

OKF is useful because it refuses to make knowledge management more mysterious than it needs to be. It says: put knowledge in Markdown, add a tiny amount of YAML structure, link concepts with normal Markdown links, and keep the result in a portable directory.

That makes catalog context readable by humans, usable by agents, diffable in git, and independent of any one vendor or runtime. For teams trying to make AI agents work with real systems, that is the important shift: the knowledge around the data becomes an artifact you can inspect, review, ship, and improve like code.

---

## Tiếng Việt

> **🇻🇳 Tiếng Việt** · [🇬🇧 English](#what) (bản tiếng Anh ở trên)

## LÀ GÌ

**Knowledge Catalog** là nền tảng danh mục dữ liệu (data catalog) và quản lý siêu dữ liệu (metadata) được hỗ trợ bởi AI của Google Cloud, trước đây được gọi là Dataplex. Dự án mô tả nó như một cách để xây dựng một đồ thị tri thức (knowledge graph) động trên dữ liệu có cấu trúc và phi cấu trúc, để các AI agent có được ngữ nghĩa (semantics) và ngữ cảnh nghiệp vụ (business context), chứ không chỉ là các tài sản thô.

Kho `knowledge-catalog` mã nguồn mở chứa các công cụ, agent, mẫu (samples) và bản demo xoay quanh mục tiêu đó. Trọng tâm chính là **Open Knowledge Format (OKF)**.

**OKF** là một định dạng mở để biểu diễn tri thức: siêu dữ liệu, ngữ cảnh và các thông tin chuyên sâu đã được chọn lọc xoay quanh dữ liệu và hệ thống. Nó được thiết kế đơn giản một cách có chủ đích. Một tập ngữ liệu (corpus) OKF là một thư mục gồm các tệp Markdown UTF-8 kèm YAML frontmatter. Không có registry lược đồ (schema registry), không có cơ quan quản lý trung tâm, và không yêu cầu SDK. Nếu bạn có thể đọc tệp, bạn có thể đọc OKF; nếu bạn có thể clone một repository, nén một thư mục, hoặc phục vụ (serve) các tệp tĩnh, bạn có thể phân phối nó.

Các thuật ngữ cốt lõi rất nhỏ gọn:

- **Knowledge Bundle**: một cây thư mục khép kín (self-contained) chứa các tài liệu tri thức. Đây là đơn vị bạn chia sẻ, commit, lưu trữ hoặc phục vụ.
- **Concept**: một đơn vị tri thức bên trong một bundle, được biểu diễn bằng một tệp Markdown. Một concept có thể mô tả một tài sản hữu hình, chẳng hạn một bảng BigQuery, hoặc một tài sản trừu tượng, chẳng hạn một chỉ số (metric), API, quy trình nghiệp vụ, hoặc playbook.
- **Concept ID**: đường dẫn đến tệp concept bên trong bundle, không kèm hậu tố `.md`. Ví dụ, `tables/users.md` có Concept ID là `tables/users`.
- **Frontmatter**: một khối siêu dữ liệu YAML ở đầu tệp concept, được bao quanh bởi các dòng `---`.
- **Body**: nội dung Markdown nằm sau phần frontmatter.
- **Links**: các liên kết Markdown thông thường giữa các concept. OKF dùng chúng để thể hiện các mối quan hệ, nhưng ý nghĩa của mối quan hệ đến từ đoạn văn (prose) xung quanh.
- **Citations**: các liên kết đến nguồn bên ngoài nhằm hỗ trợ cho những khẳng định trong phần body của concept.

Mọi tài liệu concept đều cần frontmatter có thể phân tích cú pháp (parseable) với một trường `type` không rỗng. Các trường khác, chẳng hạn `title`, `description`, `resource`, `tags`, và `timestamp`, được khuyến nghị nhưng không bắt buộc. Bên sản xuất (producers) có thể thêm các khóa (keys) bổ sung của riêng mình, và bên tiêu thụ (consumers) nên giữ nguyên và chấp nhận (tolerate) những khóa mà chúng không hiểu.

Hai tên tệp dành riêng (reserved) tạo nên cấu trúc cho một bundle:

- `index.md` là một danh sách thư mục tùy chọn. Nó hỗ trợ **tiết lộ tiệm tiến (progressive disclosure)**, nghĩa là một người hoặc một agent có thể kiểm tra những gì có trong một thư mục trước khi tải mọi tài liệu.
- `log.md` là một lịch sử theo trình tự thời gian tùy chọn cho thư mục đó, với các mục mới nhất được đặt trước.

Tất cả các tệp `.md` khác đều là tài liệu concept.

## TẠI SAO

Vấn đề mà OKF giải quyết không chỉ là "chúng ta đặt siêu dữ liệu ở đâu?" Mà là "làm thế nào để giữ cho tri thức luôn hữu ích khi cả con người lẫn agent đều cần đọc, ghi, xem xét (review) và di chuyển nó?"

Rất nhiều tri thức danh mục cuối cùng bị mắc kẹt bên trong một kho lưu trữ do dịch vụ sở hữu (service-owned store). Điều đó có thể ổn trong phạm vi một nền tảng, nhưng nó tạo ra những vấn đề quen thuộc: các API độc quyền (proprietary), những thay đổi khó review, khả năng di động (portability) hạn chế, và các cuộc di chuyển (migrations) phụ thuộc vào việc export thay vì quản lý phiên bản mã nguồn thông thường. OKF chọn một hướng đi khác. Nó xem tri thức như các tệp.

Lựa chọn đó có ý nghĩa vì nhiều lý do:

- **Con người đọc được (Human-readable)**: một kỹ sư có thể mở một concept trong bất kỳ trình soạn thảo hoặc terminal nào và hiểu nó mà không cần một giao diện đặc biệt.
- **Agent đọc được (Agent-readable)**: một LLM có thể tải trực tiếp Markdown vào ngữ cảnh (context). Phần body có thể chứa văn bản, bảng, ví dụ, lược đồ (schemas) và liên kết theo đúng định dạng mà con người vốn đã viết.
- **Gắn liền với Git (Git-native)**: các bundle có thể nằm trong hệ thống quản lý phiên bản mã nguồn. Pull request, diff, review, blame và lịch sử đều hoạt động mà không cần quy trình làm việc mới.
- **Có tính di động (Portable)**: một bundle chỉ là một thư mục. Nó có thể là một repository git, một tarball, một tệp nén zip, một thư mục con trong một repo lớn hơn, hoặc nội dung được lưu trữ từ một máy chủ tệp tĩnh.
- **Không bị khóa bởi nhà cung cấp (No vendor lock-in)**: OKF không bị ràng buộc với một nhà cung cấp mô hình, một framework agent, một hệ thống phục vụ, hay một sản phẩm danh mục nào. Repo nêu rõ con người, các script tùy chỉnh, các agent Google ADK, các agent LangChain, các bản export danh mục hiện có, các trang tĩnh, các chỉ mục tìm kiếm (search indexes), các trình xem đồ thị (graph viewers), và các công cụ quản lý tri thức đều là những bên sản xuất hoặc tiêu thụ khả dĩ.
- **Có cấu trúc và phi cấu trúc cùng lúc**: frontmatter nắm bắt các trường mà máy móc thường lọc theo; Markdown nắm bắt phần giải thích phong phú hơn mà con người và mô hình cần đến.
- **Ít áp đặt quan điểm nhất (Minimally opinionated)**: OKF không định nghĩa một phân loại (taxonomy) cố định về các loại concept, không quy định hạ tầng, và không thay thế các lược đồ chuyên biệt theo lĩnh vực như Avro, Protobuf, hay OpenAPI. Thay vào đó, nó tham chiếu đến những loại lược đồ đó thay vì thâu tóm chúng.

Đây là điểm hấp dẫn thực tiễn: OKF làm cho tri thức có thể được review giống như mã nguồn và đọc được giống như tài liệu, trong khi vẫn đủ cấu trúc để các công cụ và agent duyệt qua.

## CÁCH DÙNG

Một bundle OKF hoạt động được vì nó chỉ chuẩn hóa một vài quy ước.

Một bundle là một cây thư mục. Mỗi tệp Markdown không dành riêng (non-reserved) là một concept. Mỗi concept bắt đầu bằng YAML frontmatter. Trường bắt buộc duy nhất là `type`. Phần body là Markdown tiêu chuẩn. Các concept liên kết với nhau bằng các liên kết Markdown thông thường, có thể là liên kết tương đối theo bundle (bundle-relative) như `/tables/customers.md` hoặc liên kết tương đối thông thường như `./customers.md`.

Một concept tối giản trông như sau:

```markdown
---
type: BigQuery Table
title: Orders
description: One row per completed customer order.
resource: https://console.cloud.google.com/bigquery?p=acme&d=sales&t=orders
tags: [sales, orders]
timestamp: 2026-05-28T00:00:00Z
---

# Schema

| Column        | Type    | Description                                  |
|---------------|---------|----------------------------------------------|
| `order_id`    | STRING  | Unique order identifier.                     |
| `customer_id` | STRING  | FK to [customers](/tables/customers.md).     |
| `total_usd`   | NUMERIC | Order total in USD.                          |

Part of the [sales dataset](/datasets/sales.md).

# Citations

[1] [BigQuery table schema](https://console.cloud.google.com/bigquery?p=acme&d=sales&t=orders)
```

Một bundle nhỏ có thể trông như sau:

```text
my_bundle/
├── index.md
├── log.md
├── datasets/
│   ├── index.md
│   └── sales.md
└── tables/
    ├── index.md
    ├── orders.md
    └── customers.md
```

Để tạo một bundle thủ công:

1. Tạo một thư mục cho bundle.
2. Thêm một tệp Markdown cho mỗi concept.
3. Đặt YAML frontmatter ở đầu mỗi tệp concept, ít nhất phải bao gồm `type`.
4. Sử dụng tiêu đề (headings), danh sách, bảng và khối mã (fenced code blocks) trong phần body để nội dung dễ đọc lướt và dễ để agent truy xuất.
5. Liên kết các concept có liên quan bằng các liên kết Markdown. Ưu tiên các liên kết tương đối theo bundle bắt đầu bằng `/` khi bạn muốn các liên kết luôn ổn định khi các tệp được di chuyển bên trong các thư mục con.
6. Thêm citations dưới mục `# Citations` khi phần body dựa vào tài liệu bên ngoài.
7. Tùy chọn thêm các tệp `index.md` để điều hướng và `log.md` để lưu lịch sử.
8. Commit thư mục đó vào git.

Để tạo một bundle tự động, gói OKF bao gồm một agent tham chiếu (reference agent). Các ví dụ trong repo cho thấy nó chạy trên các tập dữ liệu (datasets) BigQuery công khai như GA4 Google Merchandise Store, Stack Overflow, và Bitcoin. Agent có thể viết một tài liệu OKF cho mỗi dataset hoặc bảng từ siêu dữ liệu BigQuery, sau đó tùy chọn chạy một lượt duyệt web từ các URL tài liệu hạt giống (seed) để làm giàu bundle với ngữ cảnh và tham chiếu bổ sung.

Một lệnh điển hình trông như sau:

```bash
.venv/bin/python -m reference_agent enrich \
    --source bq \
    --dataset bigquery-public-data.stackoverflow \
    --web-seed-file samples/stackoverflow/seeds.txt \
    --out ./bundles/stackoverflow
```

Lượt duyệt web được giới hạn: nó sử dụng các URL hạt giống (seed URLs) rõ ràng, một số trang tối đa, các điều khiển độ sâu (depth), và bộ lọc host được cho phép (allowed-host). Bạn có thể bỏ qua nó với `--no-web` hoặc tập trung vào một concept với `--concept tables/posts_questions`.

Để tiêu thụ một bundle, hãy đọc các tệp. Đó chính là điểm mấu chốt. Một bên tiêu thụ có thể phân tích cú pháp frontmatter, render Markdown, đi theo các liên kết, xây dựng một chỉ mục tìm kiếm, hoặc biến các liên kết chéo (cross-links) thành một đồ thị. Mô hình tuân thủ (conformance) của OKF được thiết kế khoan dung một cách có chủ đích: bên tiêu thụ không nên từ chối một bundle chỉ vì thiếu các trường tùy chọn, một `type` không xác định, một khóa frontmatter bổ sung xuất hiện, thiếu một tệp `index.md`, hoặc một liên kết trỏ đến tri thức chưa được viết ra.

Repo bao gồm một bên tiêu thụ cụ thể: một lệnh `visualize` biến một bundle thành một tệp HTML khép kín duy nhất với một đồ thị concept dạng lực định hướng (force-directed), một bảng chi tiết, Markdown được render, tìm kiếm, lọc theo type, và các liên kết ngược (backlinks) được tính toán.

```bash
.venv/bin/python -m reference_agent visualize --bundle ./bundles/stackoverflow
```

Repository rộng hơn cũng bao gồm các dự án toolbox xoay quanh chính Knowledge Catalog. **Metadata as Code** (`kcmd`) quản lý siêu dữ liệu danh mục dưới dạng các artifact YAML và Markdown, hỗ trợ pull và push với dịch vụ danh mục, và cung cấp một CLI, các thư viện, và một MCP server cho các quy trình làm việc của agent. **Enrichment Agent** được xây dựng dựa trên quy trình metadata-as-code đó để trích xuất thông tin từ các nguồn và làm giàu siêu dữ liệu danh mục để nó trở thành ngữ cảnh tốt hơn cho các agent.

Cùng với nhau, những mảnh ghép này cho thấy hai hướng mà OKF được thiết kế cho: tạo ra tri thức từ các danh mục và tài liệu, và tiêu thụ tri thức thông qua các tệp, trình xem, tìm kiếm, hoặc agent.

## Điều cốt lõi

OKF hữu ích vì nó từ chối làm cho việc quản lý tri thức trở nên bí ẩn hơn mức cần thiết. Nó nói rằng: hãy đặt tri thức vào Markdown, thêm một lượng nhỏ cấu trúc YAML, liên kết các concept bằng các liên kết Markdown thông thường, và giữ kết quả trong một thư mục có tính di động.

Điều đó làm cho ngữ cảnh danh mục con người đọc được, agent dùng được, có thể diff trong git, và độc lập với bất kỳ nhà cung cấp hay môi trường chạy (runtime) đơn lẻ nào. Đối với các đội nhóm đang cố gắng làm cho AI agent hoạt động với các hệ thống thực tế, đó là sự chuyển dịch quan trọng: tri thức xoay quanh dữ liệu trở thành một artifact mà bạn có thể kiểm tra, review, xuất xưởng (ship), và cải thiện giống như mã nguồn.
