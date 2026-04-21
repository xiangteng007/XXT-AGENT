import { fal } from "@fal-ai/client";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load env vars
dotenv.config({ path: path.resolve("../../.env") });

const prefix = "Solo character concept art, strictly ONE single person, standing straight in the exact center looking directly at camera, full body shot from top of head to bottom of boots, both feet completely visible. Pure white background, simple clean studio lighting. A Eurasian-mixed female agent, 8-heads-tall perfect proportions, extreme 23-inch wasp waist. Character must be fully within the frame.";

const agents = [
  {
    name: "nova",
    prompt: prefix + " V4 navel cutout design, high-exposure authoritative coordinator uniform."
  },
  {
    name: "lumi",
    prompt: prefix + " Slightly smaller chest, elegant flowing dress drape, crystal high heels, glowing neon accent lines, cyberpunk spatial aesthetics."
  },
  {
    name: "argus",
    prompt: prefix + " Wide cyber seams on skin, glowing red energy effects, side-cutout high-exposure tactical suit. VERY IMPORTANT: Only one person in the image."
  },
  {
    name: "rusty",
    prompt: prefix + " Smart sexy CEO style, short bob hair parted to the side, no glasses, no eye accessories. Steampunk and metallic details on high-exposure clothing."
  },
  {
    name: "titan",
    prompt: prefix + " Slim long thighs. Tactical shoulder ponytail, lightweight cyber armor, geometric cut high-exposure clothing emphasizing structure. Make sure feet are clearly drawn and visible."
  }
];

async function generateAgent(agent: typeof agents[0]) {
  console.log(`\n--- Starting pipeline for ${agent.name.toUpperCase()} ---`);
  
  // Step 1: Generate clean portrait
  console.log(`[1/3] Generating clean front-facing portrait for ${agent.name}...`);
  const imgResult = await fal.subscribe("fal-ai/flux-pro/v1.1", {
    input: {
      prompt: agent.prompt,
      image_size: "portrait_4_3",
      num_images: 1,
      output_format: "jpeg"
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === "IN_PROGRESS") {
        update.logs.map((log) => log.message).forEach(m => console.log('  [FLUX] ' + m));
      }
    },
  });
  const generatedImageUrl = (imgResult as any).data.images[0].url;
  console.log(`      -> Portrait generated: ${generatedImageUrl}`);

  // Step 2: Remove background
  console.log(`[2/3] Removing background for ${agent.name}...`);
  const bgResult = await fal.subscribe("fal-ai/bria/background/remove", {
    input: {
      image_url: generatedImageUrl,
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === "IN_PROGRESS") {
        update.logs.map((log) => log.message).forEach(m => console.log('  [BRIA] ' + m));
      }
    },
  });
  
  const transparentImageUrl = (bgResult as any).data?.image?.url || (bgResult as any).data?.image_url;
  if (!transparentImageUrl) {
      console.error(`Failed to extract transparent image url from result:`, bgResult);
      return;
  }
  console.log(`      -> Transparent PNG generated: ${transparentImageUrl}`);

  // Step 3: Generate 3D Model
  console.log(`[3/3] Generating 3D model with Trellis-2 for ${agent.name}...`);
  const trellisResult = await fal.subscribe("fal-ai/trellis-2", {
    input: {
      image_url: transparentImageUrl,
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === "IN_PROGRESS") {
        update.logs.map((log) => log.message).forEach(m => console.log('  [TRELLIS] ' + m));
      }
    },
  });

  let modelUrl = "";
  if ((trellisResult as any).data?.model_file?.url) {
    modelUrl = (trellisResult as any).data.model_file.url;
  } else if ((trellisResult as any).data?.mesh?.url) {
    modelUrl = (trellisResult as any).data.mesh.url;
  } else {
    const resultString = JSON.stringify(trellisResult);
    const urlMatch = resultString.match(/"(https:\/\/[^"]+\.(?:glb|obj)[^"]*)"/);
    if (urlMatch) {
      modelUrl = urlMatch[1];
    } else {
      console.error("Could not extract model URL from Fal.ai result:", trellisResult);
      return;
    }
  }

  console.log(`      -> 3D Model generated: ${modelUrl}`);

  // Download and save
  console.log(`Downloading ${agent.name}.glb...`);
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

  const outputFilePath = path.join(modelsDir, `${agent.name}.glb`);
  fs.writeFileSync(outputFilePath, buffer);
  console.log(`Successfully saved to ${outputFilePath}`);
}

async function main() {
  if (!process.env.FAL_KEY) {
    console.error("FAL_KEY is not configured in .env");
    process.exit(1);
  }

  for (const agent of agents) {
    try {
      await generateAgent(agent);
    } catch (e) {
      console.error(`Error processing ${agent.name}:`, e);
    }
  }
  
  console.log("\nPipeline finished successfully!");
}

main().catch(console.error);
