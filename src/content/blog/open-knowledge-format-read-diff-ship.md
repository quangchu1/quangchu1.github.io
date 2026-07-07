---
title: 'Open Knowledge Format: Knowledge You Can Read, Diff, and Ship'
description: 'A plain-language guide to Google Cloud''s Open Knowledge Format (OKF): what it is, why it matters, and how to build and use portable knowledge bundles.'
pubDate: 'Jul 07 2026'
heroImage: '../../assets/blog-placeholder-1.jpg'
---

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
