---
title: 'A Daily AWS Cost Report With Zero LLM Calls: Moving a Sandboxed Script Cron to crontab'
description: 'Bilingual EN/VI. A scheduled cost report failed with "config profile could not be found" because the agent platform sandbox masks ~/.aws. Three ways out were compared; the plain system crontab won. The whole pipeline is Python, the AWS CLI and one HTTPS POST — no model in the loop, and the output is a fixed template.'
pubDate: 'Sep 25 2026'
---

*Bilingual post — each section is in English first, then Vietnamese. / Bài song ngữ — mỗi phần có tiếng Anh trước, tiếng Việt sau.*

*Account IDs, partner names, profile names, amounts, host names and Discord IDs are redacted below. / Account ID, tên đối tác, tên profile, số tiền, tên máy và Discord ID đều đã được che.*

---

## 1. The symptom / Triệu chứng

**EN.** Every morning a scheduled job posts one Discord message per AWS account: gross cost, discounts, credits applied, what is actually owed, and when the promotional credit runs out. One day both accounts posted the same card instead of a report:

**VI.** Mỗi sáng một job theo lịch gửi lên Discord một tin nhắn cho mỗi account AWS: chi phí gộp, giảm giá, credit đã bù, số tiền thực trả, và ngày credit khuyến mãi cạn. Một hôm cả hai account đều gửi cùng một thẻ lỗi thay vì báo cáo:

```
🛑 Could not build the report
RuntimeError: rc=255: aws: [ERROR]: The config profile (<profile-a>) could not be found
```

**EN.** The job had failed on every run it ever made — 2 of 2 — with the same message, so this was structural, not a flaky network.

**VI.** Job đã fail ở mọi lần chạy — 2 trên 2 — cùng một thông báo, nên đây là lỗi cấu trúc, không phải mạng chập chờn.

## 2. The profile was fine / Profile không hề hỏng

**EN.** From an interactive shell the same profile worked: `aws sts get-caller-identity --profile <profile-a>` returned the right account, and running the script by hand printed a complete report. The profiles live only in `~/.aws/credentials` (static keys), not in `~/.aws/config`.

The difference was *who* ran the script. The agent platform runs a scheduled **script** job inside its own OS sandbox, and that tier masks credential stores — `~/.aws`, the SSO cache, `~/.ssh`, `~/.netrc` — on Linux. The AWS CLI inside the sandbox saw no profiles at all, and "could not be found" is exactly what it says in that case. This is a deliberate policy, not a bug: the scripts directory is writable by an agent, and an unsandboxed agent-written script with your credentials in reach is the thing the sandbox exists to prevent. There is also no config switch to turn it off for scheduled jobs; the level is chosen in code.

**VI.** Chạy từ shell tương tác thì profile vẫn chạy: `aws sts get-caller-identity --profile <profile-a>` trả về đúng account, và chạy tay script thì in ra báo cáo đầy đủ. Các profile chỉ nằm trong `~/.aws/credentials` (key tĩnh), không có trong `~/.aws/config`.

Khác biệt nằm ở *ai* chạy script. Nền tảng agent chạy job dạng **script** trong sandbox của hệ điều hành, và mức sandbox đó che các kho credential — `~/.aws`, SSO cache, `~/.ssh`, `~/.netrc` — trên Linux. AWS CLI bên trong sandbox không thấy profile nào, và "could not be found" đúng là điều nó báo trong trường hợp đó. Đây là chính sách có chủ đích, không phải bug: thư mục chứa script là nơi agent sửa được, và một script do agent viết chạy ngoài sandbox, với credential trong tầm tay, chính là điều sandbox sinh ra để ngăn. Cũng không có khoá cấu hình nào để tắt nó riêng cho cron; mức sandbox được chọn cứng trong code.

## 3. Three ways out / Ba lối ra

| | System crontab | Agent job + terminal MCP | Vault secret |
|---|---|---|---|
| Tokens per run / Token mỗi lần | 0 | some / có | 0 |
| Deterministic output / Output ổn định | yes | model may reformat / có thể bị định dạng lại | yes |
| Needs the platform up / Cần nền tảng chạy | no | yes | yes |
| Reads `~/.aws` | whole store / toàn bộ | whole store / toàn bộ | no — one approved read-only key / chỉ một key chỉ đọc |
| Add a profile / Thêm profile | 1 edit / 1 chỗ sửa | 1 edit + ask agent | new IAM key, vault entry, re-approval |

**EN.**

- **Vault secret** is the most secure. The operator stores a read-only Cost Explorer key and approves it for this one job; the approval is pinned to the script's current code and must be redone after any edit. It is also the most work per new account.
- **Agent job + terminal MCP** works because the MCP terminal runs outside the scheduled-job sandbox. But a script job cannot call MCP tools, so the job must become an LLM turn: tokens every day, output the model may reword, and an unattended tool approval that can stall unless everything is auto-approved.
- **System crontab** runs the same script as the user, outside any agent sandbox. It costs nothing and is fully deterministic, and adding an account is one flag. It loses the platform's run history and `notify()`, so delivery has to be rebuilt as a Discord webhook.

I chose the crontab.

**VI.**

- **Vault secret** an toàn nhất. Người vận hành lưu một key chỉ đọc Cost Explorer và duyệt cho đúng job này; lượt duyệt gắn với nội dung code hiện tại và phải duyệt lại sau mỗi lần sửa. Đây cũng là cách tốn công nhất mỗi khi có account mới.
- **Agent job + terminal MCP** chạy được vì terminal MCP nằm ngoài sandbox của cron. Nhưng job dạng script không gọi được MCP, nên job phải thành một lượt LLM: tốn token mỗi ngày, output có thể bị model viết lại, và việc duyệt tool khi không có người có thể làm job treo, trừ khi bật tự duyệt mọi tool.
- **Crontab hệ thống** chạy đúng script đó dưới quyền user, ngoài mọi sandbox agent. Không tốn gì, output hoàn toàn cố định, và thêm account chỉ là thêm một tham số. Đổi lại là mất lịch sử chạy trên nền tảng và mất `notify()`, nên phần gửi tin phải làm lại bằng Discord webhook.

Tôi chọn crontab.

## 4. The flow / Luồng xử lý

<figure class="archify-figure">
	<a href="/images/aws-cost-crontab/flow-interactive.html">
		<img class="archify-light" src="/images/aws-cost-crontab/flow-light.png" width="1390" height="1025" loading="lazy" alt="Workflow: crond runs main(), which reads args and a 0600 webhook file; build_blocks() calls Cost Explorer and billing get-credits through the AWS CLI; the JSON is filled into an f-string template; _pack() splits it into messages of at most 1900 characters and POSTs them over HTTPS to a Discord thread, logging to cron.log. An exception for one profile becomes an error card that is posted the same way." />
		<img class="archify-dark" src="/images/aws-cost-crontab/flow-dark.png" width="1390" height="1025" loading="lazy" alt="Same workflow diagram, dark theme." />
	</a>
	<figcaption>Click for the interactive version (zoom, search, trace). / Bấm để mở bản tương tác (zoom, tìm kiếm, lần theo luồng).</figcaption>
</figure>

**EN.**

1. `crond` fires once a day at a fixed UTC hour. The host runs in UTC, so a local 09:00 at UTC+7 is `0 2 * * *`.
2. `main()` parses the flags and reads the webhook URL from a `chmod 600` file. The URL is a credential — anyone holding it can post — so it never appears on the command line, where `ps` and `crontab -l` would show it. The script refuses a file that is group- or world-readable.
3. For each profile, `build_blocks()` shells out to `aws ce get-cost-and-usage` (grouped by record type, service and day) and to `aws billing get-credits`. Each returns JSON.
4. Python computes everything: gross vs net, discounts classified by *sign* rather than an allow-list of names, the run rate, and a credit exhaustion date projected month by calendar month (a flat monthly seat charge makes a single daily rate wrong across 30- and 31-day months).
5. The numbers are poured into a fixed template. `_pack()` splits the report into messages of at most 1900 characters without ever cutting a fenced table in half.
6. `_post_webhook()` POSTs each message with `?thread_id=` so it lands in the right thread, sets `allowed_mentions` to nothing, sends a real `User-Agent` (Discord's edge rejects the default one) and honours `429 retry_after`.
7. If one profile throws, it becomes an error card that goes through the same pack-and-post path. One broken account never hides the others.

**VI.**

1. `crond` kích hoạt mỗi ngày một lần vào giờ UTC cố định. Máy chạy giờ UTC, nên 09:00 giờ UTC+7 là `0 2 * * *`.
2. `main()` đọc tham số và đọc URL webhook từ một file `chmod 600`. URL đó là credential — ai có nó đều gửi tin được — nên nó không bao giờ nằm trên dòng lệnh, nơi `ps` và `crontab -l` sẽ lộ ra. Script từ chối file nếu group hoặc người khác đọc được.
3. Với mỗi profile, `build_blocks()` gọi `aws ce get-cost-and-usage` (nhóm theo record type, dịch vụ và ngày) và `aws billing get-credits`. Mỗi lệnh trả về JSON.
4. Python tính mọi thứ: gộp và thực trả, giảm giá phân loại theo *dấu âm/dương* thay vì theo danh sách tên, tốc độ tiêu, và ngày cạn credit dự báo bằng cách đi qua từng tháng lịch (phí seat cố định theo tháng khiến một tốc độ theo ngày duy nhất bị sai giữa tháng 30 và 31 ngày).
5. Các con số được đổ vào template cố định. `_pack()` chia báo cáo thành các tin tối đa 1900 ký tự, không bao giờ cắt ngang một bảng trong khung code.
6. `_post_webhook()` POST từng tin kèm `?thread_id=` để vào đúng thread, đặt `allowed_mentions` rỗng, gửi `User-Agent` riêng (tầng edge của Discord chặn UA mặc định) và tôn trọng `429 retry_after`.
7. Nếu một profile lỗi, nó thành thẻ lỗi và đi qua cùng đường đóng gói và gửi. Một account hỏng không che mất các account khác.

## 5. Is there an LLM anywhere? / Có LLM ở đâu không?

**EN.** No. The runtime path is Python, the AWS CLI through `subprocess`, and `urllib` for one HTTPS POST per message. There is no model call, no API key for one, and zero tokens per run. A model was involved only when the script was *written* and *edited*, and when someone asks an agent to run it by hand in a chat.

**VI.** Không. Đường chạy chỉ gồm Python, AWS CLI qua `subprocess`, và `urllib` cho một HTTPS POST mỗi tin. Không có lời gọi model, không có API key cho model, và 0 token mỗi lần chạy. Model chỉ tham gia lúc script được *viết* và *sửa*, và khi ai đó nhờ agent chạy tay trong chat.

## 6. Is the output a template? / Output có phải template không?

**EN.** Yes, entirely. The layout is three fixed sections — total cost, the two tracked services, credits. Headings are markdown and every number table sits in an ` ```ansi ` fence, where Discord keeps column alignment and renders ANSI colour (green for credit applied, red for money owed). Every sentence is an f-string in the code; only the numbers change. The "dynamic" parts are plain `if/else` picks between pre-written lines:

- a red or yellow marker depending on the days left before the credit runs out;
- a **divergence** warning when the credit ledger and Cost Explorer disagree about a month;
- the 7-day table is dropped when every day is $0.00;
- a "credit ledger unreadable" line when that API fails.

The same input always produces byte-identical output, so a diff between two days' messages is a diff of the data.

**VI.** Đúng, hoàn toàn. Bố cục cố định gồm ba phần — tổng chi phí, hai dịch vụ được theo dõi, credit. Tiêu đề là markdown và mọi bảng số nằm trong khung ` ```ansi `, nơi Discord giữ căn cột và hiển thị màu ANSI (xanh cho credit đã bù, đỏ cho tiền phải trả). Mọi câu chữ là f-string trong code; chỉ có con số thay đổi. Phần "linh hoạt" chỉ là `if/else` chọn giữa các câu viết sẵn:

- dấu đỏ hoặc vàng tuỳ số ngày còn lại trước khi hết credit;
- cảnh báo **lệch số** khi sổ credit và Cost Explorer không khớp nhau ở một tháng;
- bỏ bảng 7 ngày khi ngày nào cũng $0.00;
- dòng "sổ credit không đọc được" khi API đó lỗi.

Cùng một đầu vào luôn cho output giống hệt từng byte, nên so hai ngày với nhau chính là so dữ liệu.

## 7. Setup and adding an account / Cài đặt và thêm account

```bash
# webhook: parent channel of the thread → Integrations → Webhooks → Copy URL
mkdir -p ~/.config/aws-cost
(umask 077; cat > ~/.config/aws-cost/webhook)   # paste URL, Enter, Ctrl-D

# crontab -e   (host in UTC → 09:00 at UTC+7)
0 2 * * * /usr/bin/python3 <path>/cost_report.py \
  --webhook-file ~/.config/aws-cost/webhook --thread-id <thread-id> \
  --profile <profile-a>:<account-a>:<label-a> \
  --profile <profile-b>:<account-b>:<label-b> \
  >> ~/.config/aws-cost/cron.log 2>&1
```

**EN.** A new account is `aws configure --profile <name>` plus one more `--profile name:account:label` on that line — no approval, no redeploy. Before trusting it, run the line once by hand under `env -i HOME=$HOME PATH=/usr/bin:/bin` to reproduce cron's bare environment; that is what proves the script finds `aws` without your shell's `PATH`.

**VI.** Account mới chỉ cần `aws configure --profile <tên>` rồi thêm một `--profile tên:account:nhãn` vào dòng đó — không cần duyệt, không cần deploy lại. Trước khi tin nó, chạy tay dòng đó một lần với `env -i HOME=$HOME PATH=/usr/bin:/bin` để tái tạo môi trường trống của cron; đó mới là bằng chứng script tìm được `aws` mà không cần `PATH` của shell.

## 8. What is still open / Những chỗ còn hở

**EN.**

- The crontab route reads the *whole* `~/.aws` store with long-lived static keys. Whichever route you pick, replace them with read-only Cost Explorer keys.
- The script still lives in a directory an agent can write to, and it now runs unsandboxed. Moving it somewhere only you control closes that gap.
- Run history now lives in a log file, not in a dashboard, so nothing alerts on a missed run.

**VI.**

- Cách crontab đọc *toàn bộ* `~/.aws` với key tĩnh dài hạn. Dù chọn cách nào, hãy thay bằng key chỉ đọc Cost Explorer.
- Script vẫn nằm trong thư mục agent sửa được, và giờ nó chạy ngoài sandbox. Chuyển nó sang chỗ chỉ bạn quản lý sẽ đóng chỗ hở này.
- Lịch sử chạy giờ nằm trong file log, không nằm trên dashboard, nên không có gì cảnh báo nếu một lần chạy bị lỡ.
