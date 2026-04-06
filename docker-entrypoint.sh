#!/bin/sh
# Start the MCP server in the background if API key is configured
if [ -n "$BRAMBLE_API_KEY" ]; then
  echo "Starting MCP server on port ${MCP_PORT:-3100}..."
  MCP_TRANSPORT=http \
  BRAMBLE_URL="http://127.0.0.1:${PORT:-3000}" \
  node mcp/dist/index.js &
fi

# Start the main Bramble server (foreground)
exec node server/dist/index.js
