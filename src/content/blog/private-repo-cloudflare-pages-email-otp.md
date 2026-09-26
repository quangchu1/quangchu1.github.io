---
title: 'A Private Repo, Cloudflare Pages and an Email One-Time PIN: Hosting a Self-Study Site Without a Server'
description: 'Bilingual EN/VI. A static math practice site for kids: source code in a private GitHub repo, deploys by GitHub Actions to Cloudflare Pages, and sign-in by an email one-time PIN from Cloudflare Access. Why plain GitHub Pages was not enough, four Archify diagrams (deployment, CI/CD, request flow, data flow), and the small setup traps on the way.'
pubDate: 'Sep 26 2026'
---

*Bilingual post: each section is in English first, then Vietnamese. / Bài song ngữ: mỗi phần có tiếng Anh trước, tiếng Việt sau.*

*Account names, account IDs, emails, host names and the Access team domain are redacted below. / Tên tài khoản, account ID, email, tên máy và team domain của Access đều đã được che.*

---

## 1. The goal / Mục tiêu

**EN.** The starting point was a teacher's self-study page for primary-school math. Each lesson is one HTML file with a short theory recap, a worked example, auto-graded practice and a ten-question test. I wanted to build my own site in the same style, with my own content. Two questions came first: can GitHub both store the source and host the site, and can learners sign in with their Gmail address?

Looking at the reference page answered most of it. The lesson itself is fully static. CSS and JS are inline, it calls no API, and progress is saved in `localStorage`. Only the home page is different: it returns `403` and shows a password form that `POST`s to the server. That form needs code running on a server. A static host cannot provide that.

**VI.** Điểm xuất phát là trang tự học toán tiểu học của một cô giáo. Mỗi bài là một file HTML, gồm phần nhắc lý thuyết, bài mẫu, bài luyện tự chấm và bài test mười câu. Mình muốn làm một trang của riêng mình theo phong cách đó, với nội dung tự soạn. Có hai câu hỏi cần trả lời trước: GitHub có vừa lưu source vừa host trang được không, và người học có đăng nhập bằng Gmail được không?

Xem kỹ trang mẫu là trả lời được gần hết. Bản thân trang bài tập là tĩnh hoàn toàn. CSS và JS viết thẳng trong file, trang không gọi API nào, tiến độ lưu trong `localStorage`. Chỉ trang chủ là khác: nó trả `403` và hiện một form mật khẩu gửi `POST` lên server. Form đó cần code chạy phía server, việc mà một static host không làm được.

## 2. Why not just GitHub Pages / Sao không dùng luôn GitHub Pages

**EN.** GitHub Pages can serve the lessons as they are. Two things rule it out for this site:

1. **No sign-in.** Pages serves files and nothing else. A password check in browser JavaScript can be read and skipped by anyone who opens the source.
2. **The repo must be public** on the free plan. Then anyone can read or download every exercise straight from GitHub, so a login in front of the site would protect nothing.

So the split is: **GitHub keeps the code** in a private repo, **Cloudflare Pages hosts it** (free, and private repos are fine), and **Cloudflare Access** puts a login in front. For the login I picked **One-time PIN**: the learner types an email address, gets a 6-digit code, and is in. It needs no Google Cloud project. A real "Sign in with Google" button would need an OAuth client from Google Cloud Console. That is free too, but it is one more thing to set up. Access is free for up to 50 users.

**VI.** GitHub Pages phục vụ được các bài tập y như hiện tại. Nhưng có hai điểm khiến nó không hợp với trang này:

1. **Không có đăng nhập.** Pages chỉ trả file, không làm gì khác. Kiểm tra mật khẩu bằng JavaScript trong trình duyệt thì ai mở source cũng đọc được và bỏ qua được.
2. **Repo phải public** nếu dùng gói miễn phí. Khi đó ai cũng đọc hay tải được toàn bộ bài tập ngay trên GitHub, nên đặt login trước trang cũng không bảo vệ được gì.

Vì vậy mình chia ra: **GitHub lưu code** trong repo private, **Cloudflare Pages host trang** (miễn phí, repo private vẫn được), còn **Cloudflare Access** đặt lớp đăng nhập phía trước. Cách đăng nhập mình chọn là **One-time PIN**: người học gõ email, nhận mã 6 số rồi vào. Cách này không cần project Google Cloud nào. Muốn có nút "Sign in with Google" thật thì phải tạo OAuth client trên Google Cloud Console. Việc đó cũng miễn phí nhưng thêm một bước cài đặt. Access miễn phí cho tối đa 50 người dùng.

## 3. Deployment / Triển khai

<figure class="archify-figure">
	<a href="/images/private-repo-cloudflare-pages-otp/deploy-interactive.html">
		<img class="archify-light" src="/images/private-repo-cloudflare-pages-otp/deploy-light.png" width="1948" height="1240" loading="lazy" alt="Deployment architecture: inside GitHub, a push to the private repository triggers the Actions workflow, which reads two encrypted secrets and runs wrangler pages deploy into the Cloudflare Pages project. Inside Cloudflare, the learner's browser reaches the edge over HTTPS; the edge asks Access, which uses the One-time PIN identity provider and emails a code to the learner's inbox; once signed in, the edge serves the static assets from Pages. The browser also loads Google Fonts and keeps progress in localStorage." />
		<img class="archify-dark" src="/images/private-repo-cloudflare-pages-otp/deploy-dark.png" width="1948" height="1240" loading="lazy" alt="Same deployment diagram, dark theme." />
	</a>
	<figcaption>GitHub owns the code and the pipeline; Cloudflare owns hosting and sign-in. Click for the interactive version. / GitHub giữ code và pipeline, Cloudflare lo phần host và đăng nhập. Bấm để mở bản tương tác.</figcaption>
</figure>

**EN.** There are four moving parts, and each does one job:

- **Private GitHub repo.** Plain HTML/CSS/JS with no build step. `index.html` lists the lessons, `assets/site.css` holds the shared look with dark mode, and each lesson lives in its own folder such as `so-thap-phan-lop4/index.html`.
- **GitHub Actions.** One workflow that uploads the folder to Pages. The two secrets it needs are stored as encrypted Actions secrets and are never committed.
- **Cloudflare Pages.** Serves the files from the edge on `<project>.pages.dev`. Every deploy also gets its own preview URL such as `<hash>.<project>.pages.dev`.
- **Cloudflare Access.** One self-hosted application that covers **both** `<project>.pages.dev` and `*.<project>.pages.dev`, with an "Allowed emails" policy and the One-time PIN login method. The wildcard matters: without it, every preview URL is a public copy of the site.

**VI.** Có bốn thành phần, mỗi cái làm một việc:

- **Repo GitHub private.** HTML/CSS/JS thuần, không có bước build. `index.html` liệt kê các bài, `assets/site.css` chứa giao diện dùng chung có dark mode, mỗi bài nằm trong một thư mục riêng như `so-thap-phan-lop4/index.html`.
- **GitHub Actions.** Một workflow tải thư mục lên Pages. Hai secret nó cần được lưu dưới dạng Actions secret đã mã hóa, không bao giờ commit vào repo.
- **Cloudflare Pages.** Phục vụ file từ edge trên `<project>.pages.dev`. Mỗi lần deploy còn có URL preview riêng dạng `<hash>.<project>.pages.dev`.
- **Cloudflare Access.** Một application loại self-hosted phủ **cả** `<project>.pages.dev` lẫn `*.<project>.pages.dev`, có policy "Allowed emails" và cách đăng nhập One-time PIN. Wildcard rất quan trọng: thiếu nó thì mỗi URL preview là một bản sao công khai của trang.

## 4. CI/CD

<figure class="archify-figure">
	<a href="/images/private-repo-cloudflare-pages-otp/cicd-interactive.html">
		<img class="archify-light" src="/images/private-repo-cloudflare-pages-otp/cicd-light.png" width="2276" height="1248" loading="lazy" alt="CI/CD workflow: commit on a feature branch, push the branch, open a pull request, human review which either requests changes back to the commit step or merges into main. The push to main triggers the Deploy to Cloudflare Pages workflow: checkout, then wrangler-action with the two secrets runs wrangler pages deploy. If the deploy fails, fix and re-run; if it succeeds, Pages publishes a new preview URL and moves the production alias, both already behind Access." />
		<img class="archify-dark" src="/images/private-repo-cloudflare-pages-otp/cicd-dark.png" width="2276" height="1248" loading="lazy" alt="Same CI/CD workflow, dark theme." />
	</a>
	<figcaption>Every change goes through a pull request; only a merge into main deploys. Click for the interactive version. / Mọi thay đổi đều qua pull request; chỉ merge vào main mới deploy. Bấm để mở bản tương tác.</figcaption>
</figure>

**EN.** The whole pipeline is one file:

**VI.** Toàn bộ pipeline nằm trong một file:

```yaml
name: Deploy to Cloudflare Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy . --project-name=baitap-tuhoc --branch=main
```

**EN.** The AI agent that built the site is not allowed to push to `main`. It commits on a feature branch, pushes the branch, and a person opens the pull request and merges it. The merge is the only thing that deploys. The very first run failed on purpose: the secrets were not set yet, and `wrangler` refused with *"In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN"*. After the two secrets were added, a re-run of the same job went green in about 30 seconds.

**VI.** AI agent dựng trang này không được phép push lên `main`. Nó commit trên một nhánh riêng và push nhánh đó, sau đó một người tạo pull request và merge. Chỉ có bước merge mới gây ra deploy. Lần chạy đầu tiên lỗi, và lỗi đó nằm trong dự tính: secrets chưa được đặt, nên `wrangler` từ chối với thông báo *"In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN"*. Thêm hai secret xong, chạy lại chính job đó thì xanh sau khoảng 30 giây.

## 5. Request flow / Luồng request

<figure class="archify-figure">
	<a href="/images/private-repo-cloudflare-pages-otp/request-interactive.html">
		<img class="archify-light" src="/images/private-repo-cloudflare-pages-otp/request-light.png" width="1924" height="1144" loading="lazy" alt="Sequence of a first visit: the browser requests a lesson without a CF_Authorization cookie, the edge answers 302 to the Access login page, the learner submits an email, Access checks the Allowed emails policy and emails a 6-digit PIN, the learner submits the PIN, Access sets the signed CF_Authorization cookie and redirects back, the edge validates the cookie and serves the static HTML from Pages, the browser loads Google Fonts, then generates exercises and reads and writes localStorage locally." />
		<img class="archify-dark" src="/images/private-repo-cloudflare-pages-otp/request-dark.png" width="1924" height="1144" loading="lazy" alt="Same request sequence, dark theme." />
	</a>
	<figcaption>First visit: one email, one code, then 30 days without asking again. Click for the interactive version. / Lần đầu vào: một email, một mã, rồi 30 ngày không phải hỏi lại. Bấm để mở bản tương tác.</figcaption>
</figure>

**EN.** This is what `curl` shows for a request without a cookie. The page itself is never sent, only a redirect to the Access login:

**VI.** Đây là kết quả `curl` khi gửi request không có cookie. Trang không hề được trả về, chỉ có lệnh chuyển hướng tới trang đăng nhập của Access:

```
$ curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" https://<project>.pages.dev/so-thap-phan-lop4/
302 -> https://<team>.cloudflareaccess.com/cdn-cgi/access/login/<project>.pages.dev?kid=<app-aud>&...&redirect_url=%2Fso-thap-phan-lop4%2F
```

**EN.** A preview URL of a single deployment gives the same `302`, because the wildcard hostname is part of the same Access application. Once signed in, the browser holds a signed JWT cookie, `CF_Authorization`. The session is set to 720 hours, so a child signs in about once a month. The edge checks the cookie on every request, and Pages never sees an unauthenticated request.

**VI.** URL preview của từng lần deploy cũng trả về `302` như vậy, vì hostname wildcard nằm chung trong application Access đó. Sau khi đăng nhập, trình duyệt giữ một cookie JWT đã ký tên là `CF_Authorization`. Phiên đăng nhập đặt là 720 giờ, nên mỗi bạn nhỏ chỉ phải đăng nhập khoảng một lần mỗi tháng. Edge kiểm tra cookie ở mọi request, và Pages không bao giờ nhận request nào chưa xác thực.

## 6. Data flow / Luồng dữ liệu

<figure class="archify-figure">
	<a href="/images/private-repo-cloudflare-pages-otp/dataflow-interactive.html">
		<img class="archify-light" src="/images/private-repo-cloudflare-pages-otp/dataflow-light.png" width="2324" height="1204" loading="lazy" alt="Data flow: lesson files in the private repo are uploaded unchanged by GitHub Actions, using the encrypted secrets, to Pages asset storage and served from the edge cache. Access holds the allowed email list, sends the one-time PIN to the inbox and issues the CF_Authorization cookie. In the browser, exercises are generated from a seeded random generator and answers and progress are stored only in localStorage under stp4-v1; nothing goes back to a server. Google Fonts is the only third party." />
		<img class="archify-dark" src="/images/private-repo-cloudflare-pages-otp/dataflow-dark.png" width="2324" height="1204" loading="lazy" alt="Same data flow, dark theme." />
	</a>
	<figcaption>The only data about a learner is their email in the Access policy; progress never leaves the device. Click for the interactive version. / Dữ liệu duy nhất về người học là email trong policy Access; tiến độ không rời khỏi máy. Bấm để mở bản tương tác.</figcaption>
</figure>

**EN.** Where each kind of data lives:

- **Content.** Files in the repo, uploaded as they are. The exercises are not stored anywhere. Each lesson generates them in the browser from a seeded random generator, so exercise 3 of type 5 is the same on every visit. Answers are checked with integer arithmetic (`12,5` becomes `125` at one decimal place), so there are no `0.1 + 0.2` float errors. A Node check re-computed all 90 generated problems a different way, and every answer matched.
- **Secrets.** The Cloudflare token and account ID exist only as encrypted Actions secrets, plus one `chmod 600` file on the machine that set them up.
- **Identity.** The allowed email list lives in the Access policy. The PIN goes to the learner's inbox, and the session is the `CF_Authorization` cookie.
- **Progress.** Only `localStorage` key `stp4-v1` (`{ok, val, test}`). Nothing is sent back to a server. Clearing the browser deletes it, and a different device starts from zero. That is the trade-off for having no backend.

**VI.** Mỗi loại dữ liệu nằm ở đâu:

- **Nội dung.** Các file trong repo, được tải lên nguyên trạng. Bài tập không được lưu ở đâu cả. Mỗi bài tự sinh bài tập ngay trong trình duyệt bằng bộ sinh số ngẫu nhiên có hạt giống cố định, nên bài 3 của dạng 5 lần nào mở ra cũng giống nhau. Đáp án được kiểm tra bằng số học số nguyên (`12,5` thành `125` khi có một chữ số thập phân), nên không dính lỗi số thực kiểu `0.1 + 0.2`. Một script Node tính lại toàn bộ 90 bài được sinh ra theo cách khác, và mọi đáp án đều khớp.
- **Secrets.** Token Cloudflare và account ID chỉ tồn tại dưới dạng Actions secret đã mã hóa, cộng thêm một file `chmod 600` trên máy dùng để cài đặt.
- **Danh tính.** Danh sách email được phép nằm trong policy Access. Mã PIN gửi vào hộp thư của người học, còn phiên đăng nhập là cookie `CF_Authorization`.
- **Tiến độ.** Chỉ nằm trong key `stp4-v1` của `localStorage` (`{ok, val, test}`). Không gửi gì về server. Xóa dữ liệu trình duyệt là mất, đổi sang máy khác thì bắt đầu lại từ đầu. Đó là cái giá của việc không có backend.

## 7. The traps on the way / Những cái bẫy trên đường

**EN.** None of these were hard, but each one cost a round trip:

1. **`export` does not survive.** `export CLOUDFLARE_API_TOKEN=...` lives only in the terminal where you typed it, so another process (here, the agent) never sees it, and a reboot clears it. The fix is to store the token in `~/.config/cloudflare/token` with `chmod 600` and read it from there. The `gh` CLI does not have this problem, because it keeps its own token in `~/.config/gh/hosts.yml`.
2. **`read -p` is bash, not zsh.** In zsh, `-p` means "read from a coprocess", so the command failed with `read: -p: no coprocess` and wrote an empty file. A form that works in both shells is `printf 'Token: '; stty -echo; IFS= read -r T; stty echo`.
3. **A valid token that sees no account.** `/user/tokens/verify` said `active`, but `/accounts` returned `[]`. The token had no **Account Resources** selected. It also needs `Cloudflare Pages: Edit` next to the two Access permissions, otherwise the Pages API answers `Authentication error`.
4. **Pushing a workflow file needs the `workflow` scope.** GitHub rejected the first push with *"refusing to allow an OAuth App to create or update workflow ... without workflow scope"*. `gh auth refresh -h github.com -s workflow` fixes it with a device code.
5. **An empty repo has no `main` to open a PR against.** The first commit has to reach `main` somehow. Here a person pushed it once, and every change after that goes through a branch and a PR.
6. **Create Access before the first deploy.** The Access application was created while the Pages project was still empty, so there was never a moment when the site was public.
7. **A brand-new preview hostname can fail TLS for a minute.** Right after the first deploy, `<hash>.<project>.pages.dev` gave `ssl/tls alert handshake failure`. About 45 seconds later the certificate was ready, and the URL answered `302` like the rest.

**VI.** Không cái nào khó, nhưng cái nào cũng tốn thêm một vòng qua lại:

1. **`export` không tồn tại lâu.** `export CLOUDFLARE_API_TOKEN=...` chỉ sống trong đúng terminal vừa gõ, nên process khác (ở đây là agent) không thấy nó, và reboot là mất. Cách sửa là lưu token vào `~/.config/cloudflare/token` với `chmod 600` rồi đọc từ đó. `gh` CLI không bị chuyện này, vì nó tự giữ token trong `~/.config/gh/hosts.yml`.
2. **`read -p` là của bash, không phải zsh.** Trong zsh, `-p` nghĩa là "đọc từ coprocess", nên lệnh lỗi `read: -p: no coprocess` và ghi ra một file rỗng. Một cách viết chạy được trên cả hai shell là `printf 'Token: '; stty -echo; IFS= read -r T; stty echo`.
3. **Token hợp lệ nhưng không thấy tài khoản nào.** `/user/tokens/verify` báo `active`, nhưng `/accounts` trả về `[]`. Token chưa chọn **Account Resources**. Nó còn cần quyền `Cloudflare Pages: Edit` bên cạnh hai quyền Access, không thì API của Pages trả `Authentication error`.
4. **Push file workflow cần scope `workflow`.** GitHub từ chối lần push đầu với thông báo *"refusing to allow an OAuth App to create or update workflow ... without workflow scope"*. Lệnh `gh auth refresh -h github.com -s workflow` sửa được bằng một mã device.
5. **Repo trống thì không có `main` để tạo PR vào.** Commit đầu tiên phải lên được `main` bằng cách nào đó. Ở đây một người đã push lần đầu, và từ đó mọi thay đổi đều đi qua nhánh riêng và PR.
6. **Tạo Access trước lần deploy đầu tiên.** Application Access được tạo khi project Pages còn trống, nên không có lúc nào trang bị công khai.
7. **Hostname preview mới có thể lỗi TLS khoảng một phút.** Ngay sau lần deploy đầu, `<hash>.<project>.pages.dev` báo `ssl/tls alert handshake failure`. Khoảng 45 giây sau chứng chỉ đã sẵn sàng, và URL trả `302` như các URL khác.

## 8. What is still open / Những chỗ còn hở

**EN.**

- The token stored in GitHub is the same one used for setup, so it still has Access edit rights. A second token with only `Cloudflare Pages: Edit` would be enough for the pipeline.
- Access is free up to 50 users. A whole class of learners plus their parents could go past that.
- Progress stays on one device. Syncing it would need a small backend, for example a Worker with KV keyed by the Access email, and that brings back the server this design avoided.

**VI.**

- Token lưu trên GitHub là chính token dùng lúc cài đặt, nên vẫn có quyền sửa Access. Pipeline chỉ cần một token thứ hai có mỗi quyền `Cloudflare Pages: Edit`.
- Access miễn phí tới 50 người dùng. Cả một lớp học cộng thêm phụ huynh có thể vượt con số này.
- Tiến độ chỉ nằm trên một máy. Muốn đồng bộ thì cần một backend nhỏ, ví dụ một Worker với KV lưu theo email của Access, và như vậy lại mang về đúng cái server mà thiết kế này đã tránh.
