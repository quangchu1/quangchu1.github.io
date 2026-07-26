---
title: 'codex-plugin-cc: Dùng Codex ngay trong Claude Code'
description: 'Bài giải thích kỹ thuật về codex-plugin-cc của OpenAI — nó là gì, kiến trúc, cách cài đặt và sử dụng, các lựa chọn thiết kế nổi bật và những hạn chế.'
pubDate: 'Jul 26 2026'
heroImage: '../../assets/blog-placeholder-1.jpg'
---

> Bài giải thích này được tạo tự động bởi sự cộng tác giữa Claude + Codex (cả hai tác nhân đều đã phê duyệt kết quả), dựa hoàn toàn trên kho mã nguồn [openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc).

`codex-plugin-cc` là một "chợ plugin" (plugin marketplace) cho Claude Code do OpenAI duy trì. Nó cho phép người dùng Claude Code gọi Codex CLI cục bộ của mình để review code, giao việc lập trình và bàn giao phiên làm việc mà không cần rời khỏi luồng công việc hiện tại.

Kho mã chứa một plugin duy nhất, `codex`, được hiện thực bằng các script Node.js không phụ thuộc thư viện ngoài, các định nghĩa lệnh (command) của Claude Code, các kỹ năng (skill) của tác nhân, các hook vòng đời, và một client JSON-RPC nhỏ cho Codex app server.

## Nó giải quyết vấn đề gì

Việc dùng Codex một cách tách biệt thường đòi hỏi mở một công cụ khác và thiết lập lại ngữ cảnh. Thay vào đó, plugin này tái sử dụng:

- Cùng một bản checkout của kho mã
- Cùng một bản cài Codex cục bộ
- Cùng một trạng thái xác thực (authentication)
- Cùng một cấu hình Codex ở cấp người dùng và cấp dự án

Nó không tái hiện lại hay đóng gói kèm Codex. Các lệnh gọi chạy thông qua binary `codex` được cài toàn cục và được tính vào hạn mức sử dụng Codex của người dùng.

Plugin cung cấp tám lệnh slash:

| Lệnh | Mục đích |
| --- | --- |
| `/codex:setup` | Kiểm tra cài đặt và xác thực; cấu hình cổng review (review gate) |
| `/codex:review` | Chạy trình review chỉ-đọc tích hợp sẵn của Codex |
| `/codex:adversarial-review` | Chạy một bản review có thể điều hướng, thách thức các quyết định thiết kế |
| `/codex:rescue` | Giao việc điều tra hoặc hiện thực cho Codex |
| `/codex:transfer` | Nhập phiên Claude hiện tại vào một thread Codex bền vững |
| `/codex:status` | Hiển thị các job đang chạy và gần đây |
| `/codex:result` | Lấy kết quả đã lưu của một job đã hoàn thành |
| `/codex:cancel` | Hủy một job nền đang chạy |

Nó cũng cung cấp subagent `codex:codex-rescue`, có thể thấy qua `/agents`.

## Kiến trúc

Đường thực thi chính là:

```text
Claude Code
  |
  +-- commands/*.md             Hợp đồng của các lệnh slash
  +-- agents/codex-rescue.md    Subagent giao việc
  +-- skills/*/SKILL.md         Quy tắc chuyển tiếp, tạo prompt và định dạng kết quả
  +-- hooks/hooks.json          Hook cho phiên và khi dừng
  |
  v
scripts/codex-companion.mjs     Bộ điều phối lệnh và khởi chạy job
  |
  +-- lib/git.mjs               Xác định mục tiêu review và thu thập diff
  +-- lib/state.mjs             Cấu hình và job theo từng workspace
  +-- lib/tracked-jobs.mjs      Vòng đời và tiến độ job
  +-- lib/render.mjs            Kết xuất Markdown
  +-- prompts/*.md              Mẫu cho adversarial-review và cổng dừng
  +-- schemas/review-output...  Hợp đồng kết quả review có cấu trúc
  +-- lib/codex.mjs             Điều phối các thao tác Codex
  |
  v
lib/app-server.mjs              Client JSON-RPC trên nền JSONL
  |
  +-- direct: codex app-server qua stdio
  +-- broker: kết nối qua socket hoặc named-pipe dùng chung
  |
  v
scripts/app-server-broker.mjs   Tiến trình Codex app-server dùng chung

```

### Hợp đồng lệnh (Command Contracts)

Các tệp trong `plugins/codex/commands/` là các prompt Markdown có frontmatter YAML. Chúng khai báo các công cụ được phép và ràng buộc hành vi của Claude.

Ví dụ, các lệnh review được quy định rõ là chỉ-đọc và yêu cầu Claude trả về đúng kết quả của lệnh companion mà không được viết lại. Định nghĩa lệnh cũng quyết định việc chờ đợi hay khởi chạy một bản review thông qua chế độ `Bash` nền của Claude Code.

Hầu hết các lệnh đặt `disable-model-invocation: true`, nên `/codex:review`, `/codex:adversarial-review`, `/codex:transfer`, `/codex:status`, `/codex:result`, và `/codex:cancel` chỉ chạy khi người dùng yêu cầu. `/codex:setup` và `/codex:rescue` được cố ý giữ ở dạng model-invocable, chính điều này cho phép Claude tự chủ động giao việc cho Codex.

Lệnh rescue định tuyến công việc tới `codex:codex-rescue`. Subagent đó chỉ có công cụ `Bash` và được chỉ thị thực hiện đúng một lệnh gọi companion CLI, ngăn nó tự ý kiểm tra hay sửa đổi kho mã.

### Các Skill đi kèm

Ba skill nội bộ mang các quy tắc hành vi mà nếu không sẽ bị lặp lại trên nhiều prompt. Cả ba đều được đánh dấu `user-invocable: false`.

- `codex-cli-runtime` — hợp đồng chuyển tiếp cho subagent rescue: một lệnh gọi `task`, cờ nào là điều khiển định tuyến, và những subcommand nào bị cấm.
- `gpt-5-4-prompting` — cách định hình prompt cho Codex: các khối gắn thẻ XML gọn gàng, hợp đồng đầu ra rõ ràng, quy tắc bám ngữ cảnh và kiểm chứng. Được hỗ trợ bởi các tệp tham chiếu cho các khối tái sử dụng, công thức đầu-cuối và các antipattern.
- `codex-result-handling` — cách Claude phải trình bày kết quả của Codex: giữ nguyên phát hiện, mức độ nghiêm trọng, đường dẫn và ranh giới bằng chứng, và không bao giờ tự động áp dụng bản vá từ một bản review khi chưa hỏi trước.

### Companion CLI

`scripts/codex-companion.mjs` là điểm vào trung tâm. Các thao tác công khai của nó gồm:

```text
setup
review
adversarial-review
task
transfer
status
result
cancel

```

Nó cũng có các thao tác nội bộ như `task-worker` cho các tác vụ tách rời và `task-resume-candidate` để tìm công việc có thể tiếp tục.

Theo mặc định, CLI tạo ra Markdown dễ đọc cho con người. Các handler của nó cũng chấp nhận `--json` cho các lớp bọc lệnh và tự động hóa.

### Client Codex App-Server

`lib/app-server.mjs` hiện thực hai kiểu truyền dẫn (transport):

- `SpawnedCodexAppServerClient` khởi chạy `codex app-server` và giao tiếp qua đầu vào/đầu ra chuẩn.
- `BrokerCodexAppServerClient` kết nối tới một broker dùng chung qua Unix socket hoặc named pipe của Windows.

`lib/codex.mjs` xây dựng trên transport này để bắt đầu hoặc tiếp tục thread, chạy lượt (turn), khởi chạy review gốc, ngắt lượt, kiểm tra xác thực, và nhập các phiên tác nhân ngoài.

### Broker dùng chung

Mỗi lần gọi lệnh slash sẽ khởi động một tiến trình Node.js mới. Để tránh liên tục khởi động Codex, `app-server-broker.mjs` sở hữu một tiến trình app-server duy nhất và chuyển tiếp yêu cầu từ các lần gọi lệnh.

Broker chỉ cho phép một yêu cầu hoặc thao tác streaming đang hoạt động tại một thời điểm. Một yêu cầu cạnh tranh sẽ nhận lỗi JSON-RPC `-32001`. Bên gọi khi đó chuyển sang dùng một tiến trình app-server riêng thay vì thất bại.

`turn/interrupt` vẫn được cho qua trong khi một socket khác đang sở hữu luồng hoạt động, giúp có thể hủy trong một lượt chạy dài.

### Trạng thái và Job

`lib/state.mjs` lưu dữ liệu theo từng workspace. Tên thư mục của nó kết hợp một slug dễ đọc của workspace với 16 ký tự thập lục phân đầu tiên của giá trị băm SHA-256 của đường dẫn workspace chuẩn hóa.

Trạng thái bao gồm:

```text
state.json
broker.json
jobs/<job-id>.json
jobs/<job-id>.log

```

Tối đa 50 job được giữ lại. Việc cắt tỉa xóa cả payload lẫn log của job.

Các job ghi lại ID phiên Claude khi có. Danh sách và giá trị mặc định sau đó được giới hạn theo phiên hiện tại: `/codex:status` không kèm ID, `/codex:result` không kèm ID, `/codex:cancel` không kèm ID, và việc chọn tiếp tục cho rescue đều chỉ xét các job của phiên này. Việc truyền một job ID tường minh sẽ cố ý bỏ qua bộ lọc đó, nên một job từ phiên khác vẫn có thể được kiểm tra hoặc hủy. Dọn dẹp phiên sẽ xóa các job của phiên đó và kết thúc các cây tiến trình đang hoạt động của nó.

### Hook vòng đời

`hooks/hooks.json` đăng ký ba hook:

- `SessionStart` xuất ra ID phiên Claude, đường dẫn transcript và thư mục dữ liệu plugin.
- `SessionEnd` tắt broker, kết thúc các job còn lại của phiên và xóa trạng thái phiên.
- `Stop` tùy chọn chạy cổng review (review gate).

## Cài đặt

Yêu cầu:

- Node.js 18.18 trở lên
- Một gói đăng ký ChatGPT, kể cả gói Free, hoặc một OpenAI API key
- Một bản cài Codex CLI cục bộ đã được xác thực

Bên trong Claude Code:

```bash
/plugin marketplace add openai/codex-plugin-cc
/plugin install codex@openai-codex
/reload-plugins
/codex:setup

```

Nếu thiếu Codex, `/codex:setup` có thể đề nghị cài nó khi có npm. Cách cài thủ công:

```bash
npm install -g @openai/codex

```

Để xác thực:

```bash
!codex login

```

Setup kiểm tra cả `codex --version` lẫn `codex app-server --help`, nên một CLI cũ không hỗ trợ app-server sẽ bị coi là không khả dụng.

## Sử dụng plugin

### Review công việc hiện tại

```bash
/codex:review
/codex:review --base main
/codex:review --background

```

Một tham số `--base` tường minh sẽ chọn review theo nhánh. Ngược lại, việc chọn tự động dùng cây làm việc (working tree) khi nó "bẩn" (có thay đổi) và so sánh với nhánh mặc định được phát hiện khi cây sạch. `--scope` chỉ chấp nhận `auto`, `working-tree`, hoặc `branch`.

Lệnh này gọi thao tác gốc `review/start` của Codex. Nó không chấp nhận văn bản trọng tâm tùy chỉnh, phạm vi chỉ-staged, hay phạm vi chỉ-unstaged.

### Chạy một bản review đối kháng (Adversarial Review)

```bash
/codex:adversarial-review
/codex:adversarial-review --base main challenge the caching and retry design
/codex:adversarial-review --background look for race conditions

```

Khác với trình review gốc, chế độ này xây một prompt chuyên biệt và chạy một lượt Codex bình thường. Prompt của nó nhấn mạnh các rủi ro trọng yếu như lỗi phân quyền, mất dữ liệu, retry, race condition, trôi lệch schema, và các phụ thuộc bị suy giảm.

Kết quả phải khớp với `schemas/review-output.schema.json`, vốn định nghĩa một phán quyết (verdict), tóm tắt, các phát hiện và các bước tiếp theo. Mỗi phát hiện bao gồm mức độ nghiêm trọng, vị trí tệp và dòng, độ tin cậy, và một khuyến nghị.

Cả hai chế độ review đều dùng một sandbox chỉ-đọc.

### Giao việc

```bash
/codex:rescue investigate why the tests started failing
/codex:rescue fix the failing test with the smallest safe patch
/codex:rescue --resume apply the top fix from the last run
/codex:rescue --model gpt-5.4-mini --effort medium investigate the flaky test
/codex:rescue --model spark fix the issue quickly
/codex:rescue --background investigate the regression

```

Bí danh `spark` ánh xạ tới `gpt-5.3-codex-spark`. Các tên model khác được truyền qua nguyên vẹn. Các giá trị effort hợp lệ là `none`, `minimal`, `low`, `medium`, `high`, và `xhigh`.

Các lần chạy rescue mặc định có quyền ghi. Subagent thêm `--write` trừ khi người dùng yêu cầu rõ hành vi chỉ-đọc hoặc chỉ muốn review, chẩn đoán, hay nghiên cứu mà không chỉnh sửa. Các thread app-server dùng chính sách phê duyệt `never`, nên các lần chạy có quyền ghi sẽ không hỏi trước khi chỉnh sửa.

Các tác vụ tách rời được thực thi bởi một tiến trình `task-worker` nội bộ. Yêu cầu, tiến độ và kết quả cuối cùng của chúng được lưu bền trong kho job.

### Chuyển một phiên Claude

```bash
/codex:transfer
/codex:transfer --source ~/.claude/projects/-Users-me-repo/<session-id>.jsonl

```

Nguồn mặc định đến từ đường dẫn transcript của `SessionStart`. Transfer dùng thao tác `externalAgentConfig/import` của Codex và in ra một lệnh như:

```bash
codex resume <session-id>

```

Bản hiện thực xác minh việc nhập dựa trên sổ cái `external_agent_session_imports.json` của Codex, dùng cả đường dẫn nguồn chuẩn hóa lẫn giá trị băm SHA-256 của nội dung.

### Quản lý job

```bash
/codex:status
/codex:status task-abc123
/codex:status task-abc123 --wait --timeout-ms 60000
/codex:status --all
/codex:result
/codex:result task-abc123
/codex:cancel task-abc123

```

Các tiền tố job-ID duy nhất được chấp nhận. Tiền tố nhập nhằng sẽ tạo ra lỗi yêu cầu một ID dài hơn. `--wait` thăm dò một job duy nhất cho tới khi nó rời khỏi trạng thái xếp hàng (queued) hoặc đang chạy (running), và bắt buộc phải có job ID.

Việc hủy trước tiên yêu cầu `turn/interrupt`, sau đó kết thúc cây tiến trình của job và ghi lại cả hai kết quả.

### Bật cổng review (Review Gate)

```bash
/codex:setup --enable-review-gate
/codex:setup --disable-review-gate

```

Khi được bật, hook `Stop` yêu cầu Codex chỉ review các chỉnh sửa được thực hiện trong lượt ngay trước đó của Claude. Kết quả của nó phải bắt đầu bằng:

```text
ALLOW: <reason>

```

hoặc:

```text
BLOCK: <reason>

```

Một kết quả chặn (BLOCK) sẽ ngăn Claude dừng lại để vấn đề được xử lý.

### Cấu hình giá trị mặc định

Plugin kế thừa cấu hình Codex thông thường. Ví dụ, tệp `.codex/config.toml` của một dự án đáng tin cậy có thể chứa:

```toml
model = "gpt-5.4-mini"
model_reasoning_effort = "high"

```

Cấu hình người dùng đến từ `~/.codex/config.toml`; cấu hình dự án đáng tin cậy sẽ ghi đè lên nó.

## Các lựa chọn thiết kế nổi bật

### Đường review gốc và đường review điều hướng được

Dự án cố ý tách biệt các chế độ review:

- `/codex:review` giao trực tiếp cho trình review tích hợp của Codex và kế thừa hành vi của nó.
- `/codex:adversarial-review` đánh đổi sự kế thừa trực tiếp đó để lấy văn bản trọng tâm tùy chỉnh và đầu ra có cấu trúc.

Điều này tránh phải duy trì một bản thay thế cho trình review chuẩn trong khi vẫn hỗ trợ review theo hướng thiết kế.

### Chuyển tiếp mỏng thay vì điều phối

Đường rescue được cố ý làm "ngốc". Subagent có thể định hình lại yêu cầu của người dùng thành một prompt Codex chặt chẽ hơn, rồi thực hiện đúng một lệnh gọi `task` và trả về stdout nguyên vẹn. Nó bị cấm rõ ràng việc đọc kho mã, thăm dò trạng thái, lấy kết quả, hay thay thế bằng câu trả lời của chính mình khi Codex thất bại. Điều này giữ cho một tác nhân duy nhất chịu trách nhiệm cho công việc và ngăn hai model âm thầm đan xen các chỉnh sửa.

### Ngữ cảnh thích ứng theo kích thước diff

Adversarial review chỉ nhúng toàn bộ ngữ cảnh diff khi thay đổi chứa tối đa hai tệp và không quá 256 KiB đầu ra Git.

Các thay đổi lớn hơn nhận được trạng thái, danh sách tệp và số liệu tóm tắt, kèm chỉ dẫn để Codex tự kiểm tra diff bằng các lệnh Git chỉ-đọc. Các tệp chưa được theo dõi lớn hơn 24 KiB, tệp nhị phân, thư mục, và symlink không đọc được sẽ được biểu diễn bằng các dấu bỏ qua (skip marker) tường minh.

### Hoàn tất lượt một cách bền bỉ

Các lượt Codex có thể sinh ra subagent mà không gửi thông báo `turn/completed` mong đợi ở cấp cha. Runtime theo dõi các lượt cộng tác và subagent đang chờ. Sau khi câu trả lời cuối cùng xuất hiện và toàn bộ công việc của subagent đã rút hết, nó có thể suy ra là đã hoàn tất sau một khoảng trễ ngắn thay vì treo vô thời hạn.

### Dịch tiến độ

Các thông báo giao thức được chuyển thành các pha như `investigating`, `editing`, `running`, `verifying`, và `finalizing`. Các lệnh chứa từ như test, lint, build, type-check hoặc tương tự được phân loại là công việc kiểm chứng.

### Xử lý tiến trình đa nền tảng

Hệ Unix dùng socket và tín hiệu nhóm-tiến-trình. Windows dùng named pipe và `taskkill /T /F`.

Các lệnh Git luôn chạy không qua shell để tên nhánh lấy từ kho mã được truyền nguyên văn. Codex có thể dùng shell trên Windows vì tệp thực thi của nó có thể là một command shim.

### Kiểu giao thức được sinh bởi Codex

Bước prebuild chạy:

```bash
codex app-server generate-ts --out plugins/codex/.generated/app-server-types

```

Sau đó TypeScript kiểm tra phần hiện thực JavaScript với `allowJs`, `checkJs`, và `noEmit`. Điều này phơi bày sự trôi lệch của giao thức app-server trong CI mà không phải chuyển runtime sang TypeScript.

Các bài test dùng một tệp thực thi giả tên `codex`, hiện thực đủ phần giao thức để kiểm tra việc tái dùng broker, giới hạn phạm vi theo phiên, hủy, transfer, xác thực, giới hạn diff, và các sự kiện hoàn tất bị thiếu mà không cần truy cập mạng.

### Giữ đồng bộ metadata phiên bản

`scripts/bump-version.mjs` ghi một phiên bản duy nhất vào `package.json`, `package-lock.json`, manifest của plugin, và cả hai trường phiên bản trong manifest của marketplace, và chế độ `--check` của nó sẽ thất bại khi chúng lệch nhau.

## Hạn chế và lưu ý

- **Codex không được đóng gói kèm.** CLI toàn cục phải được cài, đã xác thực và đủ mới để hỗ trợ `app-server`.
- **Mức dùng và độ trễ vẫn là mức dùng Codex.** Các bản review tiêu tốn hạn mức Codex, và review nhiều tệp có thể mất đủ lâu khiến việc chạy nền là lựa chọn tốt hơn.
- **Review gốc cố ý kém linh hoạt.** Nó hỗ trợ các thay đổi chưa commit hoặc một nhánh gốc, nhưng không hỗ trợ văn bản trọng tâm tùy chỉnh, review chỉ-staged, hay chỉ-unstaged.
- **Các bản adversarial review lớn phụ thuộc vào việc tự kiểm tra bằng công cụ.** Khi vượt giới hạn nhúng nội dòng, Codex phải tự lấy diff liên quan.
- **Broker là single-flight.** Các yêu cầu cạnh tranh sẽ khởi động các tiến trình app-server riêng, giữ được tính đúng đắn nhưng mất phần tiết kiệm từ việc khởi động broker.
- **Khởi động broker theo kiểu best-effort.** Nếu endpoint của nó chưa sẵn sàng trong hai giây, runtime sẽ chuyển về khởi động trực tiếp.
- **Nguồn transfer bị giới hạn.** Chúng phải là các tệp `.jsonl` nằm dưới `~/.claude/projects` sau khi phân giải symlink. Transfer luôn dùng một app server trực tiếp.
- **Lịch sử job bị giới hạn và theo phạm vi phiên.** Chỉ 50 job được giữ, trạng thái dự phòng tạm thời có thể bị hệ điều hành xóa, và `SessionEnd` xóa các job của phiên hiện tại.
- **Cổng review có thể lặp và tiêu tốn nhiều mức dùng.** README khuyến nghị chỉ bật nó khi đang chủ động theo dõi phiên.
- **Hành vi khi cổng thất bại mang tính hỗn hợp.** Khi một bản review cổng đã chạy, việc hết thời gian, thất bại thực thi, JSON không hợp lệ, đầu ra rỗng, hay một dòng đầu bất ngờ đều chặn việc dừng. Nếu Codex bị phát hiện là không khả dụng trước khi bản review bắt đầu, hook sẽ thay vào đó in hướng dẫn cài đặt và cho phép dừng.
- **Rescue có thể chỉnh sửa mà không cần hỏi phê duyệt.** Các tác vụ rescue có quyền ghi dùng `workspace-write` với chính sách phê duyệt `never`, và có-quyền-ghi là mặc định.
- **Các lệnh review yêu cầu một kho Git.** Các thao tác khác, gồm setup, giao việc, transfer và quản lý job, không đồng loạt áp đặt yêu cầu đó.
- **Đầu ra có cấu trúc có thể suy giảm.** Nếu JSON của adversarial-review không hợp lệ hoặc sai định dạng, việc kết xuất sẽ lùi về thông điệp cuối thô kèm một lỗi phân tích hoặc kiểm tra.
- **Phân phối chỉ qua marketplace.** Gói gốc là private và không lộ ra `bin`, `main`, hay `exports` của npm.
- **Tài liệu kho mã còn thiếu sót.** Phiên bản gói là `1.0.6`, trong khi changelog chỉ ghi nhận `1.0.0`. README tham chiếu `docs/plugin-demo.webm`, nhưng không có thư mục `docs` nào trong kho mã.

