import { Code2 } from 'lucide-react';

const MCP_BASE = 'https://mcp-hgv-comp-hub-7474648704018320.aws.databricksapps.com';
const MCP_URL = `${MCP_BASE}/mcp`;

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4
      style={{
        fontSize: 13,
        fontWeight: 800,
        color: 'var(--foreground)',
        borderBottom: '1px solid var(--border)',
        paddingBottom: '0.5rem',
        marginTop: '0.25rem',
      }}
    >
      {children}
    </h4>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre
      style={{
        fontSize: 10,
        lineHeight: 1.55,
        padding: '0.875rem 1rem',
        borderRadius: 8,
        background: 'var(--muted)',
        border: '1px solid var(--border)',
        overflowX: 'auto',
        color: 'var(--foreground)',
        margin: 0,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      }}
    >
      {children}
    </pre>
  );
}

function LangBlock({ title, children }: { title: string; children: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}>{title}</div>
      <CodeBlock>{children}</CodeBlock>
    </div>
  );
}

export function McpClientWiringSection() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Code2 size={16} color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 11.5, color: 'var(--foreground-muted)', lineHeight: 1.65 }}>
          Copy-paste starters below wire authentication, list tools, and call <code>ask_comp_agent</code> or{' '}
          <code>get_marketing_workspace</code>. Replace <code>AGENT_API_KEY</code> with your app secret when calling from
          outside Databricks. Inside a Databricks notebook, use <code>WorkspaceClient</code> OAuth instead of an API key.
          MCP endpoint: <code>{MCP_URL}</code>
        </div>
      </div>

      <SectionHeading>Environment variables (external jobs)</SectionHeading>
      <CodeBlock>{`# Required
export HGV_MCP_URL="${MCP_URL}"
export AGENT_API_KEY="<app-secret-from-databricks-apps>"

# Optional — used by REST shortcut examples
export HGV_COMP_BASE_URL="${MCP_BASE}"`}</CodeBlock>

      <SectionHeading>Python — Databricks notebook (OAuth, recommended)</SectionHeading>
      <LangBlock title="pip install databricks-mcp databricks-sdk · full MCP tool loop">
        {`from databricks_mcp import DatabricksMCPClient
from databricks.sdk import WorkspaceClient

MCP_URL = "${MCP_URL}"

w = WorkspaceClient()  # uses notebook / CLI OAuth automatically
client = DatabricksMCPClient(server_url=MCP_URL, workspace_client=w)

# 1) Discover tools
tools = client.list_tools()
print([t.name for t in tools])

# 2) Natural-language comp Q&A (same agent as the web UI)
answer = client.call_tool(
    "ask_comp_agent",
    {
        "question": "What is QTD earnings and next tier gap for this rep?",
        "rep_id": "PERSONA-MKT-REP",
        "period_id": "2026-Q2",
        "channel": "marketing",
    },
)
print(answer)

# 3) Structured warehouse payload (no LLM) — marketing workspace KPIs
workspace = client.call_tool(
    "get_marketing_workspace",
    {"rep_id": "PERSONA-MKT-REP", "period_id": "2026-Q2"},
)
print(workspace)

# 4) Entity search for @mention-style references
hits = client.call_tool("search_comp_entities", {"query": "Brooks"})
print(hits)`}
      </LangBlock>

      <SectionHeading>Python — external script (API key + MCP SDK)</SectionHeading>
      <LangBlock title="pip install mcp httpx · Streamable HTTP transport">
        {`import asyncio
import os
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

MCP_URL = os.environ["HGV_MCP_URL"]
API_KEY = os.environ["AGENT_API_KEY"]

async def main() -> None:
    headers = {"X-Agent-Api-Key": API_KEY}

    async with streamablehttp_client(MCP_URL, headers=headers) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()

            tools = await session.list_tools()
            print("tools:", [t.name for t in tools.tools])

            result = await session.call_tool(
                "get_comp_metadata",
                arguments={},
            )
            print(result.content)

            answer = await session.call_tool(
                "ask_comp_agent",
                arguments={
                    "question": "Summarize qualified tour pay for PERSONA-MKT-REP in 2026-Q2",
                    "rep_id": "PERSONA-MKT-REP",
                    "period_id": "2026-Q2",
                    "channel": "marketing",
                },
            )
            print(answer.content)

asyncio.run(main())`}
      </LangBlock>

      <SectionHeading>TypeScript / Node.js</SectionHeading>
      <LangBlock title="npm install @modelcontextprotocol/sdk · Streamable HTTP">
        {`import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_URL = process.env.HGV_MCP_URL ?? "${MCP_URL}";
const API_KEY = process.env.AGENT_API_KEY!;

const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
  fetch: (url, init) =>
    fetch(url, {
      ...init,
      headers: {
        ...(init?.headers as Record<string, string>),
        "X-Agent-Api-Key": API_KEY,
      },
    }),
});

const client = new Client({ name: "hgv-orchestrator", version: "1.0.0" });
await client.connect(transport);

const { tools } = await client.listTools();
console.log("tools:", tools.map((t) => t.name));

const metadata = await client.callTool({ name: "get_comp_metadata", arguments: {} });
console.log(metadata.content);

const answer = await client.callTool({
  name: "ask_comp_agent",
  arguments: {
    question: "What is T. Brooks QTD earnings and next tier gap?",
    rep_id: "PERSONA-MKT-REP",
    period_id: "2026-Q2",
    channel: "marketing",
  },
});
console.log(answer.content);`}
      </LangBlock>

      <SectionHeading>C# (.NET 8+)</SectionHeading>
      <LangBlock title="dotnet add package ModelContextProtocol --prerelease">
        {`using System.Net.Http.Headers;
using ModelContextProtocol.Client;
using ModelContextProtocol.Client.Transports;

const string mcpUrl = Environment.GetEnvironmentVariable("HGV_MCP_URL")
    ?? "${MCP_URL}";
const string apiKey = Environment.GetEnvironmentVariable("AGENT_API_KEY")
    ?? throw new InvalidOperationException("Set AGENT_API_KEY");

var httpClient = new HttpClient();
httpClient.DefaultRequestHeaders.Add("X-Agent-Api-Key", apiKey);

var transport = new HttpClientTransport(
    new HttpClientTransportOptions
    {
        Endpoint = new Uri(mcpUrl),
        Name = "hgv-orchestrator",
        Version = "1.0.0",
    },
    httpClient,
    ownsHttpClient: false);

await using var mcp = await McpClientFactory.CreateAsync(transport);

var tools = await mcp.ListToolsAsync();
Console.WriteLine(string.Join(", ", tools.Select(t => t.Name)));

var metadata = await mcp.CallToolAsync(
    "get_comp_metadata",
    new Dictionary<string, object?>());
Console.WriteLine(metadata);

var answer = await mcp.CallToolAsync(
    "ask_comp_agent",
    new Dictionary<string, object?>
    {
        ["question"] = "What is QTD earnings for PERSONA-MKT-REP?",
        ["rep_id"] = "PERSONA-MKT-REP",
        ["period_id"] = "2026-Q2",
        ["channel"] = "marketing",
    });
Console.WriteLine(answer);`}
      </LangBlock>

      <SectionHeading>Java (21+)</SectionHeading>
      <LangBlock title="Maven: com.fasterxml.jackson.core:jackson-databind · JSON-RPC over HttpClient">
        {`import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

public class HgvMcpClient {
  private static final String MCP_URL = System.getenv().getOrDefault(
      "HGV_MCP_URL", "${MCP_URL}");
  private static final String API_KEY = System.getenv("AGENT_API_KEY");
  private static final ObjectMapper JSON = new ObjectMapper();
  private static final AtomicInteger ID = new AtomicInteger(1);

  public static void main(String[] args) throws Exception {
    var client = HttpClient.newHttpClient();

    var init = rpc("initialize", Map.of(
        "protocolVersion", "2024-11-05",
        "capabilities", Map.of(),
        "clientInfo", Map.of("name", "hgv-java", "version", "1.0.0")));
  post(client, init);

    var tools = post(client, rpc("tools/list", Map.of()));
    System.out.println(tools.body());

    var workspace = post(client, rpc("tools/call", Map.of(
        "name", "get_marketing_workspace",
        "arguments", Map.of(
            "rep_id", "PERSONA-MKT-REP",
            "period_id", "2026-Q2"))));
    System.out.println(workspace.body());

    var answer = post(client, rpc("tools/call", Map.of(
        "name", "ask_comp_agent",
        "arguments", Map.of(
            "question", "Summarize qualified tour pay for PERSONA-MKT-REP",
            "rep_id", "PERSONA-MKT-REP",
            "period_id", "2026-Q2",
            "channel", "marketing"))));
    System.out.println(answer.body());
  }

  static String rpc(String method, Map<String, Object> params) throws Exception {
    var node = JSON.createObjectNode();
    node.put("jsonrpc", "2.0");
    node.put("id", ID.getAndIncrement());
    node.put("method", method);
    node.set("params", JSON.valueToTree(params));
    return JSON.writeValueAsString(node);
  }

  static HttpResponse<String> post(HttpClient client, String body) throws Exception {
    var req = HttpRequest.newBuilder(URI.create(MCP_URL))
        .header("Content-Type", "application/json")
        .header("Accept", "application/json, text/event-stream")
        .header("X-Agent-Api-Key", API_KEY)
        .POST(HttpRequest.BodyPublishers.ofString(body))
        .build();
    return client.send(req, HttpResponse.BodyHandlers.ofString());
  }
}`}
      </LangBlock>

      <SectionHeading>Go</SectionHeading>
      <LangBlock title="go mod init hgv-mcp-client · net/http JSON-RPC">
        {`package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

const defaultMCP = "${MCP_URL}"

type rpcRequest struct {
	JSONRPC string      \`json:"jsonrpc"\`
	ID      int         \`json:"id"\`
	Method  string      \`json:"method"\`
	Params  interface{} \`json:"params"\`
}

func postRPC(client *http.Client, url, apiKey string, id int, method string, params interface{}) ([]byte, error) {
	body, _ := json.Marshal(rpcRequest{JSONRPC: "2.0", ID: id, Method: method, Params: params})
	req, _ := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")
	req.Header.Set("X-Agent-Api-Key", apiKey)
	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	return io.ReadAll(res.Body)
}

func main() {
	mcpURL := os.Getenv("HGV_MCP_URL")
	if mcpURL == "" {
		mcpURL = defaultMCP
	}
	apiKey := os.Getenv("AGENT_API_KEY")
	client := &http.Client{}

	_, _ = postRPC(client, mcpURL, apiKey, 1, "initialize", map[string]interface{}{
		"protocolVersion": "2024-11-05",
		"capabilities":    map[string]interface{}{},
		"clientInfo":        map[string]interface{}{"name": "hgv-go", "version": "1.0.0"},
	})

	tools, _ := postRPC(client, mcpURL, apiKey, 2, "tools/list", map[string]interface{}{})
	fmt.Println("tools/list:", string(tools))

	workspace, _ := postRPC(client, mcpURL, apiKey, 3, "tools/call", map[string]interface{}{
		"name": "get_marketing_workspace",
		"arguments": map[string]string{
			"rep_id": "PERSONA-MKT-REP", "period_id": "2026-Q2",
		},
	})
	fmt.Println("workspace:", string(workspace))

	answer, _ := postRPC(client, mcpURL, apiKey, 4, "tools/call", map[string]interface{}{
		"name": "ask_comp_agent",
		"arguments": map[string]string{
			"question":  "What is QTD earnings for PERSONA-MKT-REP?",
			"rep_id":    "PERSONA-MKT-REP",
			"period_id": "2026-Q2",
			"channel":   "marketing",
		},
	})
	fmt.Println("answer:", string(answer))
}`}
      </LangBlock>

      <SectionHeading>PowerShell</SectionHeading>
      <LangBlock title="REST invoke shortcut — no MCP SDK required">
        {`$BaseUrl = $env:HGV_COMP_BASE_URL
if (-not $BaseUrl) { $BaseUrl = "${MCP_BASE}" }
$ApiKey  = $env:AGENT_API_KEY

$headers = @{
  "Content-Type"   = "application/json"
  "X-Agent-Api-Key" = $ApiKey
}

# Health + tool catalog
Invoke-RestMethod -Uri "$BaseUrl/api/agent/health" -Headers $headers
Invoke-RestMethod -Uri "$BaseUrl/api/agent/info"   -Headers $headers

# Grounded Q&A (same invokeCompAgent as UI)
$body = @{
  question  = "What is T. Brooks QTD earnings and next tier gap?"
  rep_id    = "PERSONA-MKT-REP"
  period_id = "2026-Q2"
  channel   = "marketing"
} | ConvertTo-Json

$result = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/agent/invoke" -Headers $headers -Body $body
$result.answer`}
      </LangBlock>

      <SectionHeading>curl — smoke test</SectionHeading>
      <LangBlock title="OAuth inside Databricks · API key outside">
        {`# Outside Databricks — set AGENT_API_KEY on the app first
export HGV_COMP_BASE_URL="${MCP_BASE}"
export AGENT_API_KEY="<secret>"

curl -s "$HGV_COMP_BASE_URL/api/agent/health" -H "X-Agent-Api-Key: $AGENT_API_KEY"
curl -s "$HGV_COMP_BASE_URL/api/agent/info"   -H "X-Agent-Api-Key: $AGENT_API_KEY"

curl -s -X POST "$HGV_COMP_BASE_URL/api/agent/invoke" \\
  -H "Content-Type: application/json" \\
  -H "X-Agent-Api-Key: $AGENT_API_KEY" \\
  -d '{
    "question": "What is QTD earnings for PERSONA-MKT-REP?",
    "rep_id": "PERSONA-MKT-REP",
    "period_id": "2026-Q2",
    "channel": "marketing"
  }'

# Inside Databricks notebook — use OAuth token instead of API key
TOKEN=$(databricks auth token --profile hgv-premium | jq -r .access_token)
curl -s -X POST "${MCP_URL}" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'`}
      </LangBlock>

      <p style={{ fontSize: 11, color: 'var(--foreground-muted)', lineHeight: 1.65, margin: 0 }}>
        <strong>Tool reference:</strong>{' '}
        <code>ask_comp_agent</code> (NL Q&A), <code>get_marketing_workspace</code> (KPIs / tours / money map),{' '}
        <code>get_tour_context</code> (guest 360 + comp impact), <code>get_comp_metadata</code> (roster),{' '}
        <code>search_comp_entities</code> (entity search), <code>hub_health</code> (connectivity). Parse tool results from
        the <code>content</code> array — text items are JSON strings you can <code>JSON.parse</code> / <code>json.loads</code>.
      </p>
    </div>
  );
}
