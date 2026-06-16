# AI Transaction Categorization for SmartPocket

> **Status: PLANNED / DESIGN — not yet implemented.** This document describes the intended design for
> AI-assisted categorization. No categorization feature exists in the codebase today.
>
> **Stack reality:** The app is **Expo / React Native** (not Flutter), and the LLM is called
> **server-side** through the Manus **Forge** gateway (`server/_core/llm.ts`, OpenAI-compatible
> `/v1/chat/completions`), currently configured for model **`gemini-2.5-flash`** — not a client-side
> OpenAI key. The "API key on device / offline-first" framing below is from the original Flutter concept
> and does **not** apply to the current architecture. See [`ARCHITECTURE.md`](./ARCHITECTURE.md) §8.

## Overview

The goal is intelligent transaction categorization: given a transaction description (and optionally
amount and history), suggest the most likely category with a confidence score. The model is invoked on
the server via the Manus Forge gateway; the client shows suggestions in the add-transaction flow. A
keyword-based heuristic serves as the offline/fallback path.

## Features

### 🤖 **AI-Powered Categorization**

- Uses the server-side LLM gateway (model `gemini-2.5-flash` via Manus Forge) for transaction analysis
- Contextual understanding of transaction descriptions
- Confidence scoring for suggestions
- Historical pattern consideration

### 🔒 **Privacy-First Design**

- API key held in server env, not on the device
- Data only sent to the LLM gateway when the user explicitly enables AI features
- Offline fallback with keyword matching
- User control over AI features

### 📱 **User Experience**

- Real-time suggestions as you type
- Beautiful suggestion cards with confidence indicators
- One-click apply or dismiss options
- Seamless integration with existing UI

## Setup (intended)

### 1. Server configuration

The LLM gateway credentials are server-side env vars (already used by `server/_core/llm.ts`):

- `BUILT_IN_FORGE_API_URL` — Forge base URL (defaults to `https://forge.manus.im`)
- `BUILT_IN_FORGE_API_KEY` — Forge API key

No per-user API key and no on-device key entry. The model is selected in `server/_core/llm.ts`
(currently `gemini-2.5-flash`).

### 2. Feature exposure (to build)

Add a categorization tRPC procedure that calls `invokeLLM(...)` with the transaction description, and
surface suggestions in the add-transaction screen. Gate the call behind an explicit user opt-in before
any transaction text is sent to the gateway.

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
┌────▼─────┐            ┌──────▼──────────┐
│Heuristic │            │ Forge LLM       │
│Strategy  │            │ Strategy        │
│(Offline) │            │ (gemini-2.5-    │
│          │            │  flash, online) │
└──────────┘            └─────────────────┘
```

### Key Components

#### LLM gateway call (`invokeLLM` in `server/_core/llm.ts`)

- Handles communication with the Forge gateway (OpenAI-compatible API)
- Structured JSON response parsing (via `responseFormat`/`outputSchema`)
- Error handling and fallback to the heuristic strategy
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

Calls go through `invokeLLM(...)` in `server/_core/llm.ts` (OpenAI-compatible payload sent to the Forge
gateway). The configured model is **`gemini-2.5-flash`**. Use `responseFormat`/`outputSchema` to force a
structured JSON result rather than parsing free text.

**Sample request (conceptual):**

```json
{
  "model": "gemini-2.5-flash",
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

- LLM gateway API key held in server env vars (not on the device)
- Transaction data sent to the gateway only after the user opts in to AI features
- Minimal data sent (description, and optionally amount — no user identifiers)
- No transaction data is sent anywhere unless AI features are explicitly enabled

### User Controls

- **AI Features Toggle**: Enable/disable all AI functionality (opt-in)
- **Consent gate**: no transaction data leaves the server for the LLM gateway unless AI features are enabled
- **Heuristic fallback**: always-available keyword-based categorization when AI is off

### Compliance

- GDPR compliant (user consent required)
- Data minimization principles
- Right to deletion (simply disable features)
- Transparent data usage

## Cost Considerations

Usage is billed through the Manus Forge gateway according to the selected model
(`gemini-2.5-flash`). Categorization prompts are small (~100 tokens), so per-transaction cost is
negligible. Optimize by:

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

- Mock LLM gateway responses
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
- **Multiple Model Support**: GPT-4, Claude, local models
- **Batch Processing**: Categorize multiple transactions
- **Custom Training**: Fine-tune on user's transaction history

### Performance Improvements

- **Response Caching**: Cache common categorizations
- **Debounced Requests**: Reduce API calls while typing
- **Streaming Responses**: Real-time suggestion updates

## Troubleshooting

### Common Issues

**API Key / Auth Invalid**

- Verify `BUILT_IN_FORGE_API_KEY` / `BUILT_IN_FORGE_API_URL` are set in the server env
- Check the Forge gateway account/quota status
- Rotate the key if necessary

**Network Errors**

- Verify the server can reach the Forge gateway endpoint
- Review Forge gateway service status

**No Suggestions Appearing**

- Ensure AI features are enabled (opt-in)
- Check privacy settings
- Verify transaction description length

**Slow Response Times**

- Monitor Forge gateway status
- Check network latency
- Consider heuristic fallback usage

### Support

- Check app logs for error details
- Verify settings configuration
- Test API key independently
- Contact support with specific error messages

## Conclusion

Once built, AI categorization would give SmartPocket users intelligent, contextual transaction
categorization while keeping control over their data: inference runs server-side through the Forge
gateway, only on explicit opt-in, with a keyword heuristic as the always-available fallback. This
document is a design/spec — the feature is not yet implemented (see the status banner at the top).
