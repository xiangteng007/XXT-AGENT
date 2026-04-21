import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { fal } from "@fal-ai/client";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const server = new Server(
  {
    name: "mcp-3d-generator",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tool
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "generate_3d_model",
        description: "Generate a 3D model (GLB) from a 2D image using Fal.ai Trellis API",
        inputSchema: {
          type: "object",
          properties: {
            imagePath: {
              type: "string",
              description: "Absolute local path to the source 2D image",
            },
            imageUrl: {
              type: "string",
              description: "URL to the source 2D image (if not using local imagePath)",
            },
            outputName: {
              type: "string",
              description: "Name for the output model, e.g., 'nova'. Will be saved as [name].glb",
            },
          },
          required: ["outputName"],
        },
      },
    ],
  };
});

// Implement tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "generate_3d_model") {
    const { imagePath, imageUrl, outputName } = request.params.arguments as any;

    if (!imagePath && !imageUrl) {
      throw new Error("Must provide either imagePath or imageUrl");
    }

    if (!process.env.FAL_KEY) {
      throw new Error("FAL_KEY is not configured in the environment.");
    }

    try {
      let finalImageUrl = imageUrl;

      // If a local image path is provided, convert it to a data URL
      if (imagePath) {
        if (!fs.existsSync(imagePath)) {
          throw new Error(`File not found: ${imagePath}`);
        }
        const fileData = fs.readFileSync(imagePath);
        const ext = path.extname(imagePath).toLowerCase();
        let mimeType = "image/jpeg";
        if (ext === ".png") mimeType = "image/png";
        else if (ext === ".webp") mimeType = "image/webp";
        
        finalImageUrl = `data:${mimeType};base64,${fileData.toString("base64")}`;
      }

      console.error(`Starting Fal.ai generation for ${outputName}...`);
      
      const result = await fal.subscribe("fal-ai/trellis-2", {
        input: {
          image_url: finalImageUrl,
          // You can tweak these if needed
          // ss_guidance_strength: 7.5,
          // ss_sampling_steps: 12,
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS") {
            update.logs.map((log) => log.message).forEach(console.error);
          }
        },
      });

      console.error("Fal.ai generation complete. Result:", JSON.stringify(result, null, 2));

      // Extract the model URL from the result
      let modelUrl = "";
      // typical Trellis-2 result has .model_file.url or .mesh.url
      if ((result as any).model_file?.url) {
        modelUrl = (result as any).model_file.url;
      } else if ((result as any).mesh?.url) {
        modelUrl = (result as any).mesh.url;
      } else {
        // Fallback: look for any .glb or .obj url in the object
        const resultString = JSON.stringify(result);
        const urlMatch = resultString.match(/"(https:\/\/[^"]+\.(?:glb|obj)[^"]*)"/);
        if (urlMatch) {
          modelUrl = urlMatch[1];
        } else {
          throw new Error("Could not extract model URL from Fal.ai result.");
        }
      }

      console.error(`Downloading model from ${modelUrl}...`);
      const response = await fetch(modelUrl);
      if (!response.ok) {
        throw new Error(`Failed to download model: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // We will save to apps/dashboard/public/models
      // Calculate the path relative to the process cwd, which will likely be services/mcp-3d-generator
      // So we go up to the workspace root: ../../apps/dashboard/public/models
      const workspaceRoot = path.resolve(__dirname, "../../../");
      const modelsDir = path.join(workspaceRoot, "apps", "dashboard", "public", "models");
      
      if (!fs.existsSync(modelsDir)) {
        fs.mkdirSync(modelsDir, { recursive: true });
      }

      const outputFilePath = path.join(modelsDir, `${outputName}.glb`);
      fs.writeFileSync(outputFilePath, buffer);

      return {
        content: [
          {
            type: "text",
            text: `Successfully generated 3D model and saved to ${outputFilePath}\nModel preview: ${modelUrl}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error generating 3D model: ${error.message}\n${error.stack}`,
          },
        ],
        isError: true,
      };
    }
  }

  throw new Error("Tool not found");
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP 3D Generator Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
