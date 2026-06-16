# AI Transaction Categorization for SmartPocket

> **Status: PLANNED / DESIGN — not yet implemented.** This document describes the intended design for
> AI-assisted categorization. No categorization feature exists in the codebase today.
>
> **Stack reality:** The app is **Expo / React Native** (not Flutter), and the LLM is called
> **server-side** against a **self-hosted / local LLM** over an OpenAI-compatible `/v1/chat/completions`
> API, configured via env (`LLM_BASE_URL`, optional `LLM_API_KEY`, `LLM_MODEL`) — not a third-party
> gateway and not a client-side OpenAI key. *(Provider decision 2026-06-17: this supersedes the earlier
> Manus Forge / `gemini-2.5-flash` plan; the legacy Forge client `server/_core/llm.ts` is unused and being
> retired, and a new env-driven OpenAI-compatible client under `server/ai/` will replace it.)* The "API key
> on device / offline-first" framing below is from the original Flutter concept and does **not** apply to
> the current architecture. See [`ARCHITECTURE.md`](./ARCHITECTURE.md) §8.

## Overview

The goal is intelligent transaction categorization: given a transaction description (and optionally
amount and history), suggest the most likely category with a confidence score. The model is invoked on
the server against a self-hosted / local LLM (OpenAI-compatible endpoint); the client shows suggestions in
the add-transaction flow. A keyword-based heuristic serves as the fallback path (also used when the local
LLM is unavailable).

## Features

### 🤖 **AI-Powered Categorization**
- Uses a server-side self-hosted / local LLM (OpenAI-compatible, model from env) for transaction analysis
- Contextual understanding of transaction descriptions
- Confidence scoring for suggestions
- Historical pattern consideration

### 🔒 **Privacy-First Design**
- LLM host/key/model held in server env, not on the device
- Data only sent to the self-hosted / local LLM when the user explicitly enables AI features — never to a third-party API
- Offline fallback with keyword matching
- User control over AI features

### 📱 **User Experience**

- Real-time suggestions as you type
- Beautiful suggestion cards with confidence indicators
- One-click apply or dismiss options
- Seamless integration with existing UI

## Setup (intended)

### 1. Server configuration
The LLM connection is configured via server-side env vars:
- `LLM_BASE_URL` — base URL of the self-hosted / local OpenAI-compatible endpoint (e.g. `http://localhost:11434/v1`)
- `LLM_API_KEY` — optional; many local servers (Ollama, LM Studio) need none
- `LLM_MODEL` — model name served by the local endpoint (e.g. `llama3.1`, `qwen2.5`)

No per-user API key and no on-device key entry. The model is selected via `LLM_MODEL` (not hardcoded).

### 2. Feature exposure (to build)
Add a categorization tRPC procedure that calls the self-hosted LLM client (a new env-driven
OpenAI-compatible client under `server/ai/`, not the legacy Forge `invokeLLM`) with the transaction
description, and surface suggestions in the add-transaction screen. Gate the call behind an explicit user
opt-in before any transaction text is sent to the LLM.

### 3. Using AI Suggestions (intended UX)

1. Add a new transaction
2. Type in the description (e.g., "Coffee at Starbucks")
3. An AI suggestion appears (debounced)
4. Tap "Apply" to accept or "Dismiss" to ignore
5. Continue with the transaction as normal

## Technical Implementation

### Architecture

```
┌─────────────────────────────────────┐
│   Add-transaction screen (client)   │
└─────────────────┬───────────────────┘
                  │ tRPC
┌─────────────────▼───────────────────┐
│  categorize procedure (server)      │
│  - Strategy selection               │
│  - Opt-in / privacy gate            │
└─────────────────┬───────────────────┘
                  │
     ┌────────────▼─────────────┐
     │                          │
┌────▼─────┐            ┌──────▼──────────────┐
│Heuristic │            │ Self-hosted / local │
│Strategy  │            │ LLM strategy        │
│(Fallback)│            │ (OpenAI-compatible) │
└──────────┘            └─────────────────────┘
```

### Key Components

#### LLM call (new self-hosted client under `server/ai/`)
- Handles communication with the self-hosted / local LLM (OpenAI-compatible API); base URL/key/model from env
- Structured JSON response parsing (via `response_format`/JSON-schema, with a plain-text JSON fallback for local models that don't support it)
- Error handling and fallback to the heuristic strategy (incl. when the local LLM is unreachable)
- Rate limiting / debounce consideration

#### Categorization procedure (to build, in `server/routers.ts`)

- Strategy selection (heuristic vs. LLM)
- Opt-in / privacy gate before sending any data
- Optional historical transaction context
- Confidence scoring

#### LLM categorization strategy

- Prompt engineering for the categorization task
- Response validation
- Category mapping to available options

### API Usage

Calls go through the self-hosted LLM client (OpenAI-compatible payload `POST {LLM_BASE_URL}/chat/completions`).
The model is the env-configured `LLM_MODEL`. Use `response_format`/JSON-schema to force a structured JSON
result where the local model supports it; otherwise parse the text response defensively.

**Sample request (conceptual):**

```json
{
  "model": "<LLM_MODEL>",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful financial categorization assistant."
    },
    {
      "role": "user",
      "content": "Categorize this expense transaction: Description: 'Coffee at Starbucks'..."
    }
  ],
  "response_format": { "type": "json_object" }
}
```

**Sample Response**:

```json
{
  "category": "Food & Dining",
  "confidence": 0.85,
  "reason": "Coffee purchase at restaurant"
}
```

## Privacy & Security

### Data Handling
- LLM host/key/model held in server env vars (not on the device)
- Transaction data sent to the self-hosted / local LLM only after the user opts in to AI features
- Minimal data sent (description, and optionally amount — no user identifiers)
- No transaction data is sent anywhere unless AI features are explicitly enabled

### User Controls

- **AI Features Toggle**: Enable/disable all AI functionality (opt-in)
- **Consent gate**: no transaction data leaves the server for the LLM unless AI features are enabled (and it only ever goes to the self-hosted endpoint)
- **Heuristic fallback**: always-available keyword-based categorization when AI is off

### Compliance

- GDPR compliant (user consent required)
- Data minimization principles
- Right to deletion (simply disable features)
- Transparent data usage

## Cost Considerations

A self-hosted / local model has **no per-call API billing** — cost is the compute/infra to run it.
Categorization prompts are small (~100 tokens), so they are cheap to serve. Optimize compute/latency by:

- keeping prompts compact and forcing structured JSON output
- debouncing requests while the user types
- falling back to the free keyword heuristic when possible

### Optimization

- Efficient prompts minimize token usage
- Fallback to free heuristics when possible
- User control over when AI is used
- Caching common categorizations

## Testing

### Unit Tests
- Mock the self-hosted LLM client responses

- Strategy pattern testing
- Error handling validation
- Privacy controls verification

### Integration Tests

- End-to-end categorization flow
- Settings integration
- Network failure scenarios
- Performance testing

## Future Enhancements

### Planned Features

- **Learning from Corrections**: Improve suggestions based on user feedback
- **Multiple Model Support**: swap the local model via `LLM_MODEL`, or point `LLM_BASE_URL` at a different OpenAI-compatible backend
- **Batch Processing**: Categorize multiple transactions
- **Custom Training**: Fine-tune on user's transaction history

### Performance Improvements

- **Response Caching**: Cache common categorizations
- **Debounced Requests**: Reduce API calls while typing
- **Streaming Responses**: Real-time suggestion updates

## Troubleshooting

### Common Issues

**Connection / Auth Invalid**
- Verify `LLM_BASE_URL` (and `LLM_API_KEY` if your endpoint requires one) are set in the server env
- Check the local LLM server is running and the `LLM_MODEL` is loaded
- Rotate the key if your endpoint uses one

**Network Errors**
- Verify the API server can reach the `LLM_BASE_URL` endpoint
- Check the local LLM server / process status

**No Suggestions Appearing**

- Ensure AI features are enabled (opt-in)
- Check privacy settings
- Verify transaction description length

**Slow Response Times**
- Monitor the local LLM server load / latency

- Check network latency
- Consider heuristic fallback usage

### Support

- Check app logs for error details
- Verify settings configuration
- Test API key independently
- Contact support with specific error messages

## Conclusion

Once built, AI categorization would give SmartPocket users intelligent, contextual transaction
categorization while keeping control over their data: inference runs server-side on a self-hosted / local
LLM, only on explicit opt-in, with a keyword heuristic as the always-available fallback. This document is a
design/spec — the feature is not yet implemented (see the status banner at the top).
