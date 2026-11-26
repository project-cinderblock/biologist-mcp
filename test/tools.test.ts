import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { BiologistApiClient } from "../src/client/index.js";
import { registerAllTools } from "../src/tools/index.js";
import { registerResources } from "../src/resources/index.js";
import { registerPrompts } from "../src/prompts/index.js";

describe("MCP Server Tool, Resource, and Prompt Execution", () => {
  let mock: MockAdapter;
  let server: McpServer;
  let client: BiologistApiClient;

  beforeEach(() => {
    mock = new MockAdapter(axios);
    server = new McpServer(
      { name: "biologist-test", version: "1.0.0" },
      { capabilities: { tools: {}, resources: {}, prompts: {} } }
    );
    client = new BiologistApiClient({
      apiUrl: "http://localhost:3000/api/v1",
      timeoutMs: 5000,
      debug: false
    });
    registerAllTools(server, client);
    registerResources(server, client);
    registerPrompts(server);
  });

  afterEach(() => {
    mock.restore();
  });

  it("registers all expected tools across all 8 domains", () => {
    const registeredToolNames = Object.keys((server as any)._registeredTools);

    const expectedTools = [
      // Search (2)
      "search",
      "find_counterparts",
      // Biomes (8)
      "list_biomes",
      "get_biome",
      "create_biome",
      "update_biome",
      "delete_biome",
      "upsert_biomes_batch",
      "populate_biomes",
      "populate_biome_species",
      // Species (9)
      "list_species",
      "get_species",
      "create_species",
      "update_species",
      "delete_species",
      "upsert_species_batch",
      "generate_species_embedding",
      "populate_species_organisms",
      "populate_species_bulk",
      // Organisms (8)
      "list_organisms",
      "get_organism",
      "create_organism",
      "update_organism",
      "delete_organism",
      "upsert_organisms_batch",
      "generate_organism_embedding",
      "populate_organisms_bulk",
      // Clusters & Snapshots (7)
      "compute_clusters",
      "create_cluster_snapshot",
      "list_cluster_snapshots",
      "get_cluster_snapshot",
      "delete_cluster_snapshot",
      "list_cluster_groups",
      "get_cluster_group",
      // Reports (10)
      "list_cluster_reports",
      "get_cluster_report",
      "create_cluster_report",
      "delete_cluster_report",
      "generate_deep_synthesis",
      "wait_for_cluster_report",
      "list_report_summaries",
      "get_report_summary",
      "list_report_sub_reports",
      "get_report_sub_report",
      // Jobs (3)
      "list_jobs",
      "get_job_status",
      "wait_for_job",
      // System (5)
      "get_platform_status",
      "get_settings",
      "update_context_window",
      "trigger_bulk_embeddings",
      "get_openapi_spec"
    ];

    for (const tool of expectedTools) {
      expect(registeredToolNames).toContain(tool);
    }
    expect(registeredToolNames.length).toBe(expectedTools.length);
  });

  it("executes get_platform_status tool cleanly", async () => {
    const mockStatus = {
      status: "ok",
      environment: "production",
      counts: { biomes: 10, species: 200 }
    };
    mock.onGet("http://localhost:3000/api/v1/status").reply(200, { data: mockStatus });

    const tool = (server as any)._registeredTools["get_platform_status"];
    const response = await tool.handler({}, {});

    expect(response.content).toBeDefined();
    expect(response.content[0].type).toBe("text");
    const parsed = JSON.parse(response.content[0].text);
    expect(parsed.status).toBe("ok");
    expect(parsed.counts.species).toBe(200);
  });

  it("executes search tool and returns formatted JSON", async () => {
    const mockHit = [{ type: "Species", data: { id: 1, name: "Snow Leopard" } }];
    mock.onGet("http://localhost:3000/api/v1/search").reply(200, { data: mockHit });

    const tool = (server as any)._registeredTools["search"];
    const response = await tool.handler({ q: "alpine predator", mode: "auto", target_type: "all", limit: 10 }, {});

    expect(response.content).toBeDefined();
    const parsed = JSON.parse(response.content[0].text);
    expect(parsed.data[0].data.name).toBe("Snow Leopard");
  });

  it("executes find_counterparts for species and organism", async () => {
    mock
      .onGet("http://localhost:3000/api/v1/species/5/neighbors")
      .reply(200, { data: [{ id: 6, name: "Clouded Leopard", neighbor_distance: 0.05 }] });

    const tool = (server as any)._registeredTools["find_counterparts"];
    const res = await tool.handler({ entity_type: "species", id: 5, limit: 5 }, {});

    expect(res.content).toBeDefined();
    const parsed = JSON.parse(res.content[0].text);
    expect(parsed[0].name).toBe("Clouded Leopard");
  });

  it("handles tool errors with isError flag and message", async () => {
    mock.onGet("http://localhost:3000/api/v1/biomes/999").reply(500, {
      error: { code: "internal_error", message: "Database connection failed" }
    });

    const tool = (server as any)._registeredTools["get_biome"];
    const response = await tool.handler({ id: 999, include_species: true }, {});

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain("Database connection failed");
  });

  it("registers resources correctly", () => {
    const registeredResources = (server as any)._registeredResources;
    const registeredTemplates = (server as any)._registeredResourceTemplates;

    expect(registeredResources["biologist://status"]).toBeDefined();
    expect(registeredResources["biologist://biomes"]).toBeDefined();
    expect(Object.keys(registeredTemplates)).toHaveLength(2);
  });

  it("registers all 3 MCP prompts", () => {
    const registeredPrompts = (server as any)._registeredPrompts;
    expect(registeredPrompts["comparative_biological_analysis"]).toBeDefined();
    expect(registeredPrompts["biological_cluster_monograph"]).toBeDefined();
    expect(registeredPrompts["evolutionary_convergence_inquiry"]).toBeDefined();

    const promptObj = registeredPrompts["comparative_biological_analysis"];
    const res = promptObj.callback({
      entity_a: "Snow Leopard",
      entity_b: "Fennec Fox",
      entity_type: "species"
    });
    expect(res.description).toContain("Comparative biological analysis");
    expect(res.messages[0].content.text).toContain("Snow Leopard");
    expect(res.messages[0].content.text).toContain("Fennec Fox");
  });
});
