# Agent Context

A research notebook about what an agent needs in its current input. Includes a tabbed reading guide, a shelf of original sources, and a small context experiment.

## Try the experiment

Open `lab.html` on the deployed site. **Try a demo without installing anything** runs a deterministic solver in your browser. It explains the experiment; it does not measure a language model.

For real trials, choose **My Ollama model**, click **Connect Ollama**, select an installed model, and run the comparison. Start with one task pair: 12 trials across six policies.

### Connect Ollama from the hosted website

1. Install [Ollama](https://ollama.com/download), download a model that fits your computer, and leave Ollama running.
2. Open **Help me connect** in the lab. It generates the `OLLAMA_ORIGINS` command for the exact website address you are visiting. On macOS, paste that command in Terminal, then quit and reopen Ollama. On other systems, follow [Ollama's environment-variable instructions](https://docs.ollama.com/faq#how-do-i-configure-ollama-server).
3. Click **Connect Ollama**. Allow local-network access if your browser asks, then choose the model.

Your browser calls `http://127.0.0.1:11434` directly. Vercel serves the static website and never forwards prompts to your computer. Browser restrictions vary; if this connection is blocked, use the local app below. No wildcard origins or public model endpoint are required.

### Run the lab locally

Requires Node.js 22 or newer and a running Ollama installation. No npm dependencies are needed.

```sh
git clone https://github.com/aravinds-kannappan/Agent-Context.git
cd Agent-Context
npm start
```

Already cloned the repository? Run `git pull` first.

The lab opens at http://127.0.0.1:4873/lab.html. The guide is at http://127.0.0.1:4873. Keep the terminal open. In this mode, the Node server connects to Ollama, so no cross-origin permission is needed. Set `OLLAMA_URL` to override the default `http://127.0.0.1:11434`, or `PORT` to change the lab's port.

### Troubleshooting

- **No models listed:** download a model in Ollama and reconnect. `ollama list` shows installed models.
- **Browser cannot reach Ollama:** check that Ollama is running and `OLLAMA_ORIGINS` includes the website's exact origin. Restart Ollama after changing the variable. If your browser blocks loopback access, use `npm start`.
- **First answer is slow:** Ollama may be loading the model. The elapsed timer continues during this wait; each request has a two-minute timeout.
- **Run stopped or output limit reached:** inspect the trial details. Failures are retained rather than silently retried. An output cut off at the configured limit is not accepted as a valid answer.
- **Results disappeared:** this prototype does not save automatically. Use **Save results** to download JSON before closing the page.

## Deploy to Vercel

Import this GitHub repository into Vercel. `vercel.json` selects the static `dist` output, disables framework detection, and runs syntax checks. No environment variables, API keys, or serverless model functions are needed.

Or, from a signed-in Vercel CLI:

```sh
vercel --prod
```

The previous `.openai/hosting.json` is retained as historical hosting metadata. Vercel uses `vercel.json`; the previous host is not updated by this workflow.

## What the pilot measures

Two tasks share the same packet but target different teams. Each trial starts fresh. Six policies change which source blocks are included or how they are ordered: full, grouped, recent, lexical, scope-aware, and a privileged oracle diagnostic.

The export contains configuration, exact prompts, outputs, scores, elapsed time, reported token counts, model digest when available, requested model settings, completion reason, and connection mode. The context cap is measured in **source blocks**, not tokens. Reported token counts do not make the experiment token-matched.

This is a single-decision synthetic pilot, not an end-to-end agent benchmark. The full proposed protocol adds token controls, paired statistical analysis, and transfer tasks. Novelty is not established. Persistent memory and cross-session learning are outside the study.

## Verification

```sh
npm run check
npm test
```

Eight automated tests cover task generation, input selection, grading, local-server behavior, browser-to-Ollama request construction, provenance, and errors. Browser QA also covers tabs, keyboard navigation, source filters, demo/export, mocked hosted model calls, cancellation, truncation, and mobile overflow.

Provider tests use fixtures. No real Ollama model trial has been verified in the development environment.

## Main files

- `dist/index.html`, `dist/styles.css`, `dist/app.js`, `dist/tabs.js`: guide and reading shelf.
- `dist/lab.html`, `dist/lab.css`, `dist/lab.mjs`: standalone lab and run controls.
- `dist/ollama-client.mjs`: browser/local-server connection adapter.
- `dist/experiment-core.mjs`: seeded tasks, context policies, reference solver, and grader.
- `server.mjs`: optional localhost server and Ollama proxy.
- `dist/experiment-protocol.txt`: proposed experimental design.
- `dist/assets/lurch-context.svg`: original Figure 1 cropped from LURCH and credited in the guide.
- `extract_figure.py`: figure extraction using PyMuPDF and curl.

## Sources and attribution

The reading shelf links Google DeepMind's Gemini 1.5 report, Anthropic's context-engineering article, Lost in the Middle, RULER, LURCH, and related distraction benchmarks. It distinguishes research evidence from engineering advice and identifies review limitations. The reproduced figure remains the work of its original authors; inclusion does not imply endorsement or a license over the paper.

Keep credentials and private trial data out of Git. Generated exports belong in the ignored `results/` directory.
