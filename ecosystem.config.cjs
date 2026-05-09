const path = require('path');

const TSX_CLI = path.resolve(__dirname, 'node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs');

module.exports = {
  apps: [
    {
      name: 'openclaw-gateway',
      script: TSX_CLI,
      args: 'src/index.ts',
      cwd: path.resolve(__dirname, 'services/openclaw-gateway'),
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        PORT: '3100',
      },
      watch: false,
      max_memory_restart: '512M',
      error_file: 'logs/gateway-error.log',
      out_file: 'logs/gateway-out.log',
      merge_logs: true,
      time: true,
    },
    {
      name: 'telegram-bot',
      script: 'run_bot.py',
      cwd: path.resolve(__dirname, 'services/telegram-command-bot'),
      interpreter: 'python',
      env: {
        PYTHONUNBUFFERED: '1',
      },
      watch: false,
      max_memory_restart: '256M',
      error_file: 'logs/bot-error.log',
      out_file: 'logs/bot-out.log',
      merge_logs: true,
      time: true,
    },
    {
      name: 'regulation-rag',
      script: 'start.py',
      cwd: path.resolve(__dirname, 'services/regulation-rag'),
      interpreter: 'python',
      env: {
        PYTHONUNBUFFERED: '1',
      },
      watch: false,
      max_memory_restart: '512M',
      error_file: 'logs/rag-error.log',
      out_file: 'logs/rag-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
