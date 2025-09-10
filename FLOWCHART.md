# ESPN Fantasy Football AI - Complete System Flow

## Overview
This document illustrates the complete flow from GitHub Actions triggers through LLM processing to Discord notifications for the ESPN Fantasy Football AI Manager.

## High-Level Architecture Flow

```mermaid
graph TB
    Start([GitHub Actions Trigger]) --> Trigger{Trigger Type}
    
    Trigger -->|Schedule| Cron[Cron Schedule<br/>Daily/Game Day/Weekly]
    Trigger -->|Manual| Manual[Workflow Dispatch<br/>User Initiated]
    
    Cron --> Preflight
    Manual --> Preflight
    
    Preflight[Preflight Intelligence Check<br/>fantasy-phase4-intelligence.yml] --> ValidateEnv{Environment<br/>Valid?}
    
    ValidateEnv -->|No| FailureNotif[Send Failure<br/>Notification]
    ValidateEnv -->|Yes| DetermineMode[Determine Intelligence Mode]
    
    DetermineMode --> Mode{Intelligence<br/>Mode}
    
    Mode -->|full| FullAnalysis[Full Analysis Mode]
    Mode -->|realtime| RealtimeMode[Real-time Monitoring]
    Mode -->|analytics| AnalyticsMode[Analytics Dashboard]
    Mode -->|learning| LearningMode[Adaptive Learning]
    Mode -->|emergency| EmergencyMode[Emergency Protocol]
    
    FullAnalysis --> ExecuteCLI
    RealtimeMode --> ExecuteCLI
    AnalyticsMode --> ExecuteCLI
    LearningMode --> ExecuteCLI
    EmergencyMode --> ExecuteCLI
    
    ExecuteCLI[Execute CLI Command<br/>cli.js intelligence] --> DataFetch
    
    DataFetch[Fetch Data Sources] --> ESPNData
    DataFetch --> FantasyPros
    DataFetch --> Weather
    
    ESPNData[ESPN API<br/>League/Roster/Players] --> DataProcess
    FantasyPros[FantasyPros Rankings<br/>Expert Consensus] --> DataProcess
    Weather[Weather API<br/>Game Conditions] --> DataProcess
    
    DataProcess[Process & Combine Data] --> LLMRouter
    
    LLMRouter[LLM Router<br/>Provider Selection] --> LLMProvider{Select<br/>Provider}
    
    LLMProvider -->|Primary| Gemini[Google Gemini<br/>2.0 Flash]
    LLMProvider -->|Fallback| Claude[Claude API<br/>3.5 Sonnet]
    LLMProvider -->|Alternative| OpenAI[OpenAI GPT-4]
    
    Gemini --> LLMProcess
    Claude --> LLMProcess
    OpenAI --> LLMProcess
    
    LLMProcess[LLM Processing<br/>Generate Analysis] --> GenerateResults
    
    GenerateResults[Generate Results JSON<br/>phase4_results.json] --> StoreResults
    
    StoreResults[Store Results<br/>GitHub Artifacts] --> NotifPrep
    
    NotifPrep[Prepare Notifications<br/>intelligent-notifications] --> ExtractInsights
    
    ExtractInsights[Extract Key Insights<br/>Parse LLM Response] --> FormatDiscord
    
    FormatDiscord[Format Discord Message<br/>Handle 4096 char limit] --> CheckLength{Message<br/>Length?}
    
    CheckLength -->|Under 4096| SingleMessage[Send Single<br/>Discord Embed]
    CheckLength -->|Over 4096| ChunkMessage[Chunk into<br/>Multiple Messages]
    
    SingleMessage --> Discord[Discord Webhook<br/>Send Notification]
    ChunkMessage --> Discord
    
    Discord --> Success([Success:<br/>User Receives<br/>AI Recommendations])
    FailureNotif --> Failure([Failure:<br/>Issue Created<br/>in GitHub])
```

## Detailed Component Flows

### 1. GitHub Actions Trigger Flow

```mermaid
graph LR
    Schedule[Scheduled Triggers] --> Times{Time Check}
    Times -->|8 AM ET Daily| DailyRun[Full Analysis]
    Times -->|Every 2hr Game Day| GameDay[Real-time Monitor]
    Times -->|Tuesday 10 AM| Waivers[Waiver Analysis]
    Times -->|Pre-game Sun/Mon/Thu| PreGame[Pre-game Check]
    
    Manual[Manual Trigger] --> Options{User Options}
    Options --> ModeSelect[Select Mode:<br/>full/realtime/analytics]
    Options --> WeekSelect[Select Week:<br/>1-18]
    Options --> ForceRun[Force Execution:<br/>true/false]
```

### 2. Data Collection Flow

```mermaid
graph TB
    Start[CLI Execution] --> Init[Initialize Environment]
    
    Init --> LoadSecrets[Load GitHub Secrets]
    LoadSecrets --> ESPN[ESPN Authentication]
    
    ESPN --> Cookies{Cookie Type}
    Cookies -->|ESPN_S2| ValidateCookie1[Validate ESPN_S2]
    Cookies -->|SWID| ValidateCookie2[Validate SWID]
    
    ValidateCookie1 --> FetchESPN
    ValidateCookie2 --> FetchESPN
    
    FetchESPN[Fetch ESPN Data] --> League[League Info]
    FetchESPN --> Roster[Team Roster]
    FetchESPN --> Players[Player Stats]
    FetchESPN --> Matchups[Weekly Matchups]
    
    League --> Combine
    Roster --> Combine
    Players --> Combine
    Matchups --> Combine
    
    Combine[Combine All Data] --> EnrichData{Enable<br/>FantasyPros?}
    
    EnrichData -->|Yes| FPAuth[FantasyPros Auth]
    EnrichData -->|No| PreparePrompt
    
    FPAuth --> FPRankings[Expert Rankings]
    FPRankings --> PreparePrompt[Prepare LLM Prompt]
```

### 3. LLM Processing Flow

```mermaid
graph TB
    Input[Combined Data Input] --> BuildPrompt[Build Analysis Prompt]
    
    BuildPrompt --> Template{Mode Template}
    Template -->|Full| FullTemplate[Comprehensive Analysis<br/>Start/Sit, Waivers, Trades]
    Template -->|Realtime| RTTemplate[Injury Updates<br/>Last-minute Changes]
    Template -->|Analytics| AnalyticsTemplate[Performance Metrics<br/>Trend Analysis]
    
    FullTemplate --> SelectLLM
    RTTemplate --> SelectLLM
    AnalyticsTemplate --> SelectLLM
    
    SelectLLM[Select LLM Provider] --> CheckPrimary{Primary<br/>Available?}
    
    CheckPrimary -->|Yes| UsePrimary[Use Primary LLM]
    CheckPrimary -->|No| CheckFallback{Fallback<br/>Available?}
    
    CheckFallback -->|Yes| UseFallback[Use Fallback LLM]
    CheckFallback -->|No| Error[Throw Error]
    
    UsePrimary --> CallAPI[API Call with Prompt]
    UseFallback --> CallAPI
    
    CallAPI --> ParseResponse[Parse LLM Response]
    ParseResponse --> ExtractSections[Extract Sections:<br/>Insights, Actions, Grade]
    
    ExtractSections --> ValidateOutput{Valid<br/>Response?}
    ValidateOutput -->|Yes| FormatJSON[Format as JSON]
    ValidateOutput -->|No| Retry{Retry<br/>Available?}
    
    Retry -->|Yes| CallAPI
    Retry -->|No| Error
    
    FormatJSON --> Output[Return Analysis Results]
```

### 4. Discord Notification Flow

```mermaid
graph TB
    Results[phase4_results.json] --> Parse[Parse JSON Results]
    
    Parse --> Extract{Extract Content}
    Extract --> LLMResponse[Full LLM Response]
    Extract --> KeyInsights[Key Insights]
    Extract --> UrgentActions[Urgent Actions]
    Extract --> Grade[Performance Grade]
    Extract --> DataStatus[Data Verification Status]
    
    LLMResponse --> CheckSize{Response Size?}
    
    CheckSize -->|< 3900 chars| SingleEmbed[Create Single Embed]
    CheckSize -->|> 3900 chars| ChunkLogic[Chunk into Parts]
    
    SingleEmbed --> BuildEmbed[Build Discord Embed]
    ChunkLogic --> MultiEmbed[Create Multiple Embeds]
    
    BuildEmbed --> AddFields[Add Fields:<br/>Mode, Week, Grade]
    MultiEmbed --> HeaderMsg[Send Header Message]
    MultiEmbed --> ChunkMsgs[Send Content Chunks]
    
    AddFields --> SetColor{Status Color}
    SetColor -->|Success| Green[Green: 3066993]
    SetColor -->|Failure| Red[Red: 15158332]
    SetColor -->|Partial| Yellow[Yellow: 16776960]
    
    Green --> SendWebhook
    Red --> SendWebhook
    Yellow --> SendWebhook
    
    HeaderMsg --> SendWebhook
    ChunkMsgs --> SendWebhook
    
    SendWebhook[POST to Discord Webhook] --> Delivered[Message Delivered]
```

### 5. Error Handling Flow

```mermaid
graph TB
    Error[Error Detected] --> Type{Error Type}
    
    Type -->|ESPN Auth| AuthError[Authentication Failed]
    Type -->|LLM Failure| LLMError[LLM Provider Error]
    Type -->|Data Fetch| DataError[Data Fetch Failed]
    Type -->|Cost Limit| CostError[Cost Limit Exceeded]
    
    AuthError --> LogError[Log Error Details]
    LLMError --> LogError
    DataError --> LogError
    CostError --> LogError
    
    LogError --> CreateJSON[Create Error JSON]
    CreateJSON --> NotifyError[Send Error Notification]
    
    NotifyError --> Discord[Discord Alert]
    NotifyError --> GitHubIssue[Create GitHub Issue]
    
    Discord --> UserNotified[User Notified]
    GitHubIssue --> IssueCreated[Issue #XXX Created]
```

## Data Structures

### Input Configuration (GitHub Secrets)
```yaml
ESPN_S2: "long_cookie_string..."
ESPN_SWID: "{uuid-format-string}"
LEAGUE_1_ID: "12345678"
LEAGUE_1_TEAM_ID: "3"
GEMINI_API_KEY: "AIza..."
DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/..."
```

### LLM Prompt Structure
```javascript
{
  mode: "full",
  week: 5,
  leagueData: {
    teams: [...],
    roster: [...],
    matchups: [...]
  },
  expertRankings: [...],
  instructions: "Analyze and provide recommendations..."
}
```

### Output Structure (phase4_results.json)
```javascript
{
  summary: [{
    league: "Main League",
    fullLLMResponse: "Complete analysis text...",
    insights: {
      key_insights: ["insight1", "insight2"],
      urgent_actions: ["action1"],
      performance_grade: "A"
    }
  }],
  data_verification: {
    espn_authenticated: true,
    llm_provider: "gemini",
    llm_model: "gemini-2.0-flash-exp"
  }
}
```

### Discord Message Structure
```javascript
{
  embeds: [{
    title: "🧠 Phase 4 Advanced Intelligence - ✅ SUCCESS",
    description: "Full LLM analysis text...",
    color: 3066993,
    fields: [
      {name: "🎯 Intelligence Mode", value: "full", inline: true},
      {name: "📅 NFL Week", value: "5", inline: true},
      {name: "🏆 Performance Grade", value: "A", inline: true}
    ],
    footer: {text: "Fantasy AI Phase 4 • Nov 15, 2024"},
    timestamp: "2024-11-15T12:00:00Z"
  }]
}
```

## Key Integration Points

1. **GitHub Actions → Node.js CLI**: Workflow executes `cli.js` with mode parameters
2. **CLI → ESPN API**: Authenticated requests using cookies from secrets
3. **CLI → LLM Provider**: Structured prompts sent via API (Gemini/Claude/OpenAI)
4. **LLM → Results JSON**: Parsed response saved to `phase4_results.json`
5. **Results → Discord**: Formatted embed messages sent via webhook

## Cost Management

The system implements multi-level cost controls:
- **Daily Limit**: $2.00 default
- **Weekly Limit**: $10.00 default  
- **Monthly Limit**: $35.00 default

When limits are exceeded, the system falls back to cheaper models or skips non-critical analysis.

## Performance Metrics

Typical execution times:
- **Preflight Check**: ~30 seconds
- **Data Collection**: 20-40 seconds
- **LLM Processing**: 15-30 seconds
- **Notification Sending**: 2-5 seconds
- **Total Workflow**: 2-3 minutes

## Security Considerations

1. **Secrets Management**: All sensitive data stored in GitHub Secrets
2. **Cookie Rotation**: ESPN cookies expire ~30 days, require manual update
3. **API Key Protection**: Keys never exposed in logs or artifacts
4. **Webhook Security**: Discord webhooks are write-only, can't read messages
5. **Error Sanitization**: Error messages sanitized before public display