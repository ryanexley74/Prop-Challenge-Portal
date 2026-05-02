.PHONY: help up down restart build deploy logs logs-api logs-web db-shell migrate ps prune

help:
	@echo ""
	@echo "  Prop Bet Challenge — Docker management"
	@echo ""
	@echo "  make deploy      Build images and (re)start all services"
	@echo "  make up          Start services without rebuilding"
	@echo "  make down        Stop and remove containers"
	@echo "  make restart     Restart all running services"
	@echo "  make build       Rebuild Docker images only"
	@echo ""
	@echo "  make logs        Follow logs for all services"
	@echo "  make logs-api    Follow API server logs only"
	@echo "  make logs-web    Follow Nginx logs only"
	@echo ""
	@echo "  make db-shell    Open a psql prompt inside the database container"
	@echo "  make migrate     Re-run database migrations manually"
	@echo "  make ps          Show container status"
	@echo "  make prune       Remove stopped containers and dangling images"
	@echo ""

deploy:
	docker compose up -d --build

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

build:
	docker compose build

logs:
	docker compose logs -f --tail=100

logs-api:
	docker compose logs -f --tail=100 api

logs-web:
	docker compose logs -f --tail=100 web

db-shell:
	docker compose exec db psql -U propbet -d propbet

migrate:
	docker compose run --rm migrate

ps:
	docker compose ps

prune:
	docker compose down --remove-orphans
	docker image prune -f
