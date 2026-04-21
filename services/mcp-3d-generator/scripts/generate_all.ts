import { fal } from "@fal-ai/client";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load env vars
dotenv.config({ path: path.resolve("../../.env") });

async function generateModel(imagePath: string, outputName: string) {
  if (!fs.existsSync(imagePath)) {
    console.error(`File not found: ${imagePath}`);
    return;
  }
  
  console.log(`Cropping ${outputName}...`);
  const sharp = require('sharp');
  
  // The turnaround image has 3 views side-by-side. 
  // We extract the center view (usually front view) or left view.
  // Assuming 1024x1024, let's take the middle view [width 341, left 341]
  // If the middle view doesn't look right we can adjust, but usually center is front.
  // Let's actually take the left view [0-341] just to be safe, or we can use the center view.
  // We'll crop the center view since it's most often the front view in character sheets.
  const croppedBuffer = await sharp(imagePath)
    .extract({ left: 341, top: 0, width: 341, height: 1024 })
    // Trellis works best with square images, so we composite it onto a 1024x1024 transparent/white background
    .extend({
      top: 0,
      bottom: 0,
      left: 341,
      right: 342,
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .png()
    .toBuffer();

  const ext = path.extname(imagePath).toLowerCase();
  let mimeType = "image/png";
  
  console.log(`Uploading ${outputName} to Fal storage...`);
  // create a Blob or File
  const fileBlob = new Blob([croppedBuffer], { type: mimeType });
  const uploadUrl = await fal.storage.upload(fileBlob);
  console.log(`Uploaded to: ${uploadUrl}`);

  console.log(`Starting Fal.ai generation for ${outputName}...`);
  
  const result = await fal.subscribe("fal-ai/trellis-2", {
    input: {
      image_url: uploadUrl,
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === "IN_PROGRESS") {
        update.logs.map((log) => log.message).forEach(console.log);
      }
    },
  });

  console.log(`Generation complete for ${outputName}`);

  let modelUrl = "";
  if ((result as any).model_file?.url) {
    modelUrl = (result as any).model_file.url;
  } else if ((result as any).mesh?.url) {
    modelUrl = (result as any).mesh.url;
  } else {
    const resultString = JSON.stringify(result);
    const urlMatch = resultString.match(/"(https:\/\/[^"]+\.(?:glb|obj)[^"]*)"/);
    if (urlMatch) {
      modelUrl = urlMatch[1];
    } else {
      console.error("Could not extract model URL from Fal.ai result:", result);
      return;
    }
  }

  console.log(`Downloading model from ${modelUrl}...`);
  const response = await fetch(modelUrl);
  if (!response.ok) {
    console.error(`Failed to download model: ${response.statusText}`);
    return;
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const workspaceRoot = path.resolve("../../");
  const modelsDir = path.join(workspaceRoot, "apps", "dashboard", "public", "models");
  
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
  }

  const outputFilePath = path.join(modelsDir, `${outputName}.glb`);
  fs.writeFileSync(outputFilePath, buffer);
  console.log(`Successfully saved to ${outputFilePath}\n`);
}

async function main() {
  if (!process.env.FAL_KEY) {
    console.error("FAL_KEY is not configured.");
    process.exit(1);
  }

  const agents = [
    { file: "nova_360.png", name: "nova" },
    { file: "lumi_360.png", name: "lumi" },
    { file: "argus_360.png", name: "argus" },
    { file: "rusty_360.png", name: "rusty" },
    { file: "titan_360.png", name: "titan" },
  ];

  const publicAgentsDir = path.resolve("../../apps/dashboard/public/agents");

  for (const agent of agents) {
    const imagePath = path.join(publicAgentsDir, agent.file);
    await generateModel(imagePath, agent.name);
  }
}

main().catch(console.error);
