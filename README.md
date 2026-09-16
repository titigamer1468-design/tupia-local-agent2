# Tupia Workspace 🧩 (Multi-Provider AI Studio)

A production-ready, constraint-driven AI environment engineered to orchestrate multi-provider LLMs, manage secure state transitions, and execute browser-based heavy media rendering pipelines. 

**Note on Resourcefulness:** This entire codebase, architecture, and deployment pipeline was fully engineered, debugged, and version-controlled strictly utilizing mobile-based workflows (from a smartphone) under zero-budget constraints.

## 🧠 Key Architectural Features

- **Secure Edge Gateway:** Utilizes Cloudflare Workers (`wrangler.json`) as a secure proxy to decouple client-side interactions from high-tier API orchestrations (OpenAI, Claude, DeepSeek, Gemini, Alibaba, Nvidia), preventing key exposure.
- **AST-Based Code Sandboxing:** Incorporates Tree-sitter WebAssembly parsing (`TreeSitterManager.js`) to map structural code skeletons entirely within the client environment.
- **Fuzzy Patching Logic:** Implements resilient code injection routines (`DiffManager.js`) utilizing structural `SEARCH / REPLACE` blocks with adaptive fuzzy matching thresholds to safely modify targets without regression.
- **Client-Side WASM Rendering Pipeline:** Integrates local FFmpeg WebAssembly bindings (`VideoEngine.js`) inside an optimized React application, allowing complex multimedia layouts and automated dynamic video generation directly inside the user's browser runtime.

## 🛠️ Stack

- **Frontend:** React 19, Vite, Tailwind CSS.
- **Serverless/Backend:** Cloudflare Workers.
- **Engines:** FFmpeg.wasm, Web Tree-Sitter, Diff-Match-Patch.
