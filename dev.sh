#!/usr/bin/env sh
# Run the site against the local posts folder instead of GitHub.
#   ./dev.sh            # public site on :3000
#   ./dev.sh 8081       # a different port
# Override the content folder with CONTENT=../makersec-posts-private ./dev.sh
exec env \
  LOCAL_CONTENT="${CONTENT:-../makersec-posts}" \
  PORT="${1:-3000}" \
  bun run dev
