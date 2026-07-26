---
title: 'Codex Plugin for Claude Code: Review and Delegate from One Workflow'
description: 'A bilingual (English/Vietnamese) look at openai/codex-plugin-cc — the official Codex plugin that brings code review and task delegation into Claude Code.'
pubDate: 'Jul 26 2026'
---

> Bilingual post — English first, then Vietnamese. / Bài viết song ngữ — Tiếng Anh trước, sau đó Tiếng Việt.

## English

### What it is

`openai/codex-plugin-cc` is OpenAI's official Codex plugin for Claude Code. It lets you invoke Codex — for code review or for delegated engineering work — from inside a Claude Code session, without leaving the workflow you already use. The plugin ships as a Claude Code plugin marketplace entry (`openai-codex`, plugin name `codex`, version 1.0.6) and exposes its functionality through a set of `/codex:*` slash commands plus a `codex:codex-rescue` subagent. It is aimed squarely at Claude Code users who want an easy on-ramp to Codex rather than a second, parallel tooling stack.

### Key features

The plugin's surface is a small, purposeful set of slash commands.

**`/codex:review`** runs a normal Codex review on your current work, giving the same quality of review as running `/review` inside Codex directly. Use it for uncommitted changes, or pass `--base <ref>` to review your branch against a base like `main`. It also supports `--wait` and `--background`. It is deliberately *not* steerable and takes no custom focus text.

```bash
/codex:review
/codex:review --base main
/codex:review --background
```

**`/codex:adversarial-review`** is the steerable counterpart: it questions the chosen implementation and design rather than just the code details. It pressure-tests assumptions, tradeoffs, failure modes, and whether a different approach would have been safer or simpler. It uses the same target selection as `/codex:review` (including `--base <ref>`, `--wait`, `--background`) but accepts extra focus text after the flags.

```bash
/codex:adversarial-review
/codex:adversarial-review --base main challenge whether this was the right caching and retry design
/codex:adversarial-review --background look for race conditions and question the chosen approach
```

**`/codex:rescue`** hands a task to Codex through the `codex:codex-rescue` subagent — investigate a bug, try a fix, continue a previous Codex task, or take a faster/cheaper pass with a smaller model. It supports `--background`, `--wait`, `--resume`, and `--fresh`; omit `--resume` and `--fresh` and the plugin can offer to continue the latest rescue thread for the repo. If you don't pass `--model` or `--effort`, Codex chooses its own defaults; saying `spark` maps to `gpt-5.3-codex-spark`.

```bash
/codex:rescue investigate why the tests started failing
/codex:rescue --resume apply the top fix from the last run
/codex:rescue --model gpt-5.4-mini --effort medium investigate the flaky integration test
```

You can also simply ask in prose — "Ask Codex to redesign the database connection to be more resilient." — and the work gets delegated.

**`/codex:transfer`** creates a persistent Codex thread from the current Claude Code session and prints a `codex resume <session-id>` command, so a debugging conversation started in Claude Code can continue with the same context in Codex. The plugin's `SessionStart` hook supplies the transcript path automatically; `--source` is a manual override. The source must live under `~/.claude/projects`, and the transfer uses Codex's external-agent session importer — so it follows the same conversion rules as importing Claude history in the Codex App and produces visible, continuable turns. Older Codex versions without session import must be upgraded first.

**`/codex:status`**, **`/codex:result`**, and **`/codex:cancel`** manage background jobs for the current repository: list running and recent jobs, show the final stored output of a finished job (including the Codex session ID when available, so you can reopen the run with `codex resume <session-id>`), and cancel an active background job. Each accepts an optional task ID, e.g. `/codex:status task-abc123`.

**`/codex:setup`** checks whether Codex is installed and authenticated, and can offer to install Codex for you if it's missing and npm is available. It also manages the optional **review gate**:

```bash
/codex:setup --enable-review-gate
/codex:setup --disable-review-gate
```

With the review gate enabled, the plugin uses a `Stop` hook to run a targeted Codex review based on Claude's response; if that review finds issues, the stop is blocked so Claude addresses them first.

### Installation

Requirements: a **ChatGPT subscription (including Free) or an OpenAI API key** — usage contributes to your Codex usage limits — and **Node.js 18.18 or later**.

Add the marketplace in Claude Code:

```bash
/plugin marketplace add openai/codex-plugin-cc
```

Install the plugin:

```bash
/plugin install codex@openai-codex
```

Reload plugins:

```bash
/reload-plugins
```

Then run:

```bash
/codex:setup
```

To install Codex yourself instead:

```bash
npm install -g @openai/codex
```

If Codex is installed but not logged in:

```bash
!codex login
```

After install you should see the slash commands listed above plus the `codex:codex-rescue` subagent in `/agents`. A good first run:

```bash
/codex:review --background
/codex:status
/codex:result
```

### How it integrates with Codex

The plugin wraps the Codex **app server**. It does not bundle a separate Codex runtime: it uses the global `codex` binary already installed in your environment, the same local Codex CLI authentication state, the same repository checkout and machine-local environment, and the same configuration files. If you are already signed into Codex on this machine, that account works here immediately.

Configuration resolves from user-level `~/.codex/config.toml` plus project-level overrides in `.codex/config.toml`, with project-level overrides loading only when the project is trusted. So to change the default model or reasoning effort for a project, drop this into `.codex/config.toml` at the root of the directory where you started Claude:

```toml
model = "gpt-5.4-mini"
model_reasoning_effort = "high"
```

Existing sign-in methods and base-URL setups carry over; `openai_base_url` in your Codex config still points the built-in OpenAI provider at a different endpoint. Delegated tasks and stop-gate runs can be resumed directly in Codex via `codex resume`, either with a session ID from `/codex:result` or `/codex:status`, or by picking from the list — useful for reviewing or continuing Codex's work in its native environment.

### Notes and caveats

Both review commands are strictly read-only: `/codex:review` will not perform any changes, and `/codex:adversarial-review` does not fix code. Reviews — especially across multi-file changes — can take a while, so running them with `--background` is generally recommended, then checking in with `/codex:status` and `/codex:cancel`. The same advice applies to `/codex:rescue`: depending on the task and model, it can run long, so force it into the background or move the agent there. The most important warning concerns the review gate: it can create a long-running Claude/Codex loop and may drain usage limits quickly. Enable it only when you plan to actively monitor the session.

### Repo facts

- **Repository:** [github.com/openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc)
- **License:** Apache-2.0
- **Primary language:** JavaScript
- **Stars:** 29,948 · **Forks:** 1,940 · **Open issues:** 377
- **Default branch:** `main`
- **Marketplace:** `openai-codex` (owner: OpenAI), plugin `codex`, version 1.0.6

---

## Tiếng Việt

### Nó là gì

`openai/codex-plugin-cc` là plugin Codex chính thức của OpenAI dành cho Claude Code. Nó cho phép bạn gọi Codex — để review code hoặc để giao việc kỹ thuật — ngay bên trong một phiên Claude Code, mà không phải rời khỏi quy trình làm việc quen thuộc. Plugin được phát hành dưới dạng một mục trong plugin marketplace của Claude Code (marketplace `openai-codex`, plugin `codex`, phiên bản 1.0.6) và cung cấp chức năng qua một nhóm slash command `/codex:*` cùng một subagent `codex:codex-rescue`. Nó hướng đến người dùng Claude Code muốn bắt đầu dùng Codex một cách dễ dàng, thay vì phải dựng thêm một bộ công cụ song song.

### Tính năng chính

Plugin có bề mặt sử dụng gọn gàng, mỗi lệnh một mục đích rõ ràng.

**`/codex:review`** chạy một bản review Codex thông thường trên phần việc hiện tại, cho chất lượng review tương đương khi chạy `/review` trực tiếp trong Codex. Dùng cho các thay đổi chưa commit, hoặc truyền `--base <ref>` để review nhánh của bạn so với một nhánh gốc như `main`. Lệnh cũng hỗ trợ `--wait` và `--background`. Nó cố ý *không* cho phép định hướng (steer) và không nhận thêm văn bản mô tả trọng tâm.

```bash
/codex:review
/codex:review --base main
/codex:review --background
```

**`/codex:adversarial-review`** là phiên bản có thể định hướng: nó chất vấn cách triển khai và thiết kế đã chọn, không chỉ soi chi tiết code. Lệnh này gây áp lực kiểm tra các giả định, đánh đổi (tradeoff), chế độ hỏng hóc (failure mode), và liệu một hướng tiếp cận khác có an toàn hơn hoặc đơn giản hơn không. Nó dùng cùng cách chọn phạm vi review như `/codex:review` (gồm `--base <ref>`, `--wait`, `--background`) nhưng nhận thêm văn bản trọng tâm sau các flag.

```bash
/codex:adversarial-review
/codex:adversarial-review --base main challenge whether this was the right caching and retry design
/codex:adversarial-review --background look for race conditions and question the chosen approach
```

**`/codex:rescue`** giao một nhiệm vụ cho Codex thông qua subagent `codex:codex-rescue` — điều tra một lỗi, thử một bản sửa, tiếp tục một nhiệm vụ Codex trước đó, hoặc chạy một lượt nhanh và tiết kiệm hơn bằng model nhỏ hơn. Lệnh hỗ trợ `--background`, `--wait`, `--resume` và `--fresh`; nếu bỏ qua cả `--resume` và `--fresh`, plugin có thể đề nghị tiếp tục luồng rescue gần nhất của repo. Nếu bạn không truyền `--model` hay `--effort`, Codex tự chọn giá trị mặc định của nó; nói `spark` sẽ được map thành `gpt-5.3-codex-spark`.

```bash
/codex:rescue investigate why the tests started failing
/codex:rescue --resume apply the top fix from the last run
/codex:rescue --model gpt-5.4-mini --effort medium investigate the flaky integration test
```

Bạn cũng có thể yêu cầu bằng ngôn ngữ tự nhiên — "Ask Codex to redesign the database connection to be more resilient." — và công việc sẽ được giao cho Codex.

**`/codex:transfer`** tạo một thread Codex bền vững từ phiên Claude Code hiện tại và in ra câu lệnh `codex resume <session-id>`, để một cuộc trao đổi gỡ lỗi bắt đầu trong Claude Code có thể tiếp tục với cùng ngữ cảnh bên Codex. Hook `SessionStart` của plugin tự động cung cấp đường dẫn transcript hiện tại; `--source` là tùy chọn ghi đè thủ công. Nguồn phải nằm trong `~/.claude/projects`, và quá trình chuyển dùng bộ nhập phiên external-agent của Codex — nên nó tuân theo cùng quy tắc chuyển đổi như khi nhập lịch sử Claude trong Codex App, đồng thời tạo ra các lượt hội thoại hiển thị được và có thể tiếp tục. Các phiên bản Codex cũ chưa có tính năng nhập phiên cần được nâng cấp trước.

**`/codex:status`**, **`/codex:result`** và **`/codex:cancel`** quản lý các job chạy nền cho repo hiện tại: liệt kê job đang chạy và job gần đây, hiển thị kết quả cuối cùng đã lưu của một job đã xong (kèm Codex session ID khi có, để bạn mở lại lượt chạy đó bằng `codex resume <session-id>`), và hủy một job nền đang hoạt động. Mỗi lệnh nhận thêm một task ID tùy chọn, ví dụ `/codex:status task-abc123`.

**`/codex:setup`** kiểm tra Codex đã được cài đặt và đăng nhập chưa, và có thể đề nghị cài Codex giúp bạn nếu nó chưa có mà npm khả dụng. Lệnh này cũng quản lý **review gate** (cổng review) tùy chọn:

```bash
/codex:setup --enable-review-gate
/codex:setup --disable-review-gate
```

Khi review gate được bật, plugin dùng một hook `Stop` để chạy một bản review Codex có trọng tâm dựa trên phản hồi của Claude; nếu bản review đó phát hiện vấn đề, việc dừng phiên sẽ bị chặn để Claude xử lý trước.

### Cài đặt

Yêu cầu: một **gói đăng ký ChatGPT (kể cả gói Free) hoặc một OpenAI API key** — lượng sử dụng sẽ tính vào giới hạn sử dụng Codex của bạn — và **Node.js 18.18 trở lên**.

Thêm marketplace trong Claude Code:

```bash
/plugin marketplace add openai/codex-plugin-cc
```

Cài plugin:

```bash
/plugin install codex@openai-codex
```

Nạp lại plugin:

```bash
/reload-plugins
```

Sau đó chạy:

```bash
/codex:setup
```

Nếu bạn muốn tự cài Codex:

```bash
npm install -g @openai/codex
```

Nếu Codex đã cài nhưng chưa đăng nhập:

```bash
!codex login
```

Sau khi cài, bạn sẽ thấy các slash command nêu trên cùng subagent `codex:codex-rescue` trong `/agents`. Một lượt chạy thử đơn giản:

```bash
/codex:review --background
/codex:status
/codex:result
```

### Cách tích hợp với Codex

Plugin bao bọc (wrap) **Codex app server**. Nó không đóng gói một runtime Codex riêng: nó dùng chính binary `codex` toàn cục đã cài trong môi trường của bạn, cùng trạng thái xác thực của Codex CLI cục bộ, cùng bản checkout repository và môi trường cục bộ của máy, và cùng các tệp cấu hình. Nếu bạn đã đăng nhập Codex trên máy này, tài khoản đó dùng được ngay.

Cấu hình được lấy từ cấp người dùng `~/.codex/config.toml` cộng với phần ghi đè ở cấp dự án trong `.codex/config.toml`, trong đó phần ghi đè cấp dự án chỉ được nạp khi dự án đã được tin cậy (trusted). Vì vậy, để đổi model hoặc mức reasoning effort mặc định cho một dự án, hãy thêm đoạn sau vào `.codex/config.toml` ở gốc thư mục bạn khởi động Claude:

```toml
model = "gpt-5.4-mini"
model_reasoning_effort = "high"
```

Cách đăng nhập và thiết lập base URL hiện có của bạn vẫn được giữ nguyên; `openai_base_url` trong cấu hình Codex vẫn dùng để trỏ provider OpenAI tích hợp sang một endpoint khác. Các nhiệm vụ đã giao và các lượt chạy của stop gate đều có thể được tiếp tục trực tiếp trong Codex bằng `codex resume`, dùng session ID nhận được từ `/codex:result` hoặc `/codex:status`, hoặc chọn từ danh sách — rất hữu ích khi bạn muốn xem lại hoặc tiếp tục công việc của Codex trong môi trường gốc của nó.

### Lưu ý

Cả hai lệnh review đều chỉ đọc (read-only): `/codex:review` không thực hiện bất kỳ thay đổi nào, và `/codex:adversarial-review` không sửa code. Việc review — đặc biệt với thay đổi trải trên nhiều tệp — có thể mất khá nhiều thời gian, nên thường được khuyến nghị chạy với `--background`, rồi theo dõi bằng `/codex:status` và hủy bằng `/codex:cancel` khi cần. Lời khuyên tương tự áp dụng cho `/codex:rescue`: tùy nhiệm vụ và model, nó có thể chạy rất lâu, nên hãy buộc nhiệm vụ chạy nền hoặc chuyển agent xuống nền. Cảnh báo quan trọng nhất liên quan đến review gate: nó có thể tạo ra một vòng lặp Claude/Codex kéo dài và có thể làm cạn giới hạn sử dụng rất nhanh. Chỉ bật khi bạn dự định theo dõi phiên làm việc một cách chủ động.

### Thông tin repo

- **Repository:** [github.com/openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc)
- **Giấy phép:** Apache-2.0
- **Ngôn ngữ chính:** JavaScript
- **Sao (stars):** 29.948 · **Fork:** 1.940 · **Issue đang mở:** 377
- **Nhánh mặc định:** `main`
- **Marketplace:** `openai-codex` (chủ sở hữu: OpenAI), plugin `codex`, phiên bản 1.0.6
