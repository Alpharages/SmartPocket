# Natural Language Financial Insights (Story I2)

> **Status: PLANNED / DESIGN — not yet implemented.** This document describes a proposed feature and is
> written in places as though it shipped; it has **not**. There is currently no chat screen, no
> natural-language query service, and no voice input in the codebase.
>
> **Stack note:** The app is **Expo / React Native (TypeScript)**, not Flutter. The Dart code samples
> below are illustrative of the original concept only; an actual implementation would use a tRPC
> procedure calling `invokeLLM(...)` (`server/_core/llm.ts`, model `gemini-2.5-flash`) on the server and
> a React Native chat UI on the client. Data analysis would reuse the existing `summary` router
> aggregations. See [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Overview

The proposed Natural Language Query system would let users ask questions about their financial data in
plain English and receive intelligent, contextual answers, combining AI-powered intent parsing, data
analysis, and a chat interface.

## Features

### 🗣️ **Natural Language Processing**
- Ask questions in plain English (e.g., "What did I spend last month?")
- Support for voice input via speech-to-text
- Intelligent intent recognition and query parsing
- Context-aware response generation

### 🧠 **Smart Query Understanding**
- Expense and income analysis
- Category-specific breakdowns
- Time-based queries (today, this week, last month, etc.)
- Top spending analysis
- Balance calculations
- Budget status inquiries

### 💬 **Chat Interface**
- Beautiful, WhatsApp-style chat UI
- Real-time responses with confidence indicators
- Interactive insights with drill-down capabilities
- Quick question suggestions
- Conversation history

### 🎤 **Voice Integration**
- Speech-to-text for hands-free queries
- Voice activation with visual feedback
- Error handling for speech recognition

### 📊 **Rich Insights**
- Detailed financial breakdowns
- Trend analysis with visual indicators
- Actionable recommendations
- Confidence scoring for answers

## Query Types Supported

### **Expense Queries**
- "What did I spend last month?"
- "How much on food this week?"
- "Show me my restaurant expenses"

### **Income Analysis**
- "How much income this year?"
- "What did I earn last month?"

### **Top Spending**
- "Top 5 expenses this month"
- "My biggest spending categories"
- "Where do I spend the most?"

### **Balance Calculations**
- "What's my balance this month?"
- "Income vs expenses"
- "Am I saving money?"

### **Budget Status**
- "My budget status"
- "How am I doing with my budget?"

### **Time-based Queries**
- Today, this week, this month, last month
- This year, last year
- Custom date ranges

## Technical Implementation

### Architecture Overview

```
┌─────────────────────────────────────┐
│           Chat Interface            │
│      (InsightsChatScreen)          │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│   NaturalLanguageQueryService      │
│   - Intent parsing                 │
│   - Data gathering                 │
│   - Insight generation             │
└─────────────────┬───────────────────┘
                  │
     ┌────────────▼─────────────┐
     │                          │
┌────▼─────┐            ┌──────▼──────┐
│Heuristic │            │ Forge LLM   │
│Analysis  │            │ Analysis    │
│(Offline) │            │ (Online)    │
└──────────┘            └─────────────┘
```

### Core Components

#### **NaturalLanguageQueryService**
The main orchestrator that:
- Parses user queries into structured intents
- Gathers relevant transaction data
- Generates insights using AI or heuristics
- Formats responses with actions and confidence scores

```dart
class NaturalLanguageQueryService {
  Future<QueryResult> processQuery({
    required String question,
    required String userId,
  });
  
  QueryIntent parseIntentWithHeuristics(String question);
  Map<String, DateTime> getDateRange(String timeframe);
  String createTransactionSummary(List<Transaction> transactions);
}
```

#### **QueryResult Model**
Structured response containing:
- **Answer**: Direct response to the user's question
- **Summary**: Brief overview of findings
- **Insights**: Detailed breakdowns with values and trends
- **Actions**: Interactive buttons for drill-down navigation
- **Confidence**: AI confidence score (0.0 - 1.0)

#### **Intent Recognition**
- **Heuristic Parsing**: Keyword-based analysis for offline use
- **AI Parsing**: LLM-powered intent extraction (Forge gateway) for complex queries
- **Fallback Strategy**: Graceful degradation from AI to heuristics

#### **Data Analysis**
- **Transaction Aggregation**: Grouping by category, time, type
- **Trend Calculation**: Period-over-period comparisons
- **Balance Computation**: Income vs expense analysis
- **Pattern Recognition**: Historical spending behavior

### Query Processing Flow

1. **Input Processing**
   - Voice-to-text conversion (if applicable)
   - Intent parsing (heuristic or AI)
   - Parameter extraction

2. **Data Gathering**
   - Date range calculation
   - Transaction filtering
   - Category mapping
   - Historical context building

3. **Analysis & Insights**
   - Statistical calculations
   - Trend analysis
   - Comparison generation
   - Confidence assessment

4. **Response Generation**
   - Natural language response creation
   - Action button generation
   - Insight formatting
   - Error handling

## Privacy & Security

### **Privacy-First Design**
- Heuristic analysis is the default; the LLM gateway is used only when AI features are explicitly enabled
- No persistent storage of queries or responses
- User controls over AI features (opt-in)

### **Data Minimization**
- Only relevant transaction data sent to AI
- No personal identifiers in AI requests
- Anonymized transaction summaries
- Minimal data retention

### **User Controls**
- AI features toggle in privacy settings
- Network features control
- API key management
- Offline-only mode available

## User Experience

### **Chat Interface Features**
- **Welcome Message**: Friendly introduction with example queries
- **Quick Questions**: Preset common queries for easy access
- **Real-time Responses**: Immediate feedback with loading indicators
- **Rich Formatting**: Insights displayed as cards with trends
- **Action Buttons**: One-click navigation to detailed views

### **Voice Interaction**
- **Speech Recognition**: High-quality voice input
- **Visual Feedback**: Microphone status indicators
- **Error Handling**: Clear feedback for recognition issues
- **Accessibility**: Full voice navigation support

### **Response Quality**
- **Contextual Answers**: Responses tailored to user's data
- **Confidence Indicators**: Visual cues for answer reliability
- **Trend Analysis**: Up/down/stable indicators with colors
- **Actionable Insights**: Clear next steps and recommendations

## Example Interactions

### **Simple Expense Query**
```
User: "What did I spend last month?"
Assistant: "You spent $1,247.83 in last month."

Insights:
• Total Expenses: $1,247.83 (↑ from previous month)
• Food & Dining: $385.50 (31%)
• Transportation: $203.20 (16%)

Actions: [View Transactions] [Export Data]
```

### **Category Analysis**
```
User: "How much on restaurants?"
Assistant: "You spent $285.40 on Food & Dining in this month."

Insights:
• Food & Dining: $285.40 (23% of total expenses)
• Restaurant visits: 12 transactions
• Average per meal: $23.78

Actions: [View Food Transactions] [Set Budget]
```

### **Top Spending Analysis**
```
User: "Top 5 expenses this week"
Assistant: "Your top spending category this week was Food & Dining with $156.78."

Insights:
• #1 Food & Dining: $156.78
• #2 Transportation: $89.50
• #3 Shopping: $67.25
• #4 Entertainment: $45.00
• #5 Utilities: $32.50

Actions: [View All Categories] [Create Budget]
```

## Testing Strategy

### **Unit Tests**
- Intent parsing accuracy
- Date range calculations
- Data aggregation logic
- Response formatting
- Error handling scenarios

### **Integration Tests**
- End-to-end query processing
- AI service integration
- Voice input handling
- UI state management

### **User Experience Tests**
- Query response time
- Answer accuracy
- Voice recognition quality
- Interface usability

## Performance Considerations

### **Response Time**
- Heuristic queries: < 100ms
- AI-powered queries: < 2 seconds
- Large dataset handling: Optimized aggregation
- Background processing: Non-blocking UI

### **Scalability**
- Efficient data querying
- Caching for common patterns
- Debounced voice input
- Lazy loading of insights

## Future Enhancements

### **Planned Features**
- **Multi-turn Conversations**: Context-aware follow-up questions
- **Learning from Feedback**: Improving accuracy over time
- **Custom Query Templates**: User-defined frequent questions
- **Advanced Analytics**: Forecasting and budgeting insights

### **Technical Improvements**
- **Local AI Models**: On-device processing for privacy
- **Query Caching**: Faster responses for repeated questions
- **Real-time Data**: Live transaction updates in conversations
- **Multi-language Support**: International user base

## Troubleshooting

### **Common Issues**

**Voice Recognition Not Working**
- Check microphone permissions
- Ensure quiet environment
- Verify speech-to-text service availability
- Try typing the query instead

**Low Confidence Responses**
- Rephrase question more specifically
- Include time frame in query
- Check if sufficient transaction data exists
- Verify AI features are enabled

**Slow Response Times**
- Check that the server can reach the Forge gateway
- Verify Forge gateway status
- Fall back to heuristic responses for speed
- Reduce query complexity

**No Insights Available**
- Ensure transaction data exists for the time period
- Check privacy settings allow AI features
- Verify categories are properly assigned
- Try broader time ranges

## API Integration

> The snippets below are **illustrative of the original Flutter concept** only. An actual
> implementation would be TypeScript: a tRPC procedure on the server calling `invokeLLM(...)`
> (`server/_core/llm.ts`), consumed by a React Native chat screen via a tRPC/TanStack Query hook.

### Query processing (intended shape — TypeScript)
```ts
// server: a tRPC procedure
nlQuery: protectedProcedure
  .input(z.object({ question: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // gather data via existing summary aggregations, then:
    const res = await invokeLLM({ messages: [...], responseFormat: { type: "json_object" } });
    return parseQueryResult(res); // { answer, summary, insights[], actions[], confidence }
  });
```

### Response handling (client)
```tsx
const { mutateAsync } = trpc.insights.nlQuery.useMutation();
const result = await mutateAsync({ question: "What did I spend on food?" });
result.insights.forEach(renderInsight);
result.actions.forEach(registerAction);
```

## Conclusion

Once built, the Natural Language Financial Insights feature would transform SmartPocket from a basic
expense tracker into an intelligent financial assistant, letting users gain insights through
conversational interactions backed by the server-side LLM gateway and the existing summary aggregations.

This document defines the scope for **Epic I: AI - Story I2**. It is a design/specification — the
feature is not yet implemented (see the status banner at the top).
