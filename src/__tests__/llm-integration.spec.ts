/**
 * @jest-environment node
 *
 * LLM Integration Test — verifies the actual fetch path used by the extension.
 * Run: pnpm --filter @job-hunter/extension exec jest src/__tests__/llm-integration.spec.ts --forceExit --verbose
 */
describe('LLM API Integration', () => {
  it('Ollama /v1/chat/completions works without auth', async () => {
    if (process.env['RUN_OLLAMA_INTEGRATION'] !== '1') {
      console.warn('Ollama integration disabled — set RUN_OLLAMA_INTEGRATION=1 to run');
      return;
    }

    const url = 'http://localhost:11434/v1';
    const model = 'qwen2.5-coder:7b';

    // Skip if Ollama is not running (CI environments)
    let healthOk = false;
    try {
      const h = await fetch(`${url}/models`, { signal: AbortSignal.timeout(2000) });
      healthOk = h.ok;
    } catch {
      /* unreachable */
    }
    if (!healthOk) {
      console.warn('⚠ Ollama not reachable — skipping integration test');
      return;
    }

    const resp = await fetch(`${url}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Reply with ONLY: {"ok":true}' }],
        temperature: 0.4,
        max_tokens: 100,
      }),
      signal: AbortSignal.timeout(4000),
    });

    console.warn(`Ollama status: ${resp.status}`);
    const json = (await resp.json()) as Record<string, unknown>;
    const content = (json['choices'] as Array<{ message: { content: string } }>)?.[0]?.message?.content ?? '';
    console.warn(`Ollama response: ${content}`);
    console.warn(`Tokens: ${JSON.stringify(json['usage'])}`);

    expect(resp.ok).toBe(true);
    expect(content).toContain('ok');
  });

  it('Fake DeepSeek key returns 401/403', async () => {
    const url = 'https://api.deepseek.com';

    const resp = await fetch(`${url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer sk-this-is-fake-key',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'Reply: {"ok":true}' }],
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 100,
      }),
      signal: AbortSignal.timeout(4000),
    });

    const body = await resp.text().catch(() => 'No body');
    console.warn(`Fake key returned: ${resp.status}`);
    console.warn(`Response body: ${body.slice(0, 300)}`);

    expect(resp.ok).toBe(false);
    expect([401, 403]).toContain(resp.status);
  });

  it('Real DeepSeek API — use env LLM_API_KEY', async () => {
    // This test requires LLM_API_KEY to be set in the environment
    // The extension would read it from chrome.storage.local
    const apiKey = process.env['LLM_API_KEY'];
    if (!apiKey) {
      console.warn('⚠ LLM_API_KEY not set — skipping real DeepSeek test');
      return;
    }

    const url = 'https://api.deepseek.com';

    const resp = await fetch(`${url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'Reply with ONLY valid JSON: {"ok":true}' }],
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 100,
      }),
      signal: AbortSignal.timeout(4000),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => 'No body');
      console.error(`❌ DeepSeek ${resp.status}: ${body.slice(0, 500)}`);
      throw new Error(`DeepSeek API error ${resp.status}`);
    }

    const json = (await resp.json()) as Record<string, unknown>;
    const content = (json['choices'] as Array<{ message: { content: string } }>)?.[0]?.message?.content ?? '';
    console.warn(`DeepSeek: ${content}`);
    console.warn(`Tokens: ${JSON.stringify(json['usage'])}`);

    expect(resp.ok).toBe(true);
    expect(content).toContain('ok');
  });
});
