---
title: 'Getting Started with the AWS Bedrock AgentCore Starter Toolkit (EN/VI)'
description: 'A bilingual (English + Vietnamese) developer intro to Amazon Bedrock AgentCore: which CLI to use now, the modular services, and how to get started.'
pubDate: 'Jul 13 2026'
---

# Getting Started with the AWS Bedrock AgentCore Starter Toolkit — Bắt đầu với AWS Bedrock AgentCore Starter Toolkit

*Source: the [AWS Bedrock AgentCore Starter Toolkit repository](https://github.com/aws/bedrock-agentcore-starter-toolkit) (README.md and documentation) — Nguồn: kho mã nguồn và tài liệu của AWS Bedrock AgentCore Starter Toolkit.*

---

## 1. Introduction

If you've built an AI agent that works beautifully on your laptop — with Strands, LangGraph, CrewAI, or your own custom logic — you've probably hit the hard part: getting it into production. Servers, scaling, session isolation, authentication, memory, monitoring… none of it is agent logic, but all of it stands between your prototype and real users.

**Amazon Bedrock AgentCore** is AWS's answer to that gap. It lets you deploy and operate highly effective agents securely, at scale, using *any framework and any model*. AgentCore provides tools and capabilities to make agents more effective, purpose-built infrastructure to securely scale them, and controls to operate trustworthy agents. Its services are composable and work with popular open-source frameworks, so you don't have to choose between open-source flexibility and enterprise-grade security and reliability.

The **Bedrock AgentCore Starter Toolkit** is a Python package that has historically been the on-ramp to this platform: CLI tools and higher-level abstractions for deploying Python agents, importing existing Bedrock Agents, integrating gateways, managing configuration, and observing agents in production. But before you install anything, there's one important thing you need to know — covered in the next section.

## 1. Giới thiệu

Nếu bạn đã từng xây dựng một AI agent chạy tốt trên máy cá nhân — bằng Strands, LangGraph, CrewAI, hay logic tự viết — thì có lẽ bạn đã gặp phần khó nhất: đưa nó vào môi trường production. Máy chủ, khả năng mở rộng (scaling), cách ly phiên làm việc (session isolation), xác thực, bộ nhớ, giám sát… tất cả đều không phải là logic của agent, nhưng lại là rào cản giữa bản prototype và người dùng thực.

**Amazon Bedrock AgentCore** là lời giải của AWS cho khoảng cách đó. Nó cho phép bạn triển khai và vận hành các agent hiệu quả một cách an toàn, ở quy mô lớn, với *bất kỳ framework và model nào*. AgentCore cung cấp các công cụ giúp agent hoạt động hiệu quả hơn, hạ tầng chuyên dụng để mở rộng agent một cách an toàn, và các cơ chế kiểm soát để vận hành agent đáng tin cậy. Các dịch vụ của AgentCore có tính composable (có thể ghép nối linh hoạt) và tương thích với các framework mã nguồn mở phổ biến, nên bạn không phải đánh đổi giữa sự linh hoạt của mã nguồn mở và độ bảo mật, tin cậy cấp doanh nghiệp.

**Bedrock AgentCore Starter Toolkit** là một package Python vốn là "cửa ngõ" vào nền tảng này: bộ công cụ CLI và các lớp trừu tượng cấp cao để triển khai agent viết bằng Python, import các Bedrock Agent sẵn có, tích hợp gateway, quản lý cấu hình, và giám sát agent trong production. Nhưng trước khi cài đặt bất cứ thứ gì, có một điều quan trọng bạn cần biết — được trình bày ngay ở phần tiếp theo.

---

## 2. Important: Which CLI Should You Use?

Here's the headline straight from the repository: **the Starter Toolkit CLI is no longer supported, and it is no longer the recommended starting point.** The recommended way to create, develop, and deploy AI agents on Amazon Bedrock AgentCore is now the **AgentCore CLI** (`@aws/agentcore`), installed via npm:

```bash
npm install -g @aws/agentcore
```

Why the switch? According to the project's README, the AgentCore CLI supports a broader set of frameworks (Strands, LangGraph, LangChain, Google ADK, OpenAI Agents, and bring-your-own), and provides local development with hot reload, built-in evaluations, gateway management, and more.

That said, the Python starter toolkit **remains available for existing Python-based workflows**:

```bash
pip install bedrock-agentcore-starter-toolkit
```

If you've already migrated off the starter toolkit, the README suggests uninstalling it:

```bash
pip uninstall bedrock-agentcore-starter-toolkit
```

And if you're migrating, AWS provides a step-by-step [Migration Guide](https://github.com/awslabs/amazon-bedrock-agentcore-samples/blob/main/MIGRATION.md) plus full [AgentCore CLI documentation](https://github.com/aws/agentcore-cli/tree/main/docs) covering commands (`create`, `deploy`, `dev`, `invoke`, `add`, `remove`, `logs`, `traces`, `evals`), supported frameworks, configuration (`agentcore.json`, `mcp.json`), local development, Memory, Gateway, Evaluations, and IAM permissions.

## 2. Lưu ý quan trọng: Nên dùng CLI nào?

Thông báo quan trọng nhất ngay từ đầu repository: **CLI của Starter Toolkit không còn được hỗ trợ, và không còn là điểm khởi đầu được khuyến nghị.** Cách được khuyến nghị hiện nay để tạo, phát triển và triển khai AI agent trên Amazon Bedrock AgentCore là **AgentCore CLI** (`@aws/agentcore`), cài đặt qua npm:

```bash
npm install -g @aws/agentcore
```

Vì sao có sự thay đổi này? Theo README của dự án, AgentCore CLI hỗ trợ nhiều framework hơn (Strands, LangGraph, LangChain, Google ADK, OpenAI Agents, và cả framework tự chọn — BYO), đồng thời cung cấp môi trường phát triển local với hot reload, tính năng đánh giá (evaluations) tích hợp sẵn, quản lý gateway, và nhiều hơn nữa.

Tuy vậy, starter toolkit viết bằng Python **vẫn khả dụng cho các quy trình làm việc Python hiện có**:

```bash
pip install bedrock-agentcore-starter-toolkit
```

Nếu bạn đã hoàn tất chuyển đổi khỏi starter toolkit, README khuyên gỡ cài đặt nó:

```bash
pip uninstall bedrock-agentcore-starter-toolkit
```

Còn nếu bạn đang trong quá trình chuyển đổi, AWS cung cấp [Migration Guide](https://github.com/awslabs/amazon-bedrock-agentcore-samples/blob/main/MIGRATION.md) hướng dẫn từng bước, cùng [tài liệu AgentCore CLI](https://github.com/aws/agentcore-cli/tree/main/docs) đầy đủ về các lệnh (`create`, `deploy`, `dev`, `invoke`, `add`, `remove`, `logs`, `traces`, `evals`), các framework được hỗ trợ, cấu hình (`agentcore.json`, `mcp.json`), phát triển local, Memory, Gateway, Evaluations và quyền IAM.

---

## 3. The Modular Services

Amazon Bedrock AgentCore is not one monolithic product — it's a set of modular services you can use together or independently:

- **🛠️ Runtime** — A secure, serverless runtime purpose-built for deploying and scaling dynamic AI agents and tools using any open-source framework (LangGraph, CrewAI, Strands Agents), any protocol, and any model. It offers industry-leading extended runtime support, fast cold starts, true session isolation, built-in identity, and multi-modal payload support.

- **🧠 Memory** — Makes it easy to build context-aware agents by eliminating complex memory infrastructure management while giving you full control over what the agent remembers. Supports both short-term memory for multi-turn conversations and long-term memory shared across agents and sessions.

- **🔗 Gateway** — Acts as a managed Model Context Protocol (MCP) server that converts APIs and Lambda functions into MCP tools agents can use. It handles OAuth ingress authorization and secure egress credential exchange, and offers composition plus built-in semantic search over tools, letting agents scale to hundreds or thousands of tools.

- **💻 Code Interpreter** — Enables agents to securely execute code in isolated sandbox environments, with advanced configuration support and seamless integration with popular frameworks — for complex workflows and data analysis under enterprise security requirements.

- **🌐 Browser** — A fast, secure, cloud-based browser runtime that lets AI agents interact with websites at scale, with enterprise-grade security, comprehensive observability, and automatic scaling — no infrastructure management overhead.

- **📊 Observability** — Helps developers trace, debug, and monitor agent performance in production through unified operational dashboards, with OpenTelemetry-compatible telemetry and detailed visualizations of each step of the agent workflow.

- **🎯 Evaluation** — Lets developers assess and improve agent quality through built-in and custom evaluators, with on-demand evaluation and continuous monitoring via online evaluation — measuring metrics like helpfulness, correctness, and goal success rates. It integrates with Observability for actionable insights.

- **🔐 Identity** — Provides secure, scalable agent identity and access management, compatible with existing identity providers (no user migration or rebuilt auth flows). A secure token vault minimizes consent fatigue, and just-enough access with secure permission delegation lets agents safely reach AWS resources and third-party services.

- **🛡️ Policy** — Gives you real-time, deterministic control over an agent's actions through AgentCore Gateway, keeping agents within defined boundaries and business rules without slowing them down. Rules can be expressed in natural language or authored directly in Cedar, AWS's open-source policy language.

- **🔐 Import Agent** — Enables seamless migration of existing Amazon Bedrock Agents to LangChain/LangGraph or Strands frameworks while automatically integrating AgentCore primitives like Memory, Code Interpreter, and Gateway — migrate in minutes with full feature parity and deploy directly to AgentCore Runtime.

## 3. Các dịch vụ mô-đun

Amazon Bedrock AgentCore không phải là một sản phẩm nguyên khối — đó là một tập hợp các dịch vụ mô-đun mà bạn có thể dùng kết hợp hoặc độc lập:

- **🛠️ Runtime** — Môi trường thực thi (runtime) serverless, an toàn, được thiết kế riêng cho việc triển khai và mở rộng các AI agent và công cụ động, với bất kỳ framework mã nguồn mở nào (LangGraph, CrewAI, Strands Agents), bất kỳ giao thức và model nào. Hỗ trợ thời gian chạy kéo dài hàng đầu, cold start nhanh, cách ly phiên thực sự (true session isolation), identity tích hợp sẵn và payload đa phương thức (multi-modal).

- **🧠 Memory** — Giúp xây dựng agent có nhận thức ngữ cảnh dễ dàng bằng cách loại bỏ việc quản lý hạ tầng bộ nhớ phức tạp, trong khi bạn vẫn toàn quyền kiểm soát những gì agent ghi nhớ. Hỗ trợ cả bộ nhớ ngắn hạn cho hội thoại nhiều lượt và bộ nhớ dài hạn chia sẻ giữa các agent và phiên làm việc.

- **🔗 Gateway** — Hoạt động như một máy chủ Model Context Protocol (MCP) được quản lý, chuyển đổi các API và Lambda function thành công cụ MCP mà agent có thể sử dụng. Gateway xử lý phần phức tạp của ủy quyền OAuth chiều vào (ingress) và trao đổi thông tin xác thực an toàn chiều ra (egress), đồng thời hỗ trợ ghép nối và tìm kiếm ngữ nghĩa (semantic search) trên các công cụ — giúp agent mở rộng tới hàng trăm, hàng nghìn công cụ.

- **💻 Code Interpreter** — Cho phép agent thực thi mã một cách an toàn trong các môi trường sandbox cách ly, với khả năng cấu hình nâng cao và tích hợp mượt mà với các framework phổ biến — phục vụ các quy trình phức tạp và phân tích dữ liệu, đáp ứng yêu cầu bảo mật doanh nghiệp.

- **🌐 Browser** — Trình duyệt chạy trên đám mây, nhanh và an toàn, cho phép AI agent tương tác với các website ở quy mô lớn, với bảo mật cấp doanh nghiệp, khả năng quan sát (observability) toàn diện và tự động mở rộng — không cần quản lý hạ tầng.

- **📊 Observability** — Giúp lập trình viên theo dõi (trace), gỡ lỗi và giám sát hiệu năng agent trong production qua các dashboard vận hành hợp nhất, hỗ trợ telemetry tương thích OpenTelemetry và trực quan hóa chi tiết từng bước trong quy trình của agent.

- **🎯 Evaluation** — Cho phép đánh giá và cải thiện chất lượng agent qua các bộ đánh giá (evaluator) có sẵn hoặc tùy chỉnh, hỗ trợ đánh giá theo yêu cầu và giám sát liên tục qua đánh giá trực tuyến (online evaluation) — đo các chỉ số như mức độ hữu ích, độ chính xác và tỷ lệ hoàn thành mục tiêu. Tích hợp với Observability để cung cấp thông tin hành động cụ thể.

- **🔐 Identity** — Cung cấp khả năng quản lý danh tính và quyền truy cập cho agent một cách an toàn, có thể mở rộng, tương thích với các nhà cung cấp danh tính (identity provider) hiện có — không cần di trú người dùng hay xây lại luồng xác thực. Kho token bảo mật (token vault) giúp giảm "mệt mỏi cấp quyền" (consent fatigue), còn cơ chế cấp quyền vừa đủ (just-enough access) và ủy quyền an toàn cho phép agent truy cập tài nguyên AWS và dịch vụ bên thứ ba một cách an toàn.

- **🛡️ Policy** — Cho bạn quyền kiểm soát tất định (deterministic), theo thời gian thực đối với hành động của agent thông qua AgentCore Gateway, đảm bảo agent luôn nằm trong ranh giới và quy tắc nghiệp vụ đã định mà không làm chậm chúng. Bạn có thể mô tả quy tắc bằng ngôn ngữ tự nhiên hoặc viết trực tiếp bằng Cedar — ngôn ngữ policy mã nguồn mở của AWS.

- **🔐 Import Agent** — Cho phép di trú liền mạch các Amazon Bedrock Agent hiện có sang framework LangChain/LangGraph hoặc Strands, đồng thời tự động tích hợp các thành phần AgentCore như Memory, Code Interpreter và Gateway — di trú trong vài phút với đầy đủ tính năng tương đương và triển khai thẳng lên AgentCore Runtime.

---

## 4. Getting Started

### Recommended: AgentCore CLI

For new projects, install the AgentCore CLI globally with npm:

```bash
npm install -g @aws/agentcore
```

See the [AgentCore CLI README](https://github.com/aws/agentcore-cli) and [docs](https://github.com/aws/agentcore-cli/tree/main/docs) for full usage.

### Starter Toolkit (Python)

If you prefer a Python-based workflow, the exact installation steps from the README are:

```bash
# Install uv if you haven't already
curl -LsSf https://astral.sh/uv/install.sh | sh

# Create the virtual environment (requires python 3.10) and activate it
uv venv --python 3.10
source .venv/bin/activate

# Install using uv (recommended)
uv pip install bedrock-agentcore-starter-toolkit

# Or alternatively with pip
pip install bedrock-agentcore-starter-toolkit
```

Once installed, you can scaffold a brand-new project with:

```bash
agentcore create
```

Pick your favorite Agent SDK framework and model provider — for example Strands with Amazon Bedrock — and you'll get a project ready to be deployed onto AgentCore. The interactive prompts let you choose a project name, an Agent SDK (AutoGen, CrewAI, LangGraph, Strands, etc.), a template (`basic` for runtime-only projects, or `production` for full monorepos with CDK or Terraform infrastructure-as-code), a model provider, and optional MCP integration and memory.

## 4. Bắt đầu

### Khuyến nghị: AgentCore CLI

Với dự án mới, cài đặt AgentCore CLI toàn cục bằng npm:

```bash
npm install -g @aws/agentcore
```

Xem [README của AgentCore CLI](https://github.com/aws/agentcore-cli) và [tài liệu](https://github.com/aws/agentcore-cli/tree/main/docs) để biết cách sử dụng đầy đủ.

### Starter Toolkit (Python)

Nếu bạn ưa thích quy trình làm việc dựa trên Python, các bước cài đặt chính xác theo README là:

```bash
# Cài uv nếu bạn chưa có
curl -LsSf https://astral.sh/uv/install.sh | sh

# Tạo virtual environment (yêu cầu python 3.10) và kích hoạt
uv venv --python 3.10
source .venv/bin/activate

# Cài bằng uv (khuyến nghị)
uv pip install bedrock-agentcore-starter-toolkit

# Hoặc dùng pip
pip install bedrock-agentcore-starter-toolkit
```

Sau khi cài đặt, bạn có thể khởi tạo một dự án hoàn toàn mới bằng lệnh:

```bash
agentcore create
```

Chọn framework Agent SDK và nhà cung cấp model bạn thích — ví dụ Strands với Amazon Bedrock — và bạn sẽ có một dự án sẵn sàng triển khai lên AgentCore. Các câu hỏi tương tác cho phép bạn chọn tên dự án, Agent SDK (AutoGen, CrewAI, LangGraph, Strands, v.v.), template (`basic` cho dự án chỉ có runtime, hoặc `production` cho monorepo đầy đủ với hạ tầng dạng mã — infrastructure-as-code — bằng CDK hoặc Terraform), nhà cung cấp model, cùng tùy chọn tích hợp MCP và memory.

---

## 5. When to Use What

The guidance from the repository is straightforward:

- **Starting a new project?** Use the **AgentCore CLI** (`npm install -g @aws/agentcore`). It's the recommended path, with broader framework support (Strands, LangGraph, LangChain, Google ADK, OpenAI Agents, BYO), local development with hot reload, built-in evaluations, and gateway management.
- **Already invested in a Python-based workflow with the starter toolkit?** The Python package (`bedrock-agentcore-starter-toolkit`) remains available, and `agentcore create` still works for scaffolding Python projects. But it is no longer the recommended starting point, so plan your migration.
- **Migrating between the two?** Follow the [Migration Guide](https://github.com/awslabs/amazon-bedrock-agentcore-samples/blob/main/MIGRATION.md), and once you've migrated, uninstall the old toolkit with `pip uninstall bedrock-agentcore-starter-toolkit`.
- **Have existing Amazon Bedrock Agents?** Use **Import Agent** to migrate them to LangChain/LangGraph or Strands with AgentCore primitives integrated automatically.

## 5. Khi nào dùng gì

Hướng dẫn từ repository khá rõ ràng:

- **Bắt đầu dự án mới?** Dùng **AgentCore CLI** (`npm install -g @aws/agentcore`). Đây là con đường được khuyến nghị, với hỗ trợ framework rộng hơn (Strands, LangGraph, LangChain, Google ADK, OpenAI Agents, BYO), phát triển local với hot reload, đánh giá tích hợp sẵn và quản lý gateway.
- **Đã đầu tư vào quy trình Python với starter toolkit?** Package Python (`bedrock-agentcore-starter-toolkit`) vẫn khả dụng, và `agentcore create` vẫn hoạt động để khởi tạo dự án Python. Nhưng nó không còn là điểm khởi đầu được khuyến nghị, nên hãy lên kế hoạch chuyển đổi.
- **Đang chuyển đổi giữa hai công cụ?** Làm theo [Migration Guide](https://github.com/awslabs/amazon-bedrock-agentcore-samples/blob/main/MIGRATION.md), và sau khi chuyển đổi xong, gỡ toolkit cũ bằng `pip uninstall bedrock-agentcore-starter-toolkit`.
- **Có sẵn Amazon Bedrock Agent?** Dùng **Import Agent** để di trú chúng sang LangChain/LangGraph hoặc Strands, với các thành phần AgentCore được tích hợp tự động.

---

## 6. Wrap-up

Amazon Bedrock AgentCore takes the parts of agent development nobody enjoys — infrastructure, security, identity, memory plumbing, monitoring — and turns them into composable managed services, so you can keep your agent logic exactly as you wrote it. The key takeaway for newcomers: start with the **AgentCore CLI** (`npm install -g @aws/agentcore`), and treat the Python starter toolkit as a bridge for existing workflows.

Where to go next, as linked from the README:

- 📖 [AgentCore Documentation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html) — the official developer guide
- 🧪 [Samples repository](https://github.com/awslabs/amazon-bedrock-agentcore-samples) — working examples to learn from
- 🐍 [Runtime Python SDK](https://github.com/aws/bedrock-agentcore-sdk-python) and [Boto3 Python SDK](https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/bedrock-agentcore-control.html)
- ⌨️ [AgentCore CLI](https://github.com/aws/agentcore-cli) and its [docs](https://github.com/aws/agentcore-cli/tree/main/docs)
- 💬 [Discord community](https://discord.gg/strands)

The starter toolkit itself is Apache 2.0 licensed, with contribution and security-reporting guidelines in the repository.

## 6. Kết luận

Amazon Bedrock AgentCore đảm nhận những phần mà không ai thích trong việc phát triển agent — hạ tầng, bảo mật, danh tính, "đường ống" bộ nhớ, giám sát — và biến chúng thành các dịch vụ được quản lý, có thể ghép nối linh hoạt, để bạn giữ nguyên logic agent đúng như bạn đã viết. Điểm cần nhớ nhất cho người mới: hãy bắt đầu với **AgentCore CLI** (`npm install -g @aws/agentcore`), và xem starter toolkit Python như cầu nối cho các quy trình hiện có.

Các bước tiếp theo, theo liên kết từ README:

- 📖 [Tài liệu AgentCore](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html) — hướng dẫn chính thức cho lập trình viên
- 🧪 [Kho samples](https://github.com/awslabs/amazon-bedrock-agentcore-samples) — các ví dụ hoạt động thực tế để học theo
- 🐍 [Runtime Python SDK](https://github.com/aws/bedrock-agentcore-sdk-python) và [Boto3 Python SDK](https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/bedrock-agentcore-control.html)
- ⌨️ [AgentCore CLI](https://github.com/aws/agentcore-cli) và [tài liệu của nó](https://github.com/aws/agentcore-cli/tree/main/docs)
- 💬 [Cộng đồng Discord](https://discord.gg/strands)

Bản thân starter toolkit sử dụng giấy phép Apache 2.0, với hướng dẫn đóng góp và báo cáo bảo mật ngay trong repository.
