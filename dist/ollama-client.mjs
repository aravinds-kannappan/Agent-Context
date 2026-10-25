// Hosted pages contact loopback in the user's browser, never through Vercel.
export const OLLAMA_OPTIONS = Object.freeze({temperature: 0, num_predict: 512, num_ctx: 8192});
export function createOllamaClient({local = false, fetchImpl = globalThis.fetch} = {}) {
  const base = 'http://127.0.0.1:11434';
  let models = [];
  async function read(response) {
    let data;
    try { data = await response.json(); } catch { throw new Error('The connection returned a web page instead of model data. Open the lab using npm start, or connect Ollama from the hosted site.'); }
    if (!response.ok || data.error) throw new Error(data.error || `Ollama returned HTTP ${response.status}.`);
    return data;
  }
  return {
    transport: local ? 'local-server' : 'browser-to-ollama',
    async listModels() {
      let data;
      try { data = await read(await fetchImpl(local ? '/api/config' : `${base}/api/tags`, {signal: AbortSignal.timeout(5000)})); }
      catch(error) {
        if (error instanceof TypeError || error.name === 'TimeoutError') throw new Error(local
          ? 'The local lab server is unreachable. Keep npm start running, then reconnect.'
          : 'Your browser could not reach Ollama. Check that it is running, allow this site in OLLAMA_ORIGINS, and allow local-network access if your browser asks. The local lab is an alternative below.');
        throw error;
      }
      models = data.models || [];
      if (local && !data.ready && !models.length) throw new Error(data.message || 'Start Ollama and install a model, then reconnect.');
      return models;
    },
    async trial(model, messages, signal) {
      const combined = signal ? AbortSignal.any([signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000);
      let data;
      try {
        data = await read(await fetchImpl(local ? '/api/trial' : `${base}/api/chat`, {
          method: 'POST', headers: {'Content-Type': 'application/json'}, signal: combined,
          body: JSON.stringify(local ? {model, messages} : {model, messages, stream: false, format: 'json', options: OLLAMA_OPTIONS})
        }));
      } catch(error) {
        if (signal?.aborted) throw error;
        if (error.name === 'TimeoutError') throw new Error('Ollama did not finish within two minutes. Try a smaller installed model or fewer simultaneous applications.');
        if (error instanceof TypeError) throw new Error('The Ollama connection was interrupted. Reconnect before starting another run.');
        throw error;
      }
      if (local) return data;
      if (typeof data.message?.content !== 'string') throw new Error('Ollama returned no answer text.');
      return {
        output: data.message.content, model: data.model,
        modelDigest: models.find(item => item.name === model)?.digest ?? null,
        usage: {input_tokens: data.prompt_eval_count ?? null, output_tokens: data.eval_count ?? null},
        doneReason: data.done_reason ?? null, settings: {...OLLAMA_OPTIONS}
      };
    }
  };
}
