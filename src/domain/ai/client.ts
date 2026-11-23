export interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>
  error?: { message?: string }
}

export class AnthropicApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message)
    this.name = 'AnthropicApiError'
  }
}

export async function sendAnthropicMessage(options: {
  apiKey: string
  model: string
  system: string
  messages: AnthropicMessage[]
  maxTokens?: number
  fetcher?: typeof fetch
}): Promise<string> {
  if (!options.apiKey.trim()) throw new AnthropicApiError('Add your Anthropic API key in Settings.')

  let response: Response
  try {
    response = await (options.fetcher ?? fetch)('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'x-api-key': options.apiKey,
      },
      body: JSON.stringify({
        model: options.model,
        max_tokens: options.maxTokens ?? 1200,
        system: options.system,
        messages: options.messages,
      }),
    })
  } catch {
    throw new AnthropicApiError('Could not reach Anthropic. Check your connection and try again.')
  }

  let payload: AnthropicResponse
  try {
    payload = await response.json() as AnthropicResponse
  } catch {
    throw new AnthropicApiError('Anthropic returned an unreadable response.', response.status)
  }

  if (!response.ok) {
    const message = response.status === 401
      ? 'Anthropic rejected the API key. Check it in Settings.'
      : response.status === 429
        ? 'Anthropic rate limit reached. Wait a moment and try again.'
        : payload.error?.message ?? `Anthropic request failed (${response.status}).`
    throw new AnthropicApiError(message, response.status)
  }

  const text = payload.content?.find((item) => item.type === 'text')?.text
  if (!text) throw new AnthropicApiError('Anthropic returned no text content.')
  return text
}

export async function testAnthropicKey(apiKey: string, model: string, fetcher?: typeof fetch): Promise<void> {
  await sendAnthropicMessage({
    apiKey,
    model,
    system: 'Reply with the single word OK.',
    messages: [{ role: 'user', content: 'Test API connection.' }],
    maxTokens: 10,
    fetcher,
  })
}
