SHELL := /usr/bin/env bash
DOCKER_COMPOSE ?= $(shell if docker compose version >/dev/null 2>&1; then printf 'docker compose'; elif command -v docker-compose >/dev/null 2>&1; then printf 'docker-compose'; else printf 'docker compose'; fi)
COMPOSE_ENV_FILE ?= $(shell if [ -f .env ]; then printf '%s' '--env-file .env'; elif [ -f .env.example ]; then printf '%s' '--env-file .env.example'; fi)

.PHONY: help install frontend-install db-up db-down backend-run frontend-run docker-up docker-config backend-test frontend-lint frontend-build frontend-e2e token-budget validate

help:
	@printf "InAlgo contributor commands\n"
	@printf "  make install          Install frontend dependencies\n"
	@printf "  make db-up            Start PostgreSQL with Docker Compose\n"
	@printf "  make backend-run      Run Spring Boot backend\n"
	@printf "  make frontend-run     Run Vite frontend\n"
	@printf "  make docker-up        Build and start the full Compose stack\n"
	@printf "  make docker-config    Validate Compose configuration\n"
	@printf "  make backend-test     Run backend tests\n"
	@printf "  make frontend-lint    Run frontend TypeScript check\n"
	@printf "  make frontend-build   Build frontend/electron bundle\n"
	@printf "  make frontend-e2e     Run Playwright tests\n"
	@printf "  make token-budget     Run source size guard\n"
	@printf "  make validate         Run backend test, frontend lint/build, and token budget\n"

install: frontend-install

frontend-install:
	cd desktop && npm install

db-up:
	$(DOCKER_COMPOSE) $(COMPOSE_ENV_FILE) up -d postgres

db-down:
	$(DOCKER_COMPOSE) $(COMPOSE_ENV_FILE) down

backend-run:
	cd backend && mvn spring-boot:run

frontend-run:
	cd desktop && npm run dev:renderer

docker-up:
	$(DOCKER_COMPOSE) $(COMPOSE_ENV_FILE) up --build

docker-config:
	$(DOCKER_COMPOSE) $(COMPOSE_ENV_FILE) config >/dev/null

backend-test:
	cd backend && mvn test

frontend-lint:
	cd desktop && npm run lint

frontend-build:
	cd desktop && npm run build

frontend-e2e:
	cd desktop && npm run test:e2e

token-budget:
	scripts/check-source-token-budget.sh

validate: backend-test frontend-lint frontend-build token-budget
