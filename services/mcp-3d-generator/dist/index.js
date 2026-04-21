"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const client_1 = require("@fal-ai/client");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const server = new index_js_1.Server({
    name: "mcp-3d-generator",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
// Define tool
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
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
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
    if (request.params.name === "generate_3d_model") {
        const { imagePath, imageUrl, outputName } = request.params.arguments;
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
                if (!fs_1.default.existsSync(imagePath)) {
                    throw new Error(`File not found: ${imagePath}`);
                }
                const fileData = fs_1.default.readFileSync(imagePath);
                const ext = path_1.default.extname(imagePath).toLowerCase();
                let mimeType = "image/jpeg";
                if (ext === ".png")
                    mimeType = "image/png";
                else if (ext === ".webp")
                    mimeType = "image/webp";
                finalImageUrl = `data:${mimeType};base64,${fileData.toString("base64")}`;
            }
            console.error(`Starting Fal.ai generation for ${outputName}...`);
            const result = await client_1.fal.subscribe("fal-ai/trellis-2", {
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
            if (result.model_file?.url) {
                modelUrl = result.model_file.url;
            }
            else if (result.mesh?.url) {
                modelUrl = result.mesh.url;
            }
            else {
                // Fallback: look for any .glb or .obj url in the object
                const resultString = JSON.stringify(result);
                const urlMatch = resultString.match(/"(https:\/\/[^"]+\.(?:glb|obj)[^"]*)"/);
                if (urlMatch) {
                    modelUrl = urlMatch[1];
                }
                else {
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
            const workspaceRoot = path_1.default.resolve(__dirname, "../../../");
            const modelsDir = path_1.default.join(workspaceRoot, "apps", "dashboard", "public", "models");
            if (!fs_1.default.existsSync(modelsDir)) {
                fs_1.default.mkdirSync(modelsDir, { recursive: true });
            }
            const outputFilePath = path_1.default.join(modelsDir, `${outputName}.glb`);
            fs_1.default.writeFileSync(outputFilePath, buffer);
            return {
                content: [
                    {
                        type: "text",
                        text: `Successfully generated 3D model and saved to ${outputFilePath}\nModel preview: ${modelUrl}`,
                    },
                ],
            };
        }
        catch (error) {
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
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error("MCP 3D Generator Server running on stdio");
}
main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
