#!/bin/bash
# ============================================================
# This Mind Does Not Exist — Install Ollama Models
# ============================================================
# Pulls all required models for the reasoning engine.
# Run this once before first use.
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🧠 Pulling models for This Mind Does Not Exist...${NC}"
echo ""

# Check Ollama is running
if ! curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "${RED}✗ Ollama is not running. Please start it: ollama serve${NC}"
    exit 1
fi

# Define models
PROPOSER_MODEL="${PROPOSER_MODEL:-qwen3:32b}"
SKEPTIC_MODEL="${SKEPTIC_MODEL:-llama3.3:70b}"
EMBEDDING_MODEL="${EMBEDDING_MODEL:-nomic-embed-text}"

# Pull Proposer model
echo -e "${YELLOW}[1/3]${NC} Pulling Proposer model: ${PROPOSER_MODEL}"
echo "       This is a large model and may take 10-30 minutes on first pull."
ollama pull "${PROPOSER_MODEL}"
echo -e "${GREEN}✓ ${PROPOSER_MODEL} ready${NC}"
echo ""

# Pull Skeptic model
echo -e "${YELLOW}[2/3]${NC} Pulling Skeptic model: ${SKEPTIC_MODEL}"
echo "       This is a large model and may take 15-45 minutes on first pull."
ollama pull "${SKEPTIC_MODEL}"
echo -e "${GREEN}✓ ${SKEPTIC_MODEL} ready${NC}"
echo ""

# Pull Embedding model
echo -e "${YELLOW}[3/3]${NC} Pulling Embedding model: ${EMBEDDING_MODEL}"
ollama pull "${EMBEDDING_MODEL}"
echo -e "${GREEN}✓ ${EMBEDDING_MODEL} ready${NC}"
echo ""

# Verify
echo -e "${BLUE}Verifying models...${NC}"
echo "Available models:"
ollama list
echo ""

echo -e "${GREEN}✅ All models pulled successfully!${NC}"
echo ""
echo "Default model pair:"
echo "  Proposer:  ${PROPOSER_MODEL}"
echo "  Skeptic:   ${SKEPTIC_MODEL}" 
echo "  Embedding: ${EMBEDDING_MODEL}"
echo ""
echo "To change models, edit PROPOSER_MODEL and SKEPTIC_MODEL in .env"
