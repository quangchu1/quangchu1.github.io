---
title: 'Turning Online Boutique into an Agent-Readable OKF Knowledge Bundle'
description: 'A real case study: applying the Open Knowledge Format (OKF) to the Online Boutique microservices demo. Bilingual: English + Tiếng Việt.'
pubDate: 'Jul 11 2026'
heroImage: '../../assets/blog-placeholder-2.jpg'
---


> **🇬🇧 English** · [🇻🇳 Tiếng Việt](#tiếng-việt)  
> *This post is bilingual. Scroll down for the Vietnamese version — Bài viết song ngữ; bản tiếng Việt ở bên dưới.*

Microservices codebases are easy to split and hard to understand as a whole. In this case study, we applied the Open Knowledge Format (OKF) to the public Online Boutique microservices demo and produced a small, portable, git-native knowledge bundle that describes the system in one place.

## WHAT

OKF is an open, vendor-neutral format for representing knowledge as a bundle of plain Markdown files with YAML frontmatter. It is intentionally minimal: a directory tree of `.md` files, a required `type` field for each concept document, and a few reserved filenames with defined meaning.

The core idea is simple:

- A **Knowledge Bundle** is a self-contained directory of knowledge documents.
- A **Concept** is one unit of knowledge, represented as one Markdown file.
- Each concept has YAML frontmatter at the top and a Markdown body underneath.
- The only required concept field is `type`.
- Producers can add useful fields such as `title`, `description`, `resource`, `tags`, `timestamp`, and producer-defined keys.
- `index.md` files provide progressive disclosure: a human or agent can inspect what is in a directory before opening every concept.
- `log.md` files record dated change history.

OKF does not define a fixed taxonomy of concept types, require a schema registry, or depend on a specific AI framework, model provider, serving system, or proprietary API. The format is meant to be readable by humans, parseable by agents, diffable in version control, and portable across tools.

What we applied it to was the public **Online Boutique** demo: **[Upstream demo: GoogleCloudPlatform/microservices-demo](https://github.com/GoogleCloudPlatform/microservices-demo)**. It is an Apache-2.0 licensed, cloud-first microservices demo: a 10+ service e-commerce app across multiple languages.

The resulting case-study repository is here: **[Case-study repo: quangchu1/okf-microservices-demo](https://github.com/quangchu1/okf-microservices-demo)**.

The OKF format and reference tooling live here: **[OKF / Knowledge Catalog: GoogleCloudPlatform/knowledge-catalog](https://github.com/GoogleCloudPlatform/knowledge-catalog)**.

## WHY

A microservices repository already contains a lot of knowledge, but it is scattered by design.

Each service has its own source path, runtime, local conventions, and surrounding documentation. That is fine for ownership and deployment, but it makes the system harder to read as a single product. A new engineer or AI agent has to reconstruct the map by walking many folders and files.

Turning the repo into an OKF bundle gives that map a concrete form.

- **Scattered knowledge becomes navigable.** Instead of asking someone to infer the service list from the source tree, the bundle gives each service a concept document with its name, source path, language/runtime, description, and resource URI.

- **Onboarding gets a stable starting point.** A person can begin with `knowledge/okf/index.md`, browse into `services/`, and open one concept at a time. An agent can do the same without loading the entire repository into context.

- **The system becomes agent-readable.** OKF uses Markdown plus YAML frontmatter. That means an agent can ingest a concept directly, preserve structured fields, and still read the prose body naturally.

- **Knowledge stays git-native.** The bundle lives in the repository. Diffs, pull requests, review, blame, and history all work the same way they do for source code.

- **The output is portable.** A bundle is just a directory. It can be committed to a repo, shipped as an archive, mounted from a filesystem, rendered by tools that understand Markdown and frontmatter, or consumed by a search index or graph viewer.

- **There is no vendor lock-in.** OKF is not tied to a particular catalog product, agent framework, model provider, or serving layer. The knowledge remains accessible even if the tools around it change.

That makes OKF a practical fit for microservices: it does not replace the code, docs, or platform metadata. It gives the knowledge around them a small, standard shape.

## HOW

We applied OKF using a reusable `okf-bundle` generator. The workflow was mechanical and repeatable:

1. **Discover** — scan the repository and identify the microservices under `src/`, including their source paths and language/runtime metadata.

2. **Enrich** — create one OKF `Service` concept per microservice and `Reference` concepts for project docs, adding frontmatter and Markdown bodies.

3. **Reindex** — generate `index.md` files at the bundle root and inside folders so humans and agents can browse progressively.

4. **Logstamp** — update `log.md` with dated change history for the generated bundle.

5. **Validate** — check the result against OKF v0.1 conformance rules.

The bundle was committed under `knowledge/okf/` inside the case-study repo:

```text
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

The generator produced 12 `type: Service` concepts, one for each microservice:

- `adservice`
- `cartservice`
- `checkoutservice`
- `currencyservice`
- `emailservice`
- `frontend`
- `loadgenerator`
- `paymentservice`
- `productcatalogservice`
- `recommendationservice`
- `shippingservice`
- `shoppingassistantservice`

It also produced 8 `type: Reference` concepts for project docs. That gives a total of **20 OKF concepts**: **12 Service concepts + 8 Reference concepts**.

Here is the real `cartservice` Service concept from the generated bundle:

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

This example shows the OKF pattern in miniature. The required `type` field tells consumers what kind of concept this is. The `resource` field points back to the service location in the repository. The Markdown body remains readable on its own. Extra producer-defined fields such as `source_path`, `source_fingerprint`, `okf_template_version`, and `language` add useful local metadata without breaking OKF consumers.

The validation result was clean: the generated bundle is **OKF v0.1 §9 conformant**, with **0 hard failures** and **0 warnings**. Every non-reserved `.md` file has parseable YAML frontmatter with a non-empty `type`, and the reserved `index.md` and `log.md` files follow the OKF structure.

The process was also **idempotent**: re-running the generator over the unchanged repository yields no diff. That matters because it makes regeneration practical in normal development workflows. A team can refresh the bundle without creating noisy commits.

## Takeaway

Applying OKF to Online Boutique turned a polyglot microservices demo into a concise, navigable knowledge bundle: **20 concepts total**, with **12 services**, **8 references**, clean OKF v0.1 validation, and an idempotent generation workflow.

The important part is not that the bundle is large or elaborate. It is the opposite: the artifact is small, plain, and easy to inspect. It gives humans and agents the same git-native map of the system, without introducing a database, hosted catalog, SDK, or vendor-specific format.

Start with the three repositories:

- **Case-study repo:** https://github.com/quangchu1/okf-microservices-demo
- **Upstream demo:** https://github.com/GoogleCloudPlatform/microservices-demo
- **OKF / Knowledge Catalog:** https://github.com/GoogleCloudPlatform/knowledge-catalog

For a microservices codebase, that is the practical promise of OKF: keep the source where it is, but make the knowledge around it explicit, portable, and ready to read.

---

## Tiếng Việt

> **🇻🇳 Tiếng Việt** · [🇬🇧 English](#what) (bản tiếng Anh ở trên)

## LÀ GÌ

OKF là một định dạng mở, trung lập với nhà cung cấp, dùng để biểu diễn tri thức dưới dạng một bundle gồm các tệp Markdown thuần với YAML frontmatter. Nó được thiết kế tối giản một cách có chủ đích: một cây thư mục gồm các tệp `.md`, một trường `type` bắt buộc cho mỗi tài liệu concept, và một vài tên tệp dành riêng (reserved filenames) có ý nghĩa được định nghĩa sẵn.

Ý tưởng cốt lõi rất đơn giản:

- Một **Knowledge Bundle** là một thư mục khép kín (self-contained) chứa các tài liệu tri thức.
- Một **Concept** là một đơn vị tri thức, được biểu diễn dưới dạng một tệp Markdown.
- Mỗi concept có YAML frontmatter ở phần đầu và một phần thân (body) Markdown bên dưới.
- Trường concept bắt buộc duy nhất là `type`.
- Bên sản xuất (producer) có thể bổ sung các trường hữu ích như `title`, `description`, `resource`, `tags`, `timestamp`, và các khóa do producer tự định nghĩa.
- Các tệp `index.md` cung cấp khả năng bộc lộ dần dần (progressive disclosure): con người hoặc agent có thể kiểm tra những gì có trong một thư mục trước khi mở từng concept.
- Các tệp `log.md` ghi lại lịch sử thay đổi theo ngày.

OKF không định nghĩa một hệ phân loại (taxonomy) cố định cho các loại concept, không yêu cầu một schema registry, và không phụ thuộc vào một framework AI, nhà cung cấp mô hình, hệ thống phục vụ (serving system), hay API độc quyền cụ thể nào. Định dạng này nhằm mục đích để con người đọc được, agent phân tích cú pháp được, so sánh khác biệt (diff) được trong hệ thống quản lý phiên bản, và dễ mang theo giữa các công cụ.

Thứ mà chúng tôi áp dụng nó lên là bản demo công khai **Online Boutique**: **[Upstream demo: GoogleCloudPlatform/microservices-demo](https://github.com/GoogleCloudPlatform/microservices-demo)**. Đây là một bản demo microservices ưu tiên đám mây (cloud-first), được cấp phép Apache-2.0: một ứng dụng thương mại điện tử với hơn 10 service viết bằng nhiều ngôn ngữ.

Kho lưu trữ (repository) của nghiên cứu tình huống này nằm ở đây: **[Case-study repo: quangchu1/okf-microservices-demo](https://github.com/quangchu1/okf-microservices-demo)**.

Định dạng OKF và bộ công cụ tham chiếu (reference tooling) nằm ở đây: **[OKF / Knowledge Catalog: GoogleCloudPlatform/knowledge-catalog](https://github.com/GoogleCloudPlatform/knowledge-catalog)**.

## TẠI SAO

Một kho lưu trữ microservices vốn đã chứa rất nhiều tri thức, nhưng tri thức đó bị phân tán theo đúng thiết kế.

Mỗi service có đường dẫn mã nguồn riêng, môi trường chạy (runtime) riêng, các quy ước cục bộ riêng, và tài liệu đi kèm riêng. Điều đó ổn cho việc phân quyền sở hữu và triển khai, nhưng lại khiến hệ thống khó đọc hiểu như một sản phẩm duy nhất. Một kỹ sư mới hoặc một AI agent phải tự tái dựng lại tấm bản đồ bằng cách đi qua nhiều thư mục và tệp tin.

Biến kho lưu trữ thành một OKF bundle giúp tấm bản đồ đó có một hình hài cụ thể.

- **Tri thức phân tán trở nên dễ điều hướng.** Thay vì yêu cầu ai đó suy luận ra danh sách service từ cây mã nguồn, bundle cấp cho mỗi service một tài liệu concept với tên, đường dẫn mã nguồn, ngôn ngữ/runtime, mô tả, và resource URI của nó.

- **Việc onboarding có một điểm khởi đầu ổn định.** Một người có thể bắt đầu với `knowledge/okf/index.md`, duyệt vào `services/`, và mở từng concept một. Một agent cũng có thể làm điều tương tự mà không cần nạp toàn bộ kho lưu trữ vào ngữ cảnh (context).

- **Hệ thống trở nên agent-readable (agent đọc được).** OKF dùng Markdown cộng với YAML frontmatter. Điều đó có nghĩa là một agent có thể tiếp nhận một concept một cách trực tiếp, giữ nguyên các trường có cấu trúc, và vẫn đọc được phần thân văn xuôi một cách tự nhiên.

- **Tri thức vẫn ở dạng git-native.** Bundle nằm ngay trong kho lưu trữ. Diff, pull request, review, blame, và history đều hoạt động y hệt như đối với mã nguồn.

- **Đầu ra dễ mang theo.** Một bundle chỉ đơn thuần là một thư mục. Nó có thể được commit vào một repo, đóng gói thành một tệp lưu trữ (archive), mount từ một hệ thống tệp, được kết xuất (render) bởi các công cụ hiểu Markdown và frontmatter, hoặc được tiêu thụ bởi một chỉ mục tìm kiếm (search index) hay một trình xem đồ thị (graph viewer).

- **Không có tình trạng khóa nhà cung cấp (vendor lock-in).** OKF không bị ràng buộc với một sản phẩm catalog, framework agent, nhà cung cấp mô hình, hay lớp phục vụ cụ thể nào. Tri thức vẫn có thể truy cập được ngay cả khi các công cụ xung quanh nó thay đổi.

Điều đó khiến OKF trở thành một lựa chọn thiết thực cho microservices: nó không thay thế mã nguồn, tài liệu, hay siêu dữ liệu (metadata) của nền tảng. Nó mang lại cho lớp tri thức xung quanh chúng một hình hài nhỏ gọn, chuẩn hóa.

## CÁCH THỰC HIỆN

Chúng tôi áp dụng OKF bằng một trình tạo (generator) `okf-bundle` có thể tái sử dụng. Quy trình mang tính cơ học và có thể lặp lại:

1. **Discover** — quét kho lưu trữ và xác định các microservices nằm dưới `src/`, bao gồm cả đường dẫn mã nguồn và siêu dữ liệu ngôn ngữ/runtime của chúng.

2. **Enrich** — tạo một OKF `Service` concept cho mỗi microservice và các `Reference` concept cho tài liệu dự án, bổ sung frontmatter và phần thân Markdown.

3. **Reindex** — tạo các tệp `index.md` ở gốc bundle và bên trong các thư mục để con người và agent có thể duyệt dần dần.

4. **Logstamp** — cập nhật `log.md` với lịch sử thay đổi theo ngày cho bundle đã được tạo.

5. **Validate** — kiểm tra kết quả dựa trên các quy tắc tuân thủ (conformance) OKF v0.1.

Bundle được commit dưới `knowledge/okf/` bên trong kho lưu trữ của nghiên cứu tình huống:

```text
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

Trình tạo đã sản sinh ra 12 concept `type: Service`, mỗi concept cho một microservice:

- `adservice`
- `cartservice`
- `checkoutservice`
- `currencyservice`
- `emailservice`
- `frontend`
- `loadgenerator`
- `paymentservice`
- `productcatalogservice`
- `recommendationservice`
- `shippingservice`
- `shoppingassistantservice`

Nó cũng sản sinh ra 8 concept `type: Reference` cho tài liệu dự án. Điều đó cho ra tổng cộng **20 OKF concept**: **12 Service concept + 8 Reference concept**.

Dưới đây là concept `cartservice` Service thực tế từ bundle đã được tạo:

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

Ví dụ này cho thấy khuôn mẫu OKF ở dạng thu nhỏ. Trường `type` bắt buộc cho bên tiêu thụ (consumer) biết đây là loại concept gì. Trường `resource` trỏ ngược về vị trí của service trong kho lưu trữ. Phần thân Markdown vẫn tự nó đọc được. Các trường bổ sung do producer tự định nghĩa như `source_path`, `source_fingerprint`, `okf_template_version`, và `language` bổ sung siêu dữ liệu cục bộ hữu ích mà không phá vỡ các OKF consumer.

Kết quả kiểm tra rất sạch: bundle được tạo ra **tuân thủ OKF v0.1 §9**, với **0 lỗi nghiêm trọng (hard failures)** và **0 cảnh báo (warnings)**. Mọi tệp `.md` không dành riêng đều có YAML frontmatter phân tích cú pháp được với một `type` không rỗng, và các tệp dành riêng `index.md` cùng `log.md` tuân theo cấu trúc OKF.

Quy trình này cũng **idempotent (bất biến khi lặp lại)**: chạy lại trình tạo trên kho lưu trữ không thay đổi sẽ không tạo ra diff nào. Điều đó quan trọng vì nó khiến việc tái tạo (regeneration) trở nên thiết thực trong các quy trình phát triển thông thường. Một nhóm có thể làm mới bundle mà không tạo ra các commit gây nhiễu.

## Điều cốt lõi

Việc áp dụng OKF cho Online Boutique đã biến một bản demo microservices đa ngôn ngữ (polyglot) thành một knowledge bundle súc tích, dễ điều hướng: **tổng cộng 20 concept**, với **12 service**, **8 reference**, kết quả kiểm tra OKF v0.1 sạch, và một quy trình tạo idempotent.

Điều quan trọng không phải là bundle lớn hay cầu kỳ. Ngược lại là đằng khác: sản phẩm nhỏ gọn, thuần túy, và dễ kiểm tra. Nó mang lại cho con người và agent cùng một tấm bản đồ git-native của hệ thống, mà không cần đưa vào một cơ sở dữ liệu, catalog được lưu trữ (hosted catalog), SDK, hay định dạng đặc thù của nhà cung cấp.

Hãy bắt đầu với ba kho lưu trữ:

- **Case-study repo:** https://github.com/quangchu1/okf-microservices-demo
- **Upstream demo:** https://github.com/GoogleCloudPlatform/microservices-demo
- **OKF / Knowledge Catalog:** https://github.com/GoogleCloudPlatform/knowledge-catalog

Đối với một codebase microservices, đó chính là lời hứa thiết thực của OKF: giữ nguyên mã nguồn ở chỗ của nó, nhưng làm cho lớp tri thức xung quanh nó trở nên tường minh, dễ mang theo, và sẵn sàng để đọc.
