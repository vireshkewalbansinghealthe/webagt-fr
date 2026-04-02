#!/bin/bash

# scripts/run_remote.sh
#
# Like run_local.sh but explicitly connects to the DEV remote worker
# (useful as an alias / reminder that --env dev --remote is the right flag).
# Identical behaviour to run_local.sh.

exec "$(dirname "$0")/run_local.sh"
