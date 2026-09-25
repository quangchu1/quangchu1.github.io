---
title: 'When a Reboot Kills Your Headless Browser: A Crontab Watchdog for a Scheduled Capture Job'
description: 'Bilingual EN/VI. A daily screenshot job aborted with "session is not open" because an overnight host reboot killed the long-lived headless browser, and the job is designed to only use that session, never to open it. The fix is a small idempotent watchdog in the user crontab: at boot and every 10 minutes it reopens the session only when it is gone.'
pubDate: 'Sep 25 2026'
---

*Bilingual post: each section is in English first, then Vietnamese. / Bài song ngữ: mỗi phần có tiếng Anh trước, tiếng Việt sau.*

*Host names, user names, paths, internal site names, chat IDs and process IDs are redacted below. / Tên máy, username, đường dẫn, tên site nội bộ, chat ID và process ID đều đã được che.*

---

## 1. The symptom / Triệu chứng

**EN.** Every day, a scheduled job opens an internal dashboard behind corporate SSO and saves one full-page screenshot per sheet into a dated folder. One afternoon the chat channel got this instead of a "LAUNCHED" line:

**VI.** Mỗi ngày có một job theo lịch mở một dashboard nội bộ nằm sau SSO của công ty, rồi lưu mỗi sheet thành một ảnh chụp toàn trang vào thư mục theo ngày. Một buổi chiều, kênh chat nhận được tin này thay vì dòng "LAUNCHED":

```
Capture REFUSED to start for <date> (exit 1).
[..] released playwright-cli session; viewport restored
ABORT: playwright-cli session '<session>' is not open. Run by hand: pw-open <dashboard-url>
```

## 2. Why it failed / Lý do lỗi

<figure class="archify-figure">
	<a href="/images/browser-session-watchdog/before-interactive.html">
		<img class="archify-light" src="/images/browser-session-watchdog/before-light.png" width="2019" height="1748" loading="lazy" alt="Workflow before the fix: an overnight host reboot kills the playwright-cli daemon and nobody reopens it. Hours later the scheduled job's launch() runs with --no-reseed, its session check (playwright-cli list) finds no session, the job ABORTs, and an error post 'REFUSED (exit 1)' goes to the chat channel." />
		<img class="archify-dark" src="/images/browser-session-watchdog/before-dark.png" width="2019" height="1748" loading="lazy" alt="Same workflow before the fix, dark theme." />
	</a>
	<figcaption>Before: the reboot kills the browser, and nothing reopens it. Click for the interactive version. / Trước khi sửa: reboot giết browser và không có gì mở lại nó. Bấm để mở bản tương tác.</figcaption>
</figure>

**EN.** Two facts combined to cause the failure.

1. **The browser lives in a daemon, not in the job.** The capture drives a persistent headless Chromium through `playwright-cli`. A long-lived daemon holds the browser, and its Chrome profile keeps the SSO cookies on disk. The host rebooted shortly after midnight UTC. The profile survived on disk, but the daemon did not, and nothing on the host starts it again at boot.
2. **The job is designed to only use the session.** The job runs as an agent-platform script cron with `--no-reseed`. It never opens the browser and never imports cookies, because a sandboxed script cron is not allowed to read credential files. That rule is correct, but it means the job's first step, a session check (`playwright-cli list`), found nothing and aborted cleanly.

So this was not flaky and not an expired login. Every reboot would break the next run, and reboots cannot be avoided.

**VI.** Lỗi xảy ra do hai điều cộng lại.

1. **Browser nằm trong một daemon, không nằm trong job.** Job capture điều khiển một Chromium headless chạy lâu dài qua `playwright-cli`. Một daemon sống lâu giữ browser, và Chrome profile của nó lưu cookie SSO trên đĩa. Máy bị reboot ngay sau nửa đêm UTC. Profile trên đĩa vẫn còn nhưng daemon thì mất, và trên máy không có gì khởi động lại nó sau khi boot.
2. **Job được thiết kế để chỉ dùng session.** Job chạy dạng script cron của nền tảng agent với `--no-reseed`. Nó không bao giờ mở browser và không bao giờ nạp cookie, vì script cron trong sandbox không được đọc file credential. Quy tắc này đúng, nhưng nó khiến bước đầu tiên của job, bước kiểm tra session (`playwright-cli list`), không thấy gì và dừng lại.

Vậy đây không phải lỗi chập chờn, cũng không phải do đăng nhập hết hạn. Lần reboot nào cũng sẽ làm hỏng lần chạy kế tiếp, và reboot thì không tránh được.

## 3. The fix / Cách khắc phục

<figure class="archify-figure">
	<a href="/images/browser-session-watchdog/after-interactive.html">
		<img class="archify-light" src="/images/browser-session-watchdog/after-light.png" width="2019" height="1575" loading="lazy" alt="Workflow after the fix: a host reboot or browser crash triggers ensure-session from the user crontab (@reboot and every 10 minutes). If the session is already open it exits 0. If not, it reopens the headless browser and loads the SSO cookie, which is refreshed hourly. The scheduled job's launch() then finds the session, the capture verifies it, and an OK post 'LAUNCHED' goes to the chat channel." />
		<img class="archify-dark" src="/images/browser-session-watchdog/after-dark.png" width="2019" height="1575" loading="lazy" alt="Same workflow after the fix, dark theme." />
	</a>
	<figcaption>After: a crontab watchdog reopens the session before the job needs it. Click for the interactive version. / Sau khi sửa: watchdog trong crontab mở lại session trước khi job cần tới. Bấm để mở bản tương tác.</figcaption>
</figure>

**EN.** The job stays as it is: it still only uses the session. What was missing is someone whose job is to *keep the session alive*. That someone has to run as the user, outside the agent sandbox, because reopening the session means loading the SSO cookie. The user's own crontab already refreshes that cookie every hour, so the watchdog goes there too.

The watchdog is a small idempotent script, `ensure-session`:

- If `playwright-cli list` shows the session, it exits 0 and **does nothing**. It never navigates, so it cannot disturb a capture that is running.
- Otherwise it runs the existing open helper with `--reseed`, which opens the persistent profile and loads the current cookies. It writes one line to a log so every self-heal is visible.

**VI.** Job vẫn giữ nguyên: nó vẫn chỉ dùng session. Cái còn thiếu là một thành phần có nhiệm vụ *giữ cho session sống*. Thành phần đó phải chạy dưới quyền user, ngoài sandbox của agent, vì mở lại session nghĩa là phải nạp cookie SSO. Crontab của user vốn đã làm mới cookie đó mỗi giờ, nên watchdog cũng được đặt ở đó.

Watchdog là một script nhỏ, chạy lặp lại nhiều lần vẫn an toàn, tên `ensure-session`:

- Nếu `playwright-cli list` thấy session thì script thoát với mã 0 và **không làm gì**. Nó không bao giờ chuyển trang, nên không thể làm phiền một lần capture đang chạy.
- Nếu không thấy, nó gọi helper mở browser có sẵn với `--reseed` để mở profile và nạp cookie mới nhất. Mỗi lần tự mở lại đều được ghi một dòng vào log.

```bash
#!/bin/bash
# ensure-session: reopen the headless browser session only when it is gone
set -uo pipefail
export PATH="$HOME/.local/bin:<node-shims>:/usr/bin:/bin"   # cron has no user PATH
LOG="<state-dir>/ensure.log"
ts() { date -u +%FT%TZ; }

if playwright-cli list 2>/dev/null | grep -q "<session>"; then
  exit 0                                    # already open: never touch it
fi
echo "$(ts) session '<session>' not open -> reopening" >>"$LOG"
if out=$(timeout 120 pw-open --reseed <dashboard-url> 2>&1); then
  echo "$(ts) $(echo "$out" | grep 'Page Title' | tail -1)" >>"$LOG"
else
  echo "$(ts) FAILED: $(echo "$out" | tail -3 | tr '\n' ' ')" >>"$LOG"
fi
```

```bash
# crontab -e
@reboot sleep 90 && $HOME/.local/bin/ensure-session   # after every boot
*/10 * * * * $HOME/.local/bin/ensure-session           # also heals a crash
```

**EN.** Two triggers, for two different failure causes:

- **`@reboot`** covers the reboot. The 90-second sleep lets the network and the user session settle first.
- **`*/10`** covers everything `@reboot` misses: a daemon crash, an out-of-memory kill, or someone closing the session by hand. At worst the session is down for 10 minutes. The check costs one `playwright-cli list` and nothing else.

**VI.** Hai trigger cho hai kiểu hỏng khác nhau:

- **`@reboot`** lo trường hợp máy reboot. Sleep 90 giây để mạng và session của user ổn định trước.
- **`*/10`** lo những gì `@reboot` bỏ sót: daemon crash, bị kill vì hết RAM, hoặc ai đó đóng session bằng tay. Tệ nhất session chỉ chết 10 phút. Mỗi lần kiểm tra chỉ tốn một lệnh `playwright-cli list`.

## 4. Why not just let the job reopen the session? / Sao không để job tự mở lại session?

**EN.** That would be the quickest patch, and it would be the wrong one. Reopening means reading the SSO cookie file, and the job runs from a directory an agent can write to. An agent-writable script that runs unsandboxed and can read your login cookies is exactly what the sandbox is there to prevent. This split keeps the boundary: **the sandboxed job only uses the session, and the user's crontab owns it.**

**VI.** Đó sẽ là cách vá nhanh nhất, và cũng là cách sai. Mở lại session nghĩa là đọc file cookie SSO, trong khi job chạy từ một thư mục mà agent sửa được. Một script do agent sửa được, chạy ngoài sandbox và đọc được cookie đăng nhập của bạn chính là điều sandbox sinh ra để ngăn. Cách chia này giữ nguyên ranh giới đó: **job trong sandbox chỉ dùng session, còn crontab của user là nơi sở hữu session.**

## 5. What is still open / Những chỗ còn hở

**EN.**

- If the SSO login itself expires (no interactive sign-in for about 20 hours), the reopened browser lands on the login page. The hourly refresh cannot fix that. A human still has to sign in, and the job's session check will say so.
- The watchdog was verified on its no-op path. Its reopen path has the same commands that were run by hand to recover, but its first real test will be the next reboot, and the log line in `ensure.log` is what will prove it.

**VI.**

- Nếu bản thân đăng nhập SSO hết hạn (khoảng 20 giờ không đăng nhập tương tác), browser mở lại sẽ rơi vào trang login. Lượt làm mới mỗi giờ không sửa được chuyện đó. Vẫn cần người đăng nhập lại, và bước kiểm tra session của job sẽ báo điều này.
- Watchdog mới được kiểm chứng ở nhánh không làm gì. Nhánh mở lại dùng đúng các lệnh đã chạy tay để khôi phục, nhưng lần thử thật đầu tiên sẽ là lần reboot tới, và dòng log trong `ensure.log` sẽ là bằng chứng.
