#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";
import { parseStringPromise } from "xml2js";
import * as diff from "diff";

// Find config file
let configPath = path.join(process.cwd(), ".crucible-config.json");
if (!fs.existsSync(configPath)) {
  configPath = path.join(os.homedir(), ".crucible-config.json");
}

let config = {};
if (fs.existsSync(configPath)) {
  try {
    const fileContent = fs.readFileSync(configPath, "utf-8");
    config = JSON.parse(fileContent);
  } catch (error) {
    console.error("Error parsing .crucible-config.json:", error);
  }
} else {
  console.warn("No .crucible-config.json found. You can set CRUCIBLE_USERNAME, CRUCIBLE_PASSWORD, CRUCIBLE_URL environment variables.");
}

const CRUCIBLE_URL = process.env.CRUCIBLE_URL || config.baseUrl || "https://rdreview.vestel.com.tr";
const USERNAME = process.env.CRUCIBLE_USERNAME || config.username;
const PASSWORD = process.env.CRUCIBLE_PASSWORD || config.password;
const TOKEN = process.env.CRUCIBLE_API_TOKEN || config.token;

if (!CRUCIBLE_URL) {
  console.error("CRUCIBLE_URL is not set.");
  process.exit(1);
}

if (!(USERNAME && PASSWORD) && !TOKEN) {
  console.error("Authentication not provided (need either USERNAME and PASSWORD or TOKEN).");
  process.exit(1);
}

// Create axios instance
const api = axios.create({
  baseURL: `${CRUCIBLE_URL}/rest-service`,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

if (TOKEN) {
  api.defaults.headers.common["Authorization"] = `Bearer ${TOKEN}`;
} else if (USERNAME && PASSWORD) {
  const credentials = Buffer.from(`${USERNAME}:${PASSWORD}`).toString("base64");
  api.defaults.headers.common["Authorization"] = `Basic ${credentials}`;
}

/**
 * Vestel Crucible MCP Server Configuration
 * Defines the main server instance with its capabilities.
 */
const server = new Server(
  {
    name: "vestel-crucible-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "crucible_get_recent_reviews",
        description: "List recent code reviews from a project (e.g. AndroidTV).",
        inputSchema: {
          type: "object",
          properties: {
            project: {
              type: "string",
              description: "Project key (e.g., 'AndroidTV')."
            },
            limit: {
              type: "number",
              description: "Maximum number of reviews to return. Default is 30."
            }
          },
          required: ["project"],
        },
      },
      {
        name: "crucible_get_recent_commits",
        description: "List recent commits/changesets from a project repository (e.g. AndroidTV).",
        inputSchema: {
          type: "object",
          properties: {
            project: {
              type: "string",
              description: "Project key (e.g., 'AndroidTV')."
            },
            limit: {
              type: "number",
              description: "Maximum number of commits to return. Default is 30."
            }
          },
          required: ["project"],
        },
      },
      {
        name: "crucible_get_file_diff",
        description: "Get the unified diff (patch) for a specific file change using its fromContentUrl and toContentUrl.",
        inputSchema: {
          type: "object",
          properties: {
            fromContentUrl: {
              type: "string",
              description: "The raw content URL of the old version (from the review item)."
            },
            toContentUrl: {
              type: "string",
              description: "The raw content URL of the new version (from the review item)."
            }
          },
          required: ["fromContentUrl", "toContentUrl"],
        },
      },
      {
        name: "crucible_get_review_details",
        description: "Get detailed information about a specific review, including files and patches/diffs.",
        inputSchema: {
          type: "object",
          properties: {
            reviewId: {
              type: "string",
              description: "The ID of the review (e.g., 'CR-123')."
            }
          },
          required: ["reviewId"],
        },
      }
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    switch (request.params.name) {
      case "crucible_get_recent_reviews":
      case "crucible_get_recent_commits": {
        const project = request.params.arguments?.project;
        const limit = request.params.arguments?.limit || 30;
        const isCommits = request.params.name === "crucible_get_recent_commits";
        const viewParam = isCommits ? "fe" : "cru";

        // Fetch RSS feed using full URL to bypass baseURL
        const response = await api.get(`https://rdreview.vestel.com.tr/changelog/${project}?view=${viewParam}&max=${limit}&RSS=true`);
        
        const xmlData = response.data;
        const result = await parseStringPromise(xmlData);
        
        const items = result.rss?.channel?.[0]?.item || [];
        
        const summary = items.map(item => {
          const title = item.title?.[0] || "No title";
          const link = item.link?.[0] || "";
          const pubDate = item.pubDate?.[0] || "";
          const author = item.author?.[0] || "Unknown";
          return `- ${title}\n  Author: ${author}\n  Link: ${link}\n  Date: ${pubDate}`;
        }).join("\n\n");

        return {
          content: [
            {
              type: "text",
              text: summary || `No recent ${isCommits ? 'commits' : 'reviews'} found for project ${project}.`,
            },
          ],
        };
      }

      case "crucible_get_file_diff": {
        const fromContentUrl = request.params.arguments?.fromContentUrl;
        const toContentUrl = request.params.arguments?.toContentUrl;
        
        let fromText = "";
        let toText = "";
        
        try {
          if (fromContentUrl && fromContentUrl.trim() !== "") {
            const res = await api.get(fromContentUrl);
            fromText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
          }
        } catch (e) {
          fromText = "// Failed to fetch old content: " + e.message;
        }
        
        try {
          if (toContentUrl && toContentUrl.trim() !== "") {
            const res = await api.get(toContentUrl);
            toText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
          }
        } catch (e) {
          toText = "// Failed to fetch new content: " + e.message;
        }

        const patch = diff.createPatch("file", fromText, toText);

        return {
          content: [
            {
              type: "text",
              text: patch,
            },
          ],
        };
      }

      case "crucible_get_review_details": {
        const reviewId = request.params.arguments?.reviewId;
        
        // 1. Get review basic details
        const detailsResponse = await api.get(`/reviews-v1/${reviewId}/details`);
        const review = detailsResponse.data;

        // 2. Get review items (files in the review)
        // /rest-service/reviews-v1/{id}/reviewitems
        let itemsInfo = "";
        try {
          const itemsResponse = await api.get(`/reviews-v1/${reviewId}/reviewitems`);
          const items = itemsResponse.data?.reviewItem || [];
          
          itemsInfo = items.map(item => {
            let info = `- File: ${item.toPath || item.repositoryName}\n  Action: ${item.commitType || "N/A"}\n  PermId: ${item.permId?.id}`;
            if (item.fromContentUrl) info += `\n  fromContentUrl: ${item.fromContentUrl}`;
            if (item.toContentUrl) info += `\n  toContentUrl: ${item.toContentUrl}`;
            // Normally you would fetch diffs using Fisheye endpoints if needed, but Crucible also can give patch
            if (item.patchUrl) {
               info += `\n  Patch URL: ${item.patchUrl}`;
            }
            return info;
          }).join("\n\n");
        } catch (e) {
          itemsInfo = "Could not fetch review items: " + e.message;
        }

        // 3. Get comments (General and versioned)
        let commentsInfo = "";
        try {
          const commentsResponse = await api.get(`/reviews-v1/${reviewId}/comments`);
          const comments = commentsResponse.data?.comments || [];
          commentsInfo = JSON.stringify(comments, null, 2);
        } catch (e) {
          commentsInfo = "Could not fetch comments: " + e.message;
        }

        let output = `# Review: ${reviewId} - ${review.name || ""}\n\n`;
        output += `State: ${review.state}\n`;
        output += `Author: ${review.author?.displayName}\n`;
        output += `Summary: ${review.summary || ""}\n\n`;
        output += `## Files & Items\n${itemsInfo || "No items found."}\n\n`;
        output += `## Comments\n${commentsInfo || "No comments."}\n\n`;
        
        return {
          content: [
            {
              type: "text",
              text: output,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  } catch (error) {
    let errorMessage = error.message;
    if (error.response) {
      errorMessage = `API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`;
    }
    return {
      content: [
        {
          type: "text",
          text: `Error executing ${request.params.name}: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Vestel Crucible MCP Server running on stdio");
