# ContentForge

Reusable Duolingo-style microlearning course generator powered by Gemini.

## Location note

This package currently lives at `server/_core/contentforge/` so it's inside the
TypeScript build root. The directory is self-contained: copy/move it to
`packages/contentforge/` in any other project, add `@google/generative-ai` as a
dependency, and it works unchanged.

## Usage

```ts
import { ContentForge } from "./_core/contentforge"; // or "@contentforge/core"

const course = await ContentForge.generate({
  topic: "Treinamento NR-10 Basico",
  audience: "trabalhadores brasileiros",
  duration: 30,
  difficulty: "basico",
  language: "pt-BR",
  pedagogy: "duolingo",
  llmProvider: "gemini",
  llmApiKey: process.env.GEMINI_API_KEY!,
  onProgress: (p, msg) => console.log(`${p}% - ${msg}`),
});
```

## Architecture

1. `planner.ts` - outlines units + lesson titles (Gemini 2.5 Pro, falls back to Flash)
2. `generator.ts` - generates 6-8 blocks per lesson (Gemini 2.5 Flash)
3. `refiner.ts` - 10-question final exam (Gemini 2.5 Flash)
4. `agent.ts` - orchestrator, calls progress callback

## Block types

`concept`, `example`, `quick_check`, `multiple_choice`, `true_false`,
`fill_blank`, `drag_order`, `match_pairs`, `scenario_choice`, `reflection`.

See `types.ts` for each shape.
