# Agent Context

A beginner-friendly research guide and context-only experiment project.

**Live guide:** https://agent-context-field-guide.aravinds-kannappan.chatgpt.site

## Current status

- The research guide, reading shelf, interactive teaching example, original paper figure, and experiment protocol are complete.
- This checkpoint includes the tabbed guide, separate experiment lab, and local Ollama server. JavaScript checks and five automated tests pass; browser review and validation with a real Ollama model are still pending.
- No model experiment has been run. The teaching illustration and deterministic test helpers are not evidence of LLM performance.
- The proposed experiment's uniqueness is not established. Closely related prior work is linked in the guide and protocol.

## Files

- `dist/index.html`, `dist/styles.css`, `dist/app.js`: research guide and reading shelf.
- `dist/tabs.js`: tab navigation for the guide.
- `dist/lab.html`, `dist/lab.css`, `dist/lab.mjs`: standalone lab interface and trial runner.
- `server.mjs`: local static server and Ollama connection.
- `tests/`: deterministic experiment checks and mock-provider integration tests.
- `dist/experiment-core.mjs`: seeded task generator, context policies, and deterministic grading helpers for the planned lab.
- `dist/experiment-protocol.txt`: full proposed experimental design.
- `dist/assets/lurch-context.svg`: original Figure 1 cropped from LURCH, credited in the guide.
- `extract_figure.py`: reproducible figure extraction; requires PyMuPDF and curl.
- `.openai/hosting.json`: deployment identity and static-output configuration; contains no credentials.

## Run locally

Requires Node.js 22 or newer. No package installation is needed.

```sh
git clone https://github.com/aravinds-kannappan/Agent-Context.git
cd Agent-Context
npm start
```

This opens the experiment lab in your browser. The guide is at http://127.0.0.1:4873. For real model trials, run Ollama locally with an installed model, select **Local Ollama** in the lab, and refresh the model list. The default connection is http://127.0.0.1:11434; set `OLLAMA_URL` to override it.

The reference solver works without Ollama and demonstrates the mechanics only. Static hosting supports the reference solver; Ollama trials require the local server. Export trial data from the lab as JSON.

Run `npm run check` and `npm test` to verify the code. The integration test uses a mock provider, not an actual model.

## Research scope

The experiment changes the material provided to the model for its current task: quantity, relevance, scope, arrangement, and completeness. Each trial starts fresh. Persistent memory and cross-session learning are outside the study.

The proposed **Context Switchboard** pairs two independent tasks using the same source packet. It compares full and limited context policies and diagnoses missing evidence, wrong-scope-compatible actions, and decision errors.

The first browser prototype uses an explicit **source-block budget**. That is not a token-matched study. The protocol describes the additional token controls and statistical evaluation required for confirmatory research.

## Sources and attribution

Sources include Google DeepMind's Gemini 1.5 report, Anthropic's context-engineering article, Lost in the Middle, RULER, LURCH, and related distraction benchmarks. See the reading shelf for source links and evidence qualifications. The reproduced research figure remains the work of its original authors; its inclusion does not imply endorsement or a license over the paper.

Do not commit API keys, local model files, or private trial data. Generated result exports belong in the ignored `results/` directory.
