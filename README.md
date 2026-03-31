# Brain Thing

Personal knowledge base with MCP integration, wrapped in Electron.
## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build:win
npm run build:mac
npm run build:linux
```

## Release

1. Commit all changes
2. Bump version: `npm version patch` (or `minor` / `major`)
3. Push with tag: `git push --follow-tags`
4. GitHub Actions builds and creates a release with installer attached

To create a release manually (without waiting for CI):
```bash
gh release create v0.0.1 --title "v0.0.1" --notes "Release note here"
```
