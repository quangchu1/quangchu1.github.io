---
title: 'When a Reboot Kills Your Headless Browser: A Crontab Watchdog for a Scheduled Capture Job'
description: 'Bilingual EN/VI. A daily screenshot job aborted with "session is not open" because an overnight host reboot killed the long-lived headless browser, and the job is designed to only use that session, never to open it. The fix is a small idempotent watchdog in the user crontab that reopens the session and keeps its SSO cookies fresh, plus the bug that made the first version fail silently under cron, and a C4 walk through the code.'
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
		<img class="archify-light" src="/images/browser-session-watchdog/before-light.png" width="2019" height="1748" loading="lazy" alt="Workflow before the fix: an overnight host reboot kills the playwright-cli daemon and nobody reopens it. Hours later the scheduled job's launch() runs with --no-reseed, its session probe (playwright-cli tab-list) finds no session, the job ABORTs, and an error post 'REFUSED (exit 1)' goes to the chat channel." />
		<img class="archify-dark" src="/images/browser-session-watchdog/before-dark.png" width="2019" height="1748" loading="lazy" alt="Same workflow before the fix, dark theme." />
	</a>
	<figcaption>Before: the reboot kills the browser, and nothing reopens it. Click for the interactive version. / Trước khi sửa: reboot giết browser và không có gì mở lại nó. Bấm để mở bản tương tác.</figcaption>
</figure>

**EN.** Two facts combined to cause the failure.

1. **The browser lives in a daemon, not in the job.** The capture drives a persistent headless Chromium through `playwright-cli`. A long-lived daemon holds the browser, and its Chrome profile keeps the SSO cookies on disk. The host rebooted shortly after midnight UTC. The profile survived on disk, but the daemon did not, and nothing on the host starts it again at boot.
2. **The job is designed to only use the session.** The job runs as an agent-platform script cron with `--no-reseed`. It never opens the browser and never imports cookies, because a sandboxed script cron is not allowed to read credential files. That rule is correct, but it means the job's first step, a session probe (`playwright-cli tab-list`), found nothing and aborted cleanly.

So this was not flaky and not an expired login. Every reboot would break the next run, and reboots cannot be avoided.

**VI.** Lỗi xảy ra do hai điều cộng lại.

1. **Browser nằm trong một daemon, không nằm trong job.** Job capture điều khiển một Chromium headless chạy lâu dài qua `playwright-cli`. Một daemon sống lâu giữ browser, và Chrome profile của nó lưu cookie SSO trên đĩa. Máy bị reboot ngay sau nửa đêm UTC. Profile trên đĩa vẫn còn nhưng daemon thì mất, và trên máy không có gì khởi động lại nó sau khi boot.
2. **Job được thiết kế để chỉ dùng session.** Job chạy dạng script cron của nền tảng agent với `--no-reseed`. Nó không bao giờ mở browser và không bao giờ nạp cookie, vì script cron trong sandbox không được đọc file credential. Quy tắc này đúng, nhưng nó khiến bước đầu tiên của job, bước dò session (`playwright-cli tab-list`), không thấy gì và dừng lại.

Vậy đây không phải lỗi chập chờn, cũng không phải do đăng nhập hết hạn. Lần reboot nào cũng sẽ làm hỏng lần chạy kế tiếp, và reboot thì không tránh được.

## 3. The fix / Cách khắc phục

<figure class="archify-figure">
	<a href="/images/browser-session-watchdog/after-interactive.html">
		<img class="archify-light" src="/images/browser-session-watchdog/after-light.png" width="2019" height="1374" loading="lazy" alt="Workflow after the fix: a host reboot or browser crash triggers ensure-session from the user crontab (@reboot and every 10 minutes). If the session is already open it exits 0. If not, it reopens the headless browser and loads the SSO cookie, which is refreshed hourly. If the session is open but the cookie file is newer than the last import, it loads the fresh cookies with state-load only, without navigating. The scheduled job's launch() then finds the session, the capture verifies it, and an OK post 'LAUNCHED' goes to the chat channel." />
		<img class="archify-dark" src="/images/browser-session-watchdog/after-dark.png" width="2019" height="1374" loading="lazy" alt="Same workflow after the fix, dark theme." />
	</a>
	<figcaption>After: a crontab watchdog reopens the session before the job needs it. Click for the interactive version. / Sau khi sửa: watchdog trong crontab mở lại session trước khi job cần tới. Bấm để mở bản tương tác.</figcaption>
</figure>

**EN.** The job stays as it is: it still only uses the session. What was missing is someone whose job is to *keep the session alive*. That someone has to run as the user, outside the agent sandbox, because reopening the session means loading the SSO cookie. The user's own crontab already refreshes that cookie every hour, so the watchdog goes there too.

The watchdog is a small idempotent script, `ensure-session`, with three branches:

- **Session missing:** run the existing open helper with `--reseed`. It opens the persistent profile, loads the current cookies and lands on the dashboard. The page title goes into a log.
- **Session open, cookie file newer than the last import:** push the fresh cookies into the running browser with `state-load` only. There is no navigation, so an open tab is never moved. While a capture or hygiene job is driving the browser, this step waits for the next run.
- **Otherwise:** exit 0 and do nothing.

**VI.** Job vẫn giữ nguyên: nó vẫn chỉ dùng session. Cái còn thiếu là một thành phần có nhiệm vụ *giữ cho session sống*. Thành phần đó phải chạy dưới quyền user, ngoài sandbox của agent, vì mở lại session nghĩa là phải nạp cookie SSO. Crontab của user vốn đã làm mới cookie đó mỗi giờ, nên watchdog cũng được đặt ở đó.

Watchdog là một script nhỏ, chạy lặp lại nhiều lần vẫn an toàn, tên `ensure-session`, có ba nhánh:

- **Session mất:** gọi helper mở browser có sẵn với `--reseed`. Helper mở profile, nạp cookie mới nhất và mở dashboard. Tiêu đề trang được ghi vào log.
- **Session đang mở, file cookie mới hơn lần nạp trước:** chỉ đẩy cookie mới vào browser đang chạy bằng `state-load`. Không chuyển trang, nên tab đang mở không bị động tới. Nếu đang có job capture hoặc hygiene dùng browser thì bước này đợi lần chạy sau.
- **Còn lại:** thoát với mã 0, không làm gì.

```bash
#!/bin/bash
# ensure-session: reopen the headless browser session, and keep its SSO cookies fresh
set -uo pipefail
export PATH="$HOME/.local/bin:<node-shims>:/usr/bin:/bin"              # cron has no user PATH
export PLAYWRIGHT_MCP_CONFIG="<state-dir>/playwright-cli-config.json"  # selects bundled Chromium (see §5)
STATE="<state-dir>/sso-state.json"; COOKIE="<sso-cookie-file>"; LOG="<state-dir>/ensure.log"
ts() { date -u +%FT%TZ; }

if ! playwright-cli list 2>/dev/null | grep -q "<session>"; then
  echo "$(ts) session '<session>' not open -> reopening" >>"$LOG"
  if out=$(timeout 120 pw-open --reseed <dashboard-url> 2>&1); then
    echo "$(ts) $(echo "$out" | grep 'Page Title' | tail -1)" >>"$LOG"
  else
    echo "$(ts) FAILED reopen: $(echo "$out" | tail -3 | tr '\n' ' ')" >>"$LOG"
  fi
  exit 0
fi

# Session is open: push fresh cookies in only when the SSO tool wrote a newer file.
[[ -f "$COOKIE" && "$COOKIE" -nt "$STATE" ]] || exit 0
# Never touch the browser while a job is driving it; the next run (<=10 min) retries.
pgrep -f "<capture-script>|<hygiene-script>" >/dev/null && exit 0

if python3 <cookie-converter> "$STATE" >/dev/null 2>&1 &&
   out=$(timeout 60 playwright-cli -s=<session> state-load "$STATE" 2>&1); then
  echo "$(ts) cookies refreshed in open session" >>"$LOG"
else
  echo "$(ts) FAILED cookie refresh: $(echo "${out:-converter failed}" | tail -3 | tr '\n' ' ')" >>"$LOG"
fi
```

**EN.** A reseed does three things:

1. **Convert.** A small Python converter reads the SSO tool's Netscape-format cookie file. It drops expired cookies and a junk `Max-Age` line that a failed refresh can leave behind, then writes Playwright storage-state JSON with mode `0600`. Secure cookies get `SameSite=None`, because the dashboard calls the SSO endpoint cross-site through `fetch()`. `Lax` cookies are dropped on that call, which shows up as a 403 and a bounce back to the login page. The converter prints cookie names, never values.
2. **Load.** `playwright-cli state-load` puts those cookies into the running browser context. Chrome flushes them to the profile on disk about 30 seconds later.
3. **Verify.** Only on the reopen path, the helper navigates to the dashboard and prints the page title. The title must be the dashboard's, not the SSO portal's.

A reseed never creates a login. It only copies what the SSO tool already wrote. The actual refresh is that tool's own hourly `--refresh` run in the same crontab. Once the login fully expires, a person has to sign in again.

**VI.** Reseed làm ba việc:

1. **Chuyển đổi.** Một converter Python nhỏ đọc file cookie dạng Netscape do công cụ SSO ghi ra. Nó bỏ các cookie đã hết hạn và dòng rác `Max-Age` mà một lần làm mới lỗi có thể để lại, rồi ghi ra JSON storage-state của Playwright với quyền `0600`. Cookie secure được đặt `SameSite=None`, vì dashboard gọi SSO cross-site qua `fetch()`. Cookie `Lax` sẽ bị bỏ ở lời gọi đó, và lỗi hiện ra là 403 rồi bị đẩy về trang login. Converter chỉ in tên cookie, không in giá trị.
2. **Nạp.** `playwright-cli state-load` đưa cookie vào browser đang chạy. Chrome ghi chúng xuống profile trên đĩa khoảng 30 giây sau.
3. **Kiểm tra.** Chỉ ở nhánh mở lại, helper mở dashboard và in tiêu đề trang. Tiêu đề phải là của dashboard, không phải của trang SSO.

Reseed không tạo đăng nhập mới, nó chỉ chép những gì công cụ SSO đã ghi ra. Việc làm mới thật sự là lượt `--refresh` mỗi giờ của chính công cụ đó trong cùng crontab. Khi đăng nhập hết hạn hẳn thì vẫn phải có người đăng nhập lại.

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

## 5. Update: the watchdog that silently never worked / Cập nhật: watchdog âm thầm không chạy được

**EN.** A few hours after the fix, the session died again. The cause is still unknown. The watchdog noticed within minutes and then failed on **all 23 runs**, each with only `FAILED: }  Node.js v22...` in the log. Run by hand from my own shell, the same script worked every time.

Reproducing cron's environment (`env -i HOME=$HOME PATH=/usr/bin:/bin`) showed the real error:

```
Chromium distribution 'chrome' is not found at /opt/google/chrome/chrome
```

My interactive shell exports `PLAYWRIGHT_MCP_CONFIG`, which points at a config file that selects the bundled `chromium`. Cron exports nothing, so `playwright-cli` fell back to its default: the branded Google Chrome channel, which this host does not have. The fix is one `export` line in the script. It is still the same browser, only now selected explicitly.

The lesson is not new: **test a cron script under `env -i`, not in your own shell.** My first check ran in a shell that already had the variable, so it proved nothing about cron. Afterwards all three branches were tested under `env -i`:

- Session closed → reopened, with the dashboard title in the log.
- Cookie file newer → `cookies refreshed in open session`, and the page stayed on the dashboard.
- Nothing changed → no log line.

**VI.** Vài giờ sau khi sửa, session lại chết, đến giờ vẫn chưa rõ vì sao. Watchdog phát hiện trong vài phút rồi fail **cả 23 lần chạy**, lần nào log cũng chỉ có `FAILED: }  Node.js v22...`. Chạy tay từ shell của tôi thì lần nào cũng được.

Tái tạo môi trường của cron (`env -i HOME=$HOME PATH=/usr/bin:/bin`) mới thấy lỗi thật:

```
Chromium distribution 'chrome' is not found at /opt/google/chrome/chrome
```

Shell tương tác của tôi có export `PLAYWRIGHT_MCP_CONFIG`, trỏ tới file config chọn bản `chromium` có sẵn. Cron không export gì, nên `playwright-cli` dùng mặc định là bản Google Chrome thương hiệu, mà máy này không cài. Cách sửa là thêm một dòng `export` vào script. Browser vẫn là cái cũ, chỉ là giờ được chọn tường minh.

Bài học không mới: **kiểm tra script cron bằng `env -i`, đừng kiểm tra trong shell của mình.** Lần kiểm tra đầu tôi chạy trong shell đã có sẵn biến đó, nên nó không chứng minh được gì cho cron. Sau đó cả ba nhánh đều được thử dưới `env -i`:

- Session đóng → được mở lại, log có tiêu đề dashboard.
- File cookie mới hơn → log ghi `cookies refreshed in open session`, trang vẫn ở dashboard.
- Không có gì thay đổi → không có dòng log nào.

## 6. The code, C4-style / Mã nguồn theo mô hình C4

**EN.** The C4 model describes software at four zoom levels: system context, containers, components and code. At the code level the colours mark class, instance, interface, function and module variable. Click any diagram for zoom, search and relationship tracing.

**VI.** Mô hình C4 mô tả phần mềm ở bốn mức zoom: bối cảnh hệ thống, container, component và code. Ở mức code, các màu đánh dấu class, instance, interface, function và biến của module. Bấm vào sơ đồ nào cũng mở được bản tương tác để zoom, tìm kiếm và lần theo các quan hệ.

### C1 · System context / Bối cảnh hệ thống

<figure class="archify-figure">
	<a href="/images/browser-session-watchdog/c4-1-context-interactive.html">
		<img class="archify-light" src="/images/browser-session-watchdog/c4-1-context-light.png" width="1932" height="1170" loading="lazy" alt="C4 level 1: the operator signs in to corporate SSO; the capture system reuses the SSO cookies, takes headless screenshots of the internal dashboard, and posts OK or ABORT to a chat thread that notifies the operator." />
		<img class="archify-dark" src="/images/browser-session-watchdog/c4-1-context-dark.png" width="1932" height="1170" loading="lazy" alt="Same C1 diagram, dark theme." />
	</a>
</figure>

**EN.** One person, one system, three external services. The only human step is the SSO sign-in.

**VI.** Một người, một hệ thống, ba dịch vụ bên ngoài. Bước duy nhất cần người làm là đăng nhập SSO.

### C2 · Containers

<figure class="archify-figure">
	<a href="/images/browser-session-watchdog/c4-2-container-interactive.html">
		<img class="archify-light" src="/images/browser-session-watchdog/c4-2-container-light.png" width="2019" height="1010" loading="lazy" alt="C4 level 2: inside the unsandboxed user account, the user crontab writes the SSO cookie file and opens and reseeds the playwright-cli daemon, which persists to a browser profile and reaches the internal dashboard over HTTPS; the dashboard checks SSO. Inside the agent sandbox, the cron runner starts the capture job, which only uses the daemon, saves to a dated archive, and posts status to the chat thread." />
		<img class="archify-dark" src="/images/browser-session-watchdog/c4-2-container-dark.png" width="2019" height="1010" loading="lazy" alt="Same C2 diagram, dark theme." />
	</a>
</figure>

**EN.** This level holds the design decision. Two trust zones share one browser. The user account can read the cookies, so it **opens** the daemon. The agent sandbox cannot, so it only **uses** the daemon (the dashed arrow). The incident happened because the daemon was the one container that does not survive a reboot, and it had no owner.

**VI.** Quyết định thiết kế nằm ở mức này. Hai vùng tin cậy dùng chung một browser. Tài khoản user đọc được cookie nên là bên **mở** daemon. Sandbox của agent không đọc được nên chỉ **dùng** daemon (mũi tên đứt nét). Sự cố xảy ra vì daemon là container duy nhất không sống sót qua reboot, và không có ai sở hữu nó.

### C3 · Components

<figure class="archify-figure">
	<a href="/images/browser-session-watchdog/c4-3-component-interactive.html">
		<img class="archify-light" src="/images/browser-session-watchdog/c4-3-component-light.png" width="2019" height="986" loading="lazy" alt="C4 level 3: in the user crontab zone, ensure-session calls the open helper when the session is missing; the helper runs the cookie converter, which writes the storage-state JSON, and opens the session daemon with state-load. In the agent sandbox, the capture wrapper starts the capture script with Popen; the script probes the daemon with tab-list and writes the run log and manifest, which verify reads for the reporter." />
		<img class="archify-dark" src="/images/browser-session-watchdog/c4-3-component-dark.png" width="2019" height="986" loading="lazy" alt="Same C3 diagram, dark theme." />
	</a>
</figure>

**EN.**

- **ensure-session** is the watchdog above, and the only new component.
- **open helper** is a Bash wrapper around `playwright-cli`. It opens or reuses the named session on its persistent profile, reseeds when asked or when the cookie file is newer, then navigates.
- **cookie converter** turns the Netscape cookie file into storage-state JSON (§3).
- **capture wrapper** has two modes:
  - `--launch` refuses when a capture is already running, because two runs would fight over one browser. It starts the capture detached and waits up to 150 s for its session check, so a dead session is reported at once instead of an hour later.
  - `--verify` judges the day from the log and `manifest.csv`.
- **capture script** runs with `--no-reseed`. It probes with a session-scoped verb (`tab-list`), because the global `list` would pass even for another session's browser.

**VI.**

- **ensure-session** là watchdog ở trên, và là component mới duy nhất.
- **open helper** là script Bash bọc `playwright-cli`. Nó mở hoặc dùng lại session theo tên trên profile cố định, reseed khi được yêu cầu hoặc khi file cookie mới hơn, rồi chuyển trang.
- **cookie converter** chuyển file cookie Netscape sang JSON storage-state (§3).
- **capture wrapper** có hai chế độ:
  - `--launch` từ chối chạy nếu đang có capture chạy, vì hai lần chạy sẽ tranh nhau một browser. Nó khởi động capture ở chế độ tách rời và đợi tối đa 150 giây cho bước kiểm tra session, nên session chết được báo ngay chứ không phải một giờ sau.
  - `--verify` đánh giá kết quả trong ngày từ log và `manifest.csv`.
- **capture script** chạy với `--no-reseed`. Nó dò bằng một lệnh gắn với session (`tab-list`), vì lệnh `list` toàn cục vẫn qua kể cả khi browser là của session khác.

### C4 · Code

<figure class="archify-figure">
	<a href="/images/browser-session-watchdog/c4-4-code-interactive.html">
		<img class="archify-light" src="/images/browser-session-watchdog/c4-4-code-light.png" width="1884" height="1172" loading="lazy" alt="C4 level 4, the capture wrapper module: the CLI contract dispatches --launch to launch() and --verify to verify(day). launch() calls _running_capture() and instantiates proc, a Popen object created with env=_env(), which runs assert_attached() in the capture script. verify() calls _missing_chapters(), reads the module constants, and raises class Report, which implements the Report interface from the platform or a local shim." />
		<img class="archify-dark" src="/images/browser-session-watchdog/c4-4-code-dark.png" width="1884" height="1172" loading="lazy" alt="Same C4 code diagram, dark theme." />
	</a>
</figure>

**EN.**

- **Interface: the CLI contract.** `argparse` defines a mutually exclusive group `--launch | --verify`, plus `--terse`. The scheduler reads only the exit code and one line of stdout: exit 0 is a quiet OK line, exit 1 is an alert.
- **Class `Report(Exception)` with `.message`.** It is imported from the agent platform. If that import fails (a standalone run or an old Python), the module defines a local class with the same shape. Both *implement* one informal interface: an exception whose `.message` is the report. `__main__` catches it, trims the manual-steps block when `--terse` is set, prints it and exits 1.
- **Functions.** `launch() -> str` works in three steps:
  1. Call `_running_capture()`, which runs `pgrep` and returns a PID or `None`.
  2. *Instantiate* `proc`, a `subprocess.Popen` object with `env=_env()` and `start_new_session=True`, so the capture outlives the cron wake.
  3. Poll the log every 5 s until it contains `session verified` or `proc.poll()` returns an exit code.
- **Instance `proc`** lives only inside `launch()`. Its `returncode` is the number in the `REFUSED (exit 1)` line.
- **Module variables.** `PREFLIGHT_WAIT = 150`, `EXPECTED_MIN = 30`, `STALL_SECS = 420` and the `MANUAL` text keep every threshold in one place. `verify()` compares against them, and `_missing_chapters()` diffs the manifest rows against `nav-live.json`.
- **Across the process boundary**, `proc` runs the capture script. Its `assert_attached()` is the check that printed `ABORT: ... is not open`.

**VI.**

- **Interface: hợp đồng CLI.** `argparse` định nghĩa một nhóm loại trừ nhau `--launch | --verify`, cộng thêm `--terse`. Bộ lập lịch chỉ đọc mã thoát và một dòng stdout: mã 0 là một dòng OK không gây ồn, mã 1 là cảnh báo.
- **Class `Report(Exception)` có `.message`.** Class này được import từ nền tảng agent. Nếu import lỗi (chạy độc lập hoặc Python cũ), module tự định nghĩa một class cùng hình dạng. Cả hai cùng *hiện thực* một interface không chính thức: một exception có `.message` là nội dung báo cáo. `__main__` bắt exception này, cắt phần hướng dẫn chạy tay nếu có `--terse`, in ra rồi thoát với mã 1.
- **Function.** `launch() -> str` làm ba bước:
  1. Gọi `_running_capture()`, hàm này chạy `pgrep` và trả về PID hoặc `None`.
  2. *Tạo instance* `proc`, một object `subprocess.Popen` với `env=_env()` và `start_new_session=True`, để capture sống lâu hơn lượt chạy của cron.
  3. Kiểm tra log mỗi 5 giây cho tới khi thấy `session verified` hoặc `proc.poll()` trả về mã thoát.
- **Instance `proc`** chỉ tồn tại bên trong `launch()`. `returncode` của nó chính là con số trong dòng `REFUSED (exit 1)`.
- **Biến của module.** `PREFLIGHT_WAIT = 150`, `EXPECTED_MIN = 30`, `STALL_SECS = 420` và đoạn text `MANUAL` giữ mọi ngưỡng ở một chỗ. `verify()` so sánh với các ngưỡng này, còn `_missing_chapters()` đối chiếu các dòng manifest với `nav-live.json`.
- **Qua ranh giới process**, `proc` chạy capture script. Hàm `assert_attached()` trong script đó là bước kiểm tra đã in ra `ABORT: ... is not open`.

## 7. What is still open / Những chỗ còn hở

**EN.**

- If the SSO login itself expires (about 20 hours without an interactive sign-in), the reopened browser lands on the login page. The hourly refresh cannot fix that. A person still has to sign in, and the job's session check will report it.
- Why the session died the second time is still unknown. The watchdog now heals that case within 10 minutes, but that does not explain it.
- The cookie refresh is supposed to wait while a capture is running. That path has not been exercised yet.

**VI.**

- Nếu bản thân đăng nhập SSO hết hạn (khoảng 20 giờ không đăng nhập tương tác), browser mở lại sẽ rơi vào trang login. Lượt làm mới mỗi giờ không sửa được chuyện đó. Vẫn cần người đăng nhập lại, và bước kiểm tra session của job sẽ báo điều này.
- Vẫn chưa rõ vì sao session chết lần thứ hai. Watchdog giờ tự khôi phục trường hợp đó trong vòng 10 phút, nhưng như vậy không giải thích được nguyên nhân.
- Việc làm mới cookie được thiết kế để đợi khi đang có capture chạy. Nhánh này chưa được thử.
