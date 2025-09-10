# Claude Desktop + MCP Server Integration Flowchart

This flowchart shows how to use the Fantasy Football AI system through Claude Desktop with the MCP (Model Context Protocol) server integration.

## Overview Flow

```mermaid
graph TB
    Start([User Wants Fantasy Analysis]) --> Setup{MCP Server Setup?}
    
    Setup -->|No| Install[Install Claude Desktop + Configure MCP]
    Setup -->|Yes| Auth[Authenticate with ESPN]
    
    Install --> Config[Configure claude_desktop_config.json]
    Config --> StartMCP[Start MCP Server]
    StartMCP --> Auth
    
    Auth --> Login{Login Method}
    Login -->|Automatic| AutoLogin[MCP Tool: espn_authenticate]
    Login -->|Manual| ManualLogin[MCP Tool: espn_manual_auth]
    
    AutoLogin --> Verify[MCP Tool: espn_verify_auth]
    ManualLogin --> Verify
    
    Verify --> Success{Auth Success?}
    Success -->|No| Login
    Success -->|Yes| Analysis[Request Fantasy Analysis]
    
    Analysis --> Tools[Claude Uses MCP Tools]
    Tools --> Results[Get Analysis Results]
    Results --> Action[Take Fantasy Actions]
    
    Action --> Continue{Continue Analysis?}
    Continue -->|Yes| Analysis
    Continue -->|No| End([Session Complete])

    style Start fill:#e1f5fe
    style End fill:#c8e6c9
    style Setup fill:#fff3e0
    style Success fill:#fff3e0
    style Tools fill:#f3e5f5
```

## Detailed Component Flow

```mermaid
graph TB
    subgraph "Local Machine"
        CD[Claude Desktop App]
        MCP[MCP Server<br/>fantasy-poc/mcp-server]
        ESP[ESPN Auth Service]
    end
    
    subgraph "External Services"
        ESPNAPI[ESPN Fantasy API]
        FPROS[FantasyPros API]
        CLAUDE[Claude AI Model]
    end
    
    subgraph "MCP Tools Available"
        T1[espn_authenticate]
        T2[espn_manual_auth] 
        T3[espn_verify_auth]
        T4[espn_get_roster]
        T5[espn_get_league_info]
        T6[espn_get_players]
        T7[espn_get_matchups]
        T8[lineup_optimizer]
        T9[waiver_analyzer]
        T10[trade_analyzer]
    end
    
    CD <-->|MCP Protocol| MCP
    MCP <--> ESP
    ESP <-->|HTTP Requests| ESPNAPI
    MCP <-->|Expert Rankings| FPROS
    CD <-->|Chat Interface| CLAUDE
    
    MCP --> T1
    MCP --> T2
    MCP --> T3
    MCP --> T4
    MCP --> T5
    MCP --> T6
    MCP --> T7
    MCP --> T8
    MCP --> T9
    MCP --> T10

    style CD fill:#e3f2fd
    style MCP fill:#f3e5f5
    style ESP fill:#fff3e0
    style ESPNAPI fill:#e8f5e8
    style FPROS fill:#e8f5e8
    style CLAUDE fill:#fce4ec
```

## Setup Process Flowchart

```mermaid
graph TB
    User([User]) --> Download[Download Claude Desktop]
    Download --> Install[Install Claude Desktop]
    Install --> Clone[Clone Fantasy Repo]
    
    Clone --> NavMCP[Navigate to mcp-server/]
    NavMCP --> InstallDeps[npm install]
    InstallDeps --> Build[npm run build]
    Build --> Config[Configure claude_desktop_config.json]
    
    Config --> Example{Use Example Config?}
    Example -->|Yes| CopyConfig[Copy provided config]
    Example -->|No| CustomConfig[Create custom config]
    
    CopyConfig --> StartMCP[npm start]
    CustomConfig --> StartMCP
    
    StartMCP --> OpenClaude[Open Claude Desktop]
    OpenClaude --> Test[Test: Ask about available tools]
    
    Test --> Success{Tools Available?}
    Success -->|No| Debug[Check MCP server logs]
    Success -->|Yes| Ready[Ready for Fantasy Analysis!]
    
    Debug --> FixIssue[Fix configuration issues]
    FixIssue --> StartMCP
    
    style User fill:#e1f5fe
    style Ready fill:#c8e6c9
    style Success fill:#fff3e0
    style Example fill:#fff3e0
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant CD as Claude Desktop
    participant MCP as MCP Server
    participant ESPN as ESPN API
    participant PP as Puppeteer
    
    U->>CD: "Help me analyze my fantasy team"
    CD->>MCP: espn_verify_auth()
    MCP->>MCP: Check cached auth
    
    alt No Valid Auth
        MCP->>CD: Authentication required
        CD->>U: Please authenticate with ESPN
        
        alt Automatic Login
            U->>CD: Provide username/password
            CD->>MCP: espn_authenticate(username, password)
            MCP->>PP: Launch browser automation
            PP->>ESPN: Automated login
            ESPN->>PP: Return cookies
            PP->>MCP: espn_s2, SWID cookies
        else Manual Login
            U->>CD: I'll provide cookies manually
            CD->>MCP: espn_manual_auth()
            MCP->>CD: Cookie extraction instructions
            U->>CD: Provide cookies from browser
            CD->>MCP: espn_manual_auth(cookies)
        end
        
        MCP->>ESPN: Test auth with cookies
        ESPN->>MCP: Auth validation response
        MCP->>MCP: Cache valid cookies
    end
    
    MCP->>CD: Authentication successful
    CD->>U: Ready to analyze your fantasy team!
```

## Fantasy Analysis Workflow

```mermaid
graph TB
    Start([User Request]) --> Parse[Claude Parses Request]
    Parse --> Determine{Analysis Type}
    
    Determine -->|Roster Analysis| Roster[espn_get_roster]
    Determine -->|League Overview| League[espn_get_league_info]
    Determine -->|Player Research| Players[espn_get_players]
    Determine -->|Matchup Analysis| Matchups[espn_get_matchups]
    Determine -->|Lineup Optimization| Lineup[lineup_optimizer]
    Determine -->|Waiver Research| Waiver[waiver_analyzer]
    Determine -->|Trade Analysis| Trade[trade_analyzer]
    
    Roster --> Process[Process ESPN Data]
    League --> Process
    Players --> Process
    Matchups --> Process
    Lineup --> EnhancedProcess[Enhanced Analysis]
    Waiver --> EnhancedProcess
    Trade --> EnhancedProcess
    
    Process --> Format[Format for Display]
    EnhancedProcess --> Expert[Integrate FantasyPros]
    Expert --> Advanced[Advanced Recommendations]
    Advanced --> Format
    
    Format --> Present[Present to User]
    Present --> Action{User Action?}
    
    Action -->|More Analysis| Determine
    Action -->|Different Team| NewAuth[Switch Authentication]
    Action -->|Complete| End([Analysis Complete])
    
    NewAuth --> Parse

    style Start fill:#e1f5fe
    style End fill:#c8e6c9
    style Determine fill:#fff3e0
    style Action fill:#fff3e0
    style EnhancedProcess fill:#f3e5f5
    style Advanced fill:#f3e5f5
```

## Tool Usage Examples

```mermaid
graph LR
    subgraph "Basic ESPN Data"
        R[espn_get_roster<br/>→ Your team players]
        L[espn_get_league_info<br/>→ League settings]
        P[espn_get_players<br/>→ All available players]
        M[espn_get_matchups<br/>→ Weekly matchups]
    end
    
    subgraph "Advanced Analysis"
        LO[lineup_optimizer<br/>→ Optimal starting lineup]
        WA[waiver_analyzer<br/>→ Best waiver targets]
        TA[trade_analyzer<br/>→ Trade recommendations]
    end
    
    subgraph "Authentication"
        AU[espn_authenticate<br/>→ Auto login]
        MA[espn_manual_auth<br/>→ Cookie login]
        VE[espn_verify_auth<br/>→ Check auth status]
    end
    
    R --> LO
    P --> WA
    R --> TA
    L --> LO
    M --> TA
    
    AU --> R
    MA --> R
    VE --> R

    style R fill:#e8f5e8
    style L fill:#e8f5e8
    style P fill:#e8f5e8
    style M fill:#e8f5e8
    style LO fill:#f3e5f5
    style WA fill:#f3e5f5
    style TA fill:#f3e5f5
    style AU fill:#fff3e0
    style MA fill:#fff3e0
    style VE fill:#fff3e0
```

## Error Handling Flow

```mermaid
graph TB
    Error([Error Occurs]) --> Type{Error Type}
    
    Type -->|Auth Failed| AuthError[Authentication Error]
    Type -->|ESPN API Error| APIError[ESPN API Error]
    Type -->|MCP Error| MCPError[MCP Protocol Error]
    Type -->|Tool Error| ToolError[Tool Execution Error]
    
    AuthError --> ClearAuth[Clear cached credentials]
    ClearAuth --> RetryAuth[Retry authentication]
    RetryAuth --> Success{Auth Success?}
    Success -->|No| Manual[Try manual auth]
    Success -->|Yes| Continue[Continue analysis]
    Manual --> Continue
    
    APIError --> CheckStatus[Check ESPN service status]
    CheckStatus --> Retry[Retry with backoff]
    Retry --> APISuccess{API Success?}
    APISuccess -->|No| Fallback[Use cached data if available]
    APISuccess -->|Yes| Continue
    Fallback --> Continue
    
    MCPError --> RestartMCP[Restart MCP server]
    RestartMCP --> MCPSuccess{MCP Online?}
    MCPSuccess -->|No| CheckConfig[Check configuration]
    MCPSuccess -->|Yes| Continue
    CheckConfig --> RestartMCP
    
    ToolError --> ValidateInput[Validate tool inputs]
    ValidateInput --> RetryTool[Retry tool execution]
    RetryTool --> ToolSuccess{Tool Success?}
    ToolSuccess -->|No| Graceful[Graceful degradation]
    ToolSuccess -->|Yes| Continue
    Graceful --> Continue
    
    Continue --> Report[Report to User]

    style Error fill:#ffebee
    style Success fill:#fff3e0
    style APISuccess fill:#fff3e0
    style MCPSuccess fill:#fff3e0
    style ToolSuccess fill:#fff3e0
    style Continue fill:#c8e6c9
```

## Sample User Conversation Flow

```mermaid
sequenceDiagram
    participant U as User
    participant CD as Claude Desktop
    participant MCP as MCP Server
    
    U->>CD: "Show me my fantasy football roster"
    CD->>MCP: espn_verify_auth()
    
    alt First Time User
        MCP->>CD: No authentication found
        CD->>U: I need to authenticate with your ESPN account first
        U->>CD: "Use automatic login with my credentials"
        CD->>MCP: espn_authenticate(username, password)
        MCP->>CD: Authentication successful
    end
    
    CD->>MCP: espn_get_roster(leagueId, teamId)
    MCP->>CD: Roster data with 15 players
    CD->>U: Here's your current roster:<br/>• QB: Josh Allen (28.5 pts)<br/>• RB: CMC (35.2 pts), Saquon (22.1 pts)<br/>• WR: Cooper Kupp (18.7 pts)...
    
    U->>CD: "Who should I start this week?"
    CD->>MCP: lineup_optimizer(roster, matchups)
    MCP->>CD: Optimized lineup with reasoning
    CD->>U: Based on matchups and projections:<br/>START: Josh Allen vs weak pass defense<br/>SIT: Bench RB vs strong run defense<br/>FLEX: Start your WR3 in favorable matchup
    
    U->>CD: "Any good waiver wire pickups?"
    CD->>MCP: waiver_analyzer(available_players)
    MCP->>CD: Top waiver targets with analysis
    CD->>U: Top waiver targets:<br/>1. Backup RB (handcuff value)<br/>2. Emerging WR (target share trending up)<br/>3. Streaming defense (favorable matchup)
```

## Configuration Files

### claude_desktop_config.json Example
```json
{
  "mcpServers": {
    "fantasy-football": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/FantasyCoManager/fantasy-poc/mcp-server"
    }
  }
}
```

### Environment Variables
```bash
# Optional - for enhanced features
FANTASYPROS_API_KEY=your_key_here
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
```

## Troubleshooting Decision Tree

```mermaid
graph TB
    Issue([Issue Occurred]) --> Category{Issue Category}
    
    Category -->|Setup| SetupIssue[MCP server not starting]
    Category -->|Auth| AuthIssue[ESPN authentication failing]
    Category -->|Tools| ToolIssue[Tools not available in Claude]
    Category -->|Data| DataIssue[No data returned]
    
    SetupIssue --> CheckNode[Check Node.js version ≥16]
    CheckNode --> CheckBuild[Run npm run build]
    CheckBuild --> CheckConfig[Verify claude_desktop_config.json]
    CheckConfig --> Restart[Restart Claude Desktop]
    
    AuthIssue --> CheckCookies[Verify ESPN cookies are fresh]
    CheckCookies --> TryManual[Try manual authentication]
    TryManual --> ClearCache[Clear authentication cache]
    
    ToolIssue --> CheckMCP[Verify MCP server is running]
    CheckMCP --> CheckLogs[Check MCP server logs]
    CheckLogs --> ConfigPath[Verify config file path]
    
    DataIssue --> CheckIDs[Verify League/Team IDs]
    CheckIDs --> CheckSeason[Verify current season (2025)]
    CheckSeason --> TestAPI[Test ESPN API directly]
    
    Restart --> Resolved{Resolved?}
    ClearCache --> Resolved
    ConfigPath --> Resolved
    TestAPI --> Resolved
    
    Resolved -->|No| Support[Check GitHub Issues]
    Resolved -->|Yes| Success[Ready to use!]

    style Issue fill:#ffebee
    style Resolved fill:#fff3e0
    style Success fill:#c8e6c9
```

---

## Key Benefits of MCP Integration

1. **Direct Integration**: No web interface needed - works directly in Claude Desktop
2. **Real-time Data**: Live ESPN data fetched on demand
3. **Context Preservation**: Claude remembers your league context across conversation
4. **Advanced Analysis**: Combines multiple data sources (ESPN + FantasyPros + AI)
5. **Secure Authentication**: Credentials stored locally, not in cloud
6. **Extensible**: Easy to add new fantasy analysis tools

## Getting Started

1. **Install Claude Desktop** from Anthropic
2. **Clone this repository** to your local machine
3. **Set up the MCP server** following the setup flowchart
4. **Configure Claude Desktop** with the MCP server
5. **Start analyzing your fantasy team** through natural conversation!

The MCP integration transforms Claude Desktop into a powerful fantasy football analysis tool with direct access to your ESPN data and advanced AI recommendations.