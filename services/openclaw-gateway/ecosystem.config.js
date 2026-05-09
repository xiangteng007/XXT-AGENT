module.exports = {
  apps: [
    {
      name: "openclaw-gateway",
      script: "node_modules/tsx/dist/cli.mjs",
      args: "watch src/index.ts",
      env: {
        NODE_ENV: "development"
      }
    }
  ]
};
