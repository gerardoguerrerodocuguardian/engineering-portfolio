.PHONY: install typecheck test ask eval eval-live mcp ci
install:
	npm install
typecheck:
	npm run typecheck
test:
	npm test
ask:
	npm run ask -- "$(Q)"
eval:
	npm run eval -- --provider fake
eval-live:
	npm run eval -- --provider anthropic
mcp:
	npm run mcp
ci: install typecheck test eval
