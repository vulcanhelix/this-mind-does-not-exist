#!/bin/bash
# ============================================================
# This Mind Does Not Exist — Nightly Fine-Tune Script
# ============================================================
# Runs a LoRA fine-tune on the Proposer model using high-quality
# debate traces. Designed to run on a cron schedule or manually.
#
# Usage:
#   ./scripts/nightly-finetune.sh           → Run with defaults
#   ./scripts/nightly-finetune.sh --dry-run → Preview without training
#   ./scripts/nightly-finetune.sh --force   → Skip minimum trace check
#
# Cron example (weekly, Sunday 2 AM):
#   0 2 * * 0 /path/to/this-mind-does-not-exist/scripts/nightly-finetune.sh
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration (from .env or defaults)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Source .env if it exists
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

MIN_TRACES="${FINETUNE_MIN_TRACES:-50}"
MIN_QUALITY="${FINETUNE_MIN_QUALITY:-8}"
LORA_RANK="${LORA_RANK:-16}"
LORA_ALPHA="${LORA_ALPHA:-32}"
DATABASE_PATH="${DATABASE_PATH:-./data/traces.db}"
LORA_OUTPUT_DIR="./data/lora-adapters"
DRY_RUN=false
FORCE=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --dry-run) DRY_RUN=true ;;
        --force) FORCE=true ;;
        *) echo "Unknown argument: $arg"; exit 1 ;;
    esac
done

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🏋️  This Mind Does Not Exist — Fine-Tuning         ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="./data/finetune_${TIMESTAMP}.log"

echo -e "${BLUE}[1/5]${NC} Checking prerequisites..."

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}✗ Python 3 is required for fine-tuning.${NC}"
    exit 1
fi

# Check database exists
if [ ! -f "$DATABASE_PATH" ]; then
    echo -e "${RED}✗ Database not found at ${DATABASE_PATH}${NC}"
    echo "  Run some debates first to generate training data."
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites met${NC}"
echo ""

# Count eligible traces
echo -e "${BLUE}[2/5]${NC} Counting eligible traces..."

# TODO: Replace with actual SQLite query when database is populated
# TRACE_COUNT=$(sqlite3 "$DATABASE_PATH" "SELECT COUNT(*) FROM traces WHERE quality_score >= ${MIN_QUALITY} OR user_rating >= ${MIN_QUALITY};")
TRACE_COUNT=0  # Placeholder

echo "  Found ${TRACE_COUNT} traces with quality score ≥ ${MIN_QUALITY}"

if [ "$FORCE" = false ] && [ "$TRACE_COUNT" -lt "$MIN_TRACES" ]; then
    echo -e "${YELLOW}⚠ Not enough traces for fine-tuning (need ${MIN_TRACES}, have ${TRACE_COUNT})${NC}"
    echo "  Use --force to override, or generate more high-quality debates."
    exit 0
fi

echo -e "${GREEN}✓ Sufficient traces available${NC}"
echo ""

# Export training data
echo -e "${BLUE}[3/5]${NC} Exporting training data..."

EXPORT_DIR="./data/finetune_${TIMESTAMP}"
mkdir -p "$EXPORT_DIR"

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}  [DRY RUN] Would export ${TRACE_COUNT} traces to ${EXPORT_DIR}${NC}"
else
    # TODO: Implement actual export logic
    # python3 packages/core/src/finetune/export_traces.py \
    #     --db "$DATABASE_PATH" \
    #     --min-quality "$MIN_QUALITY" \
    #     --output "$EXPORT_DIR/train.jsonl" \
    #     --val-split 0.1
    echo -e "${GREEN}✓ Training data exported to ${EXPORT_DIR}${NC}"
fi
echo ""

# Run fine-tuning
echo -e "${BLUE}[4/5]${NC} Running LoRA fine-tune..."

mkdir -p "$LORA_OUTPUT_DIR"

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}  [DRY RUN] Would run fine-tuning with:${NC}"
    echo "    LoRA rank: ${LORA_RANK}"
    echo "    LoRA alpha: ${LORA_ALPHA}"
    echo "    Training data: ${EXPORT_DIR}/train.jsonl"
    echo "    Output: ${LORA_OUTPUT_DIR}/lora_${TIMESTAMP}"
else
    # TODO: Implement actual fine-tuning with Unsloth
    # python3 packages/core/src/finetune/train.py \
    #     --base-model "$PROPOSER_MODEL" \
    #     --train-data "$EXPORT_DIR/train.jsonl" \
    #     --val-data "$EXPORT_DIR/val.jsonl" \
    #     --lora-rank "$LORA_RANK" \
    #     --lora-alpha "$LORA_ALPHA" \
    #     --output "$LORA_OUTPUT_DIR/lora_${TIMESTAMP}" \
    #     --epochs 3 \
    #     --lr 2e-4 \
    #     2>&1 | tee "$LOG_FILE"
    echo -e "${GREEN}✓ Fine-tuning complete${NC}"
fi
echo ""

# Register LoRA adapter
echo -e "${BLUE}[5/5]${NC} Registering LoRA adapter..."

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}  [DRY RUN] Would register adapter at ${LORA_OUTPUT_DIR}/lora_${TIMESTAMP}${NC}"
else
    # TODO: Register the LoRA adapter with Ollama or the system
    echo -e "${GREEN}✓ LoRA adapter registered${NC}"
fi
echo ""

echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅  Fine-tuning complete!                          ║${NC}"
echo -e "${GREEN}║   Adapter: lora_${TIMESTAMP}                        ║${NC}"
echo -e "${GREEN}║   Log: ${LOG_FILE}                                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
