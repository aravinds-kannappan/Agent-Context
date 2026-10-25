# Agent Context

A beginner-friendly research guide and context-only experiment project.

**Live guide:** https://agent-context-field-guide.aravinds-kannappan.chatgpt.site

## Current status

- The research guide, reading shelf, interactive teaching example, original paper figure, and experiment protocol are complete.
- A tabbed guide and a separate local-Ollama experiment lab are under active development. This initial GitHub push includes the current work in progress; the lab interface and server are not complete yet.
- No model experiment has been run. The teaching illustration and deterministic test helpers are not evidence of LLM performance.
- The proposed experiment's uniqueness is not established. Closely related prior work is linked in the guide and protocol.

## Files

- `dist/index.html`, `dist/styles.css`, `dist/app.js`: research guide and reading shelf.
- `dist/tabs.js`: tab-navigation enhancement in progress.
- `dist/experiment-core.mjs`: seeded task generator, context policies, and deterministic grading helpers for the planned lab.
- `dist/experiment-protocol.txt`: full proposed experimental design.
- `dist/assets/lurch-context.svg`: original Figure 1 cropped from LURCH, credited in the guide.
- `extract_figure.py`: reproducible figure extraction; requires PyMuPDF and curl.
- `.openai/hosting.json`: deployment identity and static-output configuration; contains no credentials.

## Preview the guide

```sh
python3 -m http.server 4873 --bind 127.0.0.1 --directory dist
```

Open http://127.0.0.1:4873. Local Ollama execution instructions will be added when the lab is ready.

## Research scope

The experiment changes the material provided to the model for its current task: quantity, relevance, scope, arrangement, and completeness. Each trial starts fresh. Persistent memory and cross-session learning are outside the study.

The proposed **Context Switchboard** pairs two independent tasks using the same source packet. It compares full and limited context policies and diagnoses missing evidence, wrong-scope-compatible actions, and decision errors.

The first browser prototype uses an explicit **source-block budget**. That is not a token-matched study. The protocol describes the additional token controls and statistical evaluation required for confirmatory research.

## Sources and attribution

Sources include Google DeepMind's Gemini 1.5 report, Anthropic's context-engineering article, Lost in the Middle, RULER, LURCH, and related distraction benchmarks. See the reading shelf for source links and evidence qualifications. The reproduced research figure remains the work of its original authors; its inclusion does not imply endorsement or a license over the paper.

Do not commit API keys, local model files, or private trial data. Generated result exports belong in the ignored `results/` directory.
