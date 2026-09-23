---
title: 'Kimi K3 trên Amazon Bedrock: bắc cầu một CLI chỉ biết API key sang một IAM role chỉ biết SigV4'
description: 'Kimi Code CLI chỉ gửi được api_key tĩnh; role AWS chỉ chấp nhận SigV4 và bị chặn CallWithBearerToken. Một loopback proxy ký lại từng request đã xoá luôn việc rotate token — và vì sao ký cả header của SDK là cách nhanh nhất để lãnh SignatureDoesNotMatch.'
pubDate: 'Sep 23 2026'
---

*Ghi chép kỹ thuật, đo thật trên một máy macOS, ngày 2026-09-23. Mọi con số dưới đây là kết quả chạy, không phải đọc tài liệu.*

## Hiện trạng đã xác minh

| Thành phần | Giá trị |
|---|---|
| CLI | `kimi` 2.0.2, `~/.kimi-code/bin/kimi` |
| Model | `global.moonshotai.kimi-k3` (CRIS, `ACTIVE`) |
| Proxy | `127.0.0.1:8317`, pid 8590, đang LISTEN |
| AWS | account `505192030505`, role `CaminusBedrockAccess`, region `us-east-2` |
| Upstream | `bedrock-runtime.us-east-2.amazonaws.com/openai/v1` |

Bằng chứng chạy thật:

```
/health                   → 200  {"status":"ok","profile":"codex-...","region":"us-east-2"}
POST /v1/chat/completions  → 200, model=global.moonshotai.kimi-k3
                             usage: prompt 107 / completion 64 (reasoning 48)
                             reasoning_content: có, 184 ký tự
                             latency: 15.72s
stream=true                → 27 dòng SSE `data:`
không gửi token            → 401
```

---

## 1. Problem là gì?

Vấn đề **không** phải "Bedrock không có Kimi K3". Nó có, và đang `ACTIVE`. Vấn đề là **hai đầu dây không cùng một loại xác thực**, và cả hai đầu đều không sửa được.

**Đầu CLI.** Kimi Code CLI cấu hình provider kiểu `openai`, và provider đó chỉ biết gửi **một `api_key` TĨNH** trong header `Authorization`. Nó không có khái niệm ký request.

**Đầu AWS.** Endpoint OpenAI-compatible của Bedrock nhận hai dạng auth, và **mỗi dạng cần một IAM action khác nhau**:

| Dạng auth | IAM action cần | Role `CaminusBedrockAccess` |
|---|---|---|
| Bearer token | `bedrock:CallWithBearerToken` | **bị chặn** |
| SigV4 signing | `bedrock:InvokeModel` | được phép |

Đây là **đo, không phải đoán**: đường bearer trả `401 ... not authorized to perform: bedrock:CallWithBearerToken`, còn SigV4 tới **đúng URL đó** trả `200`. Kiểm lại thì role này còn bị thắt chặt hơn — ngay cả `ListFoundationModels` cũng bị từ chối:

```
AccessDeniedException: User: arn:aws:sts::505192030505:assumed-role/
CaminusBedrockAccess/GetBuilderAccountCreds-... is not authorized
to perform: bedrock:ListFoundationModels
```

Nên khoảng trống là: **CLI chỉ biết nói API key tĩnh; role chỉ chấp nhận SigV4.** Không có cách nào để chúng nói chuyện trực tiếp.

Ba vấn đề phụ đi kèm — và đây là chỗ một lời giải "để sau tính" sẽ chết:

**(a) Token 12 tiếng.** Kể cả nếu bearer được phép, token sinh ra hết hạn sau ~12 giờ. Thành một việc xoay tay định kỳ, mãi mãi.

**(b) Kimi K3 không có in-region endpoint ở BẤT KỲ region nào.** Chỉ hai id cross-Region inference profile là hợp lệ. Gọi `moonshotai.kimi-k3` trần sẽ fail.

**(c) `SignatureDoesNotMatch`.** Cái bẫy ăn nhiều thời gian nhất. OpenAI JS SDK gửi kèm một loạt header kiểu-trình-duyệt và telemetry: `x-stainless-*`, `sec-fetch-mode`, `accept-language`. Nếu proxy ký **cả chúng**, những header đó nằm trong `SignedHeaders`; rồi bất cứ tầng nào trên đường đi viết lại hoặc bỏ đi một cái — signature vỡ.

---

## 2. Giải pháp là gì?

Một **loopback proxy tự ký lại từng request**, đặt giữa hai đầu:

```
kimi ──HTTP(api_key tĩnh)──▶ 127.0.0.1:8317/v1 ──SigV4──▶ bedrock-runtime
                                  proxy.py
                              profile codex-***
```

Điểm cốt lõi của thiết kế: **ký lại ở mỗi request**, chứ không phải cấp một token rồi dùng lại. Hệ quả trực tiếp là **không có gì để rotate** — boto3 resolve credential tạm thời của profile ở **mỗi lần gọi**, nên chúng tự làm mới. Vấn đề (a) biến mất *theo kiến trúc*, không phải theo một cron job.

`config.toml` phía CLI chỉ cần trỏ về loopback:

```toml
default_model = "bedrock/kimi-k3"

[providers.bedrock-codex]
type     = "openai"
base_url = "http://127.0.0.1:8317/v1"
api_key  = "op6p…"          # secret của PROXY, không phải AWS credential

[models."bedrock/kimi-k3"]
provider         = "bedrock-codex"
model            = "global.moonshotai.kimi-k3"
max_context_size = 1048576
capabilities     = ["thinking","always_thinking","image_in","tool_use"]
default_effort   = "high"
```

---

## 3. Cách xây dựng — và mỗi miếng giải quyết vấn đề nào

Bốn quyết định thiết kế, mỗi cái ứng với một vấn đề ở mục 1.

### 3.1 Ký lại per-request → diệt vấn đề (a)

```python
def _sign(method, url, body, headers):
    creds = _session.get_credentials()      # resolve MỖI lần gọi
    req = AWSRequest(method=method, url=url, data=body, headers=dict(headers))
    SigV4Auth(creds.get_frozen_credentials(), "bedrock", REGION).add_auth(req)
    return dict(req.headers)
```

Không cache credential. Đó chính là lý do không có token 12 tiếng nào phải xoay.

### 3.2 Chỉ ký header tự mình kiểm soát → diệt vấn đề (c)

```python
fwd = {"Content-Type": "application/json"}
if wants_stream:
    fwd["Accept"] = "text/event-stream"
signed = _sign("POST", url, body, fwd)
```

Proxy **không forward header của client**. Nó dựng một bộ header tối thiểu, ký đúng bộ đó, gửi đúng bộ đó. `x-stainless-*` và `sec-fetch-mode` không bao giờ vào `SignedHeaders`. Đây vừa là bản sửa cho `SignatureDoesNotMatch`, vừa là tác dụng phụ tốt: telemetry của SDK không rò lên AWS.

### 3.3 Quyết định streaming từ BODY, không từ header

```python
wants_stream = bool(json.loads(body or b"{}").get("stream"))
```

Vì `body` là thứ Bedrock thật sự tôn trọng, không phải `Accept` của client.

Và khi stream về, dùng `read1` chứ không `read`:

```python
while block := upstream.read1(65536):
    self.wfile.write(b"%x\r\n%s\r\n" % (len(block), block))
    self.wfile.flush()
```

`read1` trả ngay khi **có bất kỳ** dữ liệu, nên token hiện lên màn hình đúng lúc Bedrock phát ra — không đợi đầy buffer 64 KiB.

### 3.4 Hard-code danh sách model → diệt vấn đề (b) và một IAM action

```python
MODELS = ["global.moonshotai.kimi-k3", "us.moonshotai.kimi-k3"]
```

`GET /v1/models` trả danh sách **local**. Hai lợi ích: chỉ hai CRIS id hợp lệ được phơi ra (không ai gõ nhầm một id in-region không tồn tại), và việc liệt kê model **không phụ thuộc thêm một IAM action** — điều này hoá ra là bắt buộc, vì `ListFoundationModels` đúng là bị chặn.

### 3.5 Thế an ninh

Loopback **không phải** biên giới tin cậy trên một desktop nhiều process. Vì vậy:

- Bind `127.0.0.1` duy nhất — không với tới được từ ngoài host.
- **Vẫn** đòi shared secret (file `token`, mode 0600). Không có nó, bất kỳ process local nào cũng tiêu tiền AWS qua cổng này. Đã kiểm: request không token → `401`.
- Không bao giờ log body request/response, không bao giờ log AWS credential.
- `token` **không phải** AWS credential — mất nó không mất quyền AWS.

### 3.6 Giá: "global" và "us" không cùng bậc

| Alias | Model id | USD /1M token (in/out) |
|---|---|---|
| `bedrock/kimi-k3` | `global.moonshotai.kimi-k3` | 3.00 / 15.00 |
| `bedrock/kimi-k3-us` | `us.moonshotai.kimi-k3` | 3.30 / 16.50 |

US-Geo đắt hơn **10%**. Chỉ chọn nó khi bắt buộc giữ request trong địa lý Mỹ.

---

## 4. Sơ đồ UML

### 4.1 Component / deployment

```
┌───────────────────────────── macOS host ────────────────────────────────┐
│                                                                         │
│  ┌──────────────────┐                                                   │
│  │  «CLI»           │   config.toml (0600)                              │
│  │  kimi 2.0.2      │   provider type = openai                          │
│  │                  │   base_url = http://127.0.0.1:8317/v1             │
│  └────────┬─────────┘   api_key   = <proxy secret>                      │
│           │ HTTP + api_key TĨNH                                         │
│           ▼                                                             │
│  ┌──────────────────────────────────────┐                               │
│  │  «process»  proxy.py  (pid 8590)     │                               │
│  │  bind 127.0.0.1:8317 ── loopback ONLY│                               │
│  │  ─────────────────────────────────── │   .venv/  boto3==1.43.97      │
│  │  + GET  /health        (no auth)     │   token   (0600)              │
│  │  + GET  /v1/models     (local list)  │   proxy.log (không có body)   │
│  │  + POST /v1/chat/completions         │                               │
│  │  ─────────────────────────────────── │                               │
│  │  ‑ KHÔNG forward header client       │                               │
│  │  ‑ KHÔNG cache credential            │                               │
│  └────────┬─────────────────────────────┘                               │
│           │ SigV4 (service=bedrock, region=us-east-2)                   │
└───────────┼─────────────────────────────────────────────────────────────┘
            ▼
   ┌────────────────────────────────────────────────┐
   │  «AWS»  bedrock-runtime.us-east-2              │
   │         /openai/v1/chat/completions            │
   │  ┌──────────────────────────────────────────┐  │
   │  │ CRIS  global.moonshotai.kimi-k3  ACTIVE  │  │
   │  │ CRIS  us.moonshotai.kimi-k3      ACTIVE  │  │
   │  └──────────────────────────────────────────┘  │
   │  role CaminusBedrockAccess:                    │
   │    InvokeModel            ✔                    │
   │    CallWithBearerToken    ✘                    │
   │    ListFoundationModels   ✘                    │
   └────────────────────────────────────────────────┘
```

### 4.2 Sequence — vì sao đường trực tiếp chết

```
kimi                    Bedrock /openai/v1
 │                            │
 │─ POST + bearer token ─────▶│
 │                            │── IAM check: CallWithBearerToken
 │◀──── 401 not authorized ───│   ✘ DENIED
 │                            │
 ═══ cùng URL, đổi cách ký ═══
 │                            │
 │─ POST + SigV4 ────────────▶│
 │                            │── IAM check: InvokeModel
 │◀──── 200 OK ───────────────│   ✔ ALLOWED
 │                            │
   → Kết luận: không thiếu quyền gọi model.
     Thiếu đúng một thứ: ai đó phải KÝ hộ.
```

### 4.3 Sequence — một lượt non-streaming (đo thật: 200, 15.72s)

```
 kimi          proxy.py              boto3         Bedrock
  │               │                    │              │
  │─POST /v1/chat/completions ────────▶│              │
  │  Authorization: Bearer <secret>    │              │
  │  body {model, messages}            │              │
  │               │                    │              │
  │          [1] so khớp secret        │              │
  │               │  sai → 401 ────────┼──────────────┼─▶ (đã kiểm: 401)
  │               │                    │              │
  │          [2] đọc body → stream=false              │
  │               │                    │              │
  │          [3] dựng header TỐI THIỂU │              │
  │               │  {Content-Type}    │              │
  │               │                    │              │
  │          [4] get_credentials() ───▶│              │
  │               │◀── creds tươi ─────│  (tự refresh)│
  │          [5] SigV4Auth.add_auth()  │              │
  │               │                    │              │
  │          [6] POST đã ký ───────────┼─────────────▶│
  │               │                    │        IAM: InvokeModel ✔
  │               │                    │        CRIS routing
  │               │◀─── 200 + JSON ────┼──────────────│
  │               │                    │              │
  │          [7] copy Content-Length   │              │
  │◀─ 200 JSON ───│                    │              │
  │                                                   │
  │  usage: prompt 107 / completion 64 (reasoning 48) │
  │  reasoning_content: 184 ký tự → CLI tự nhận dạng  │
```

`reasoning_content` là **tên field chuẩn**, nên CLI tự phát hiện — không cần khai `reasoning_key`.

### 4.4 Sequence — streaming (đo thật: 27 dòng SSE)

```
 kimi          proxy.py                    Bedrock
  │               │                           │
  │─POST stream:true ────────────────────────▶│
  │          [1] wants_stream ← BODY          │
  │               │   (không đọc Accept)      │
  │          [2] fwd["Accept"]=text/event-stream
  │          [3] ký + gửi ───────────────────▶│
  │               │◀── 200 text/event-stream ─│
  │          [4] Transfer-Encoding: chunked   │
  │               │                           │
  │               │   loop: read1(65536)      │
  │◀─ chunk ──────│◀───── data: {...} ────────│  ← trả NGAY
  │◀─ chunk ──────│◀───── data: {...} ────────│     khi có byte
  │◀─ chunk ──────│◀───── data: [DONE] ───────│
  │◀─ 0\r\n\r\n ──│                           │
  │                                           │
  │  ⚠ nếu user Ctrl-C giữa dòng:             │
  │     BrokenPipeError → proxy bắt & bỏ qua  │
  │     (có thật trong proxy.log, vô hại)     │
```

### 4.5 State — `start.sh` (idempotent)

```
      ┌─────────┐
      │  START  │
      └────┬────┘
           ▼
   ┌───────────────┐   thiếu   ┌──────────────────────┐
   │ .venv có sẵn? ├──────────▶│ python3 -m venv      │
   └───────┬───────┘           │ pip boto3==1.43.97   │
           │ có                └──────────┬───────────┘
           ▼◀─────────────────────────────┘
   ┌───────────────┐   thiếu   ┌──────────────────────┐
   │ token có sẵn? ├──────────▶│ token_urlsafe(32)    │
   └───────┬───────┘           │ chmod 600            │
           │ có                └──────────┬───────────┘
           ▼◀─────────────────────────────┘
   ┌────────────────────┐  còn sống  ┌──────────────────┐
   │ pid file + kill -0 ├───────────▶│ "already running"│
   └─────────┬──────────┘            │      exit 0      │
             │ chết / không có       └──────────────────┘
             ▼
   ┌────────────────────┐  bị chiếm  ┌──────────────────┐
   │ port 8317 rảnh?    ├───────────▶│ error exit 1     │
   └─────────┬──────────┘            └──────────────────┘
             │ rảnh
             ▼
   ┌────────────────────┐
   │ nohup launch       │
   │ ghi proxy.pid      │
   │ sleep 6            │
   └─────────┬──────────┘
             ▼
   ┌────────────────────┐  chết  ┌────────────────────────┐
   │ vẫn sống?          ├───────▶│ in 15 dòng log, exit 1 │
   └─────────┬──────────┘        └────────────────────────┘
             │ sống
             ▼
   ┌────────────────────┐
   │ curl /health → RUN │
   └────────────────────┘
```

---

## Những chỗ còn hở

Nói thẳng, không tô:

1. **Không phải launchd service.** Phải chạy `start.sh` mỗi phiên. Proxy chết → `kimi` chết theo.
2. **Service tier (Priority / Flex) chưa nối.** Chúng set per-request qua `service_tier`, mà CLI không phơi trường này ra.
3. **`BrokenPipeError` có thật trong `proxy.log`** khi client ngắt giữa stream. Proxy bắt và bỏ qua, nhưng traceback vẫn làm đầy log.
4. **Lệch phiên bản:** README ghi cài với CLI 2.0.1, binary hiện báo **2.0.2**. Nó đã tự update; chưa kiểm lại SHA256 sau lần update đó.
5. **Latency 15.72s** cho 64 token với `default_effort = "high"` và `always_thinking`. **48 trong 64** token đầu ra là reasoning token — trả tiền full giá output. Muốn nhanh và rẻ thì hạ effort.

## Vận hành

```sh
~/.kimi-code/bedrock/start.sh
curl -s http://127.0.0.1:8317/health
tail -f ~/.kimi-code/bedrock/proxy.log
~/.kimi-code/bedrock/stop.sh
```

---

Bài học mang đi được: khi một CLI chỉ biết **API key tĩnh** mà backend chỉ chấp nhận **request signing**, một loopback proxy ký lại từng request là lời giải đúng — nó xoá luôn việc rotate token thay vì đẩy việc đó cho tương lai. Nhưng nó chỉ đúng nếu bạn ký **đúng bộ header mình kiểm soát**; ký cả telemetry của SDK là cách nhanh nhất để lãnh một `SignatureDoesNotMatch` không rõ từ đâu ra.
