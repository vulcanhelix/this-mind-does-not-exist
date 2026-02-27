#!/bin/bash
# ============================================================
# This Mind Does Not Exist — Setup Script
# ============================================================
# One-command setup for the entire project.
# Usage: curl -fsSL https://raw.githubusercontent.com/lalomax/this-mind-does-not-exist/main/scripts/setup.sh | bash
# Or:    ./scripts/setup.sh
# ============================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo ""
echo -e "${PURPLE}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${PURPLE}║                                                      ║${NC}"
echo -e "${PURPLE}║   🧠  This Mind Does Not Exist — Setup               ║${NC}"
echo -e "${PURPLE}║   Frontier reasoning on your local machine            ║${NC}"
echo -e "${PURPLE}║                                                      ║${NC}"
echo -e "${PURPLE}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# Check for required dependencies
echo -e "${BLUE}[1/6]${NC} Checking dependencies..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js is not installed.${NC}"
    echo "  Please install Node.js 20+ from https://nodejs.org"
    exit 1
else
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Node.js ${NODE_VERSION}${NC}"
fi

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm is not installed.${NC}"
    exit 1
else
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓ npm ${NPM_VERSION}${NC}"
fi

# Check Ollama
if ! command -v ollama &> /dev/null; then
    echo -e "${YELLOW}⚠ Ollama is not installed.${NC}"
    echo -e "  Installing Ollama..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo -e "  Please install Ollama from https://ollama.ai/download"
        echo -e "  Then run this script again."
        exit 1
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        curl -fsSL https://ollama.ai/install.sh | sh
        echo -e "${GREEN}✓ Ollama installed${NC}"
    else
        echo -e "${RED}  Unsupported OS. Please install Ollama manually: https://ollama.ai${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Ollama installed${NC}"
fi

# Check if Ollama is running
if ! curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠ Ollama is not running. Starting...${NC}"
    ollama serve &
    sleep 3
    if curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Ollama started${NC}"
    else
        echo -e "${RED}✗ Failed to start Ollama. Please start it manually: ollama serve${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Ollama is running${NC}"
fi

# Check Docker (optional)
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓ Docker available (optional)${NC}"
else
    echo -e "${YELLOW}⚠ Docker not found (optional — needed only for Docker Compose setup)${NC}"
fi

echo ""

# Pull models
echo -e "${BLUE}[2/6]${NC} Pulling AI models (this may take a while)..."
./scripts/install-ollama-models.sh
echo ""

# Install Node dependencies
echo -e "${BLUE}[3/6]${NC} Installing Node.js dependencies..."
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Set up environment
echo -e "${BLUE}[4/6]${NC} Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${GREEN}✓ Created .env from .env.example${NC}"
else
    echo -e "${YELLOW}⚠ .env already exists, skipping${NC}"
fi
echo ""

# Initialize database
echo -e "${BLUE}[5/6]${NC} Initializing database..."
mkdir -p data/traces
echo -e "${GREEN}✓ Data directories created${NC}"
echo ""

# Ready
echo -e "${BLUE}[6/6]${NC} Setup complete!"
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                      ║${NC}"
echo -e "${GREEN}║   ✅  This Mind Does Not Exist is ready!              ║${NC}"
echo -e "${GREEN}║                                                      ║${NC}"
echo -e "${GREEN}║   Start the backend:                                 ║${NC}"
echo -e "${GREEN}║     cd packages/core && npm run dev                  ║${NC}"
echo -e "${GREEN}║                                                      ║${NC}"
echo -e "${GREEN}║   Start the frontend:                                ║${NC}"
echo -e "${GREEN}║     cd apps/web && npm run dev                       ║${NC}"
echo -e "${GREEN}║                                                      ║${NC}"
echo -e "${GREEN}║   Or use Docker:                                     ║${NC}"
echo -e "${GREEN}║     docker compose up                                ║${NC}"
echo -e "${GREEN}║                                                      ║${NC}"
echo -e "${GREEN}║   Open: http://localhost:3000                        ║${NC}"
echo -e "${GREEN}║                                                      ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
