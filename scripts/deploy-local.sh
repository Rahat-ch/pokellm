#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Navigate to project root
cd "$(dirname "$0")/.."

show_help() {
    echo "PokeLLM Local Deployment Script"
    echo ""
    echo "Usage: ./scripts/deploy-local.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start     Build and start all services (default)"
    echo "  stop      Stop all services"
    echo "  restart   Restart all services"
    echo "  rebuild   Force rebuild and start"
    echo "  logs      Show logs (follow mode)"
    echo "  status    Show service status"
    echo "  clean     Stop and remove all containers, volumes"
    echo "  help      Show this help message"
}

start_services() {
    echo -e "${YELLOW}Building and starting PokeLLM...${NC}"
    docker compose up --build -d

    echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
    sleep 5

    # Check if services are running
    if docker compose ps | grep -q "Up"; then
        echo ""
        echo -e "${GREEN}PokeLLM is running!${NC}"
        echo ""
        echo "  App:      http://localhost:3000"
        echo "  Postgres: localhost:5432"
        echo ""
        echo "Run './scripts/deploy-local.sh logs' to view logs"
    else
        echo -e "${RED}Something went wrong. Check logs with:${NC}"
        echo "  docker compose logs"
        exit 1
    fi
}

stop_services() {
    echo -e "${YELLOW}Stopping PokeLLM...${NC}"
    docker compose down
    echo -e "${GREEN}Services stopped.${NC}"
}

restart_services() {
    echo -e "${YELLOW}Restarting PokeLLM...${NC}"
    docker compose restart
    echo -e "${GREEN}Services restarted.${NC}"
}

rebuild_services() {
    echo -e "${YELLOW}Rebuilding PokeLLM...${NC}"
    docker compose down
    docker compose build --no-cache
    docker compose up -d
    echo -e "${GREEN}Rebuild complete!${NC}"
}

show_logs() {
    docker compose logs -f
}

show_status() {
    echo -e "${YELLOW}Service Status:${NC}"
    docker compose ps
}

clean_all() {
    echo -e "${RED}Warning: This will remove all containers and volumes!${NC}"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker compose down -v
        echo -e "${GREEN}Cleanup complete.${NC}"
    else
        echo "Cancelled."
    fi
}

# Main command handler
case "${1:-start}" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    rebuild)
        rebuild_services
        ;;
    logs)
        show_logs
        ;;
    status)
        show_status
        ;;
    clean)
        clean_all
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        show_help
        exit 1
        ;;
esac
