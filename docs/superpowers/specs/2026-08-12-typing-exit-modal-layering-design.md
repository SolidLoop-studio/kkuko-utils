# Typing Practice Exit Modal Layering Design

## Overview

When the user presses `나가기` during typing practice, the exit confirmation backdrop blurs the game surface. The live statistics strip (`WPM`, `분당타자수`, `정확도`, and `콤보`) can then paint above part of the confirmation modal.

The mini-game `ConfirmModal` currently uses Tailwind class `z-60`. Tailwind CSS 3.4 does not include `60` in its default z-index scale, and this repository does not extend that scale. Consequently, no CSS rule is generated for `z-60`. The blurred typing-practice surface creates a stacking context and is rendered after the menu that owns the modal, so parts of that surface can cover the modal.

## Goals

- Keep the existing blurred and disabled typing-practice background while exit confirmation is open.
- Render the complete confirmation backdrop and content above the typing target, input, and live statistics.
- Preserve all existing confirm, cancel, result, and focus behavior.
- Keep the change limited to the shared mini-game confirmation modal and its focused regression test.

## Non-Goals

- Do not redesign the exit confirmation modal.
- Do not remove or change the background blur.
- Do not change the typing-practice statistics layout.
- Do not introduce a portal or migrate the modal to another dialog library.
- Do not change global Tailwind configuration.

## Approaches Considered

### Use an arbitrary z-index utility (recommended)

Replace `z-60` with `z-[60]`. Tailwind 3 generates arbitrary-value utilities, so the modal receives the intended `z-index: 60`. This is the smallest change and makes the existing intent explicit without affecting unrelated components.

### Extend the Tailwind z-index scale

Add `60` to `theme.extend.zIndex` and retain `z-60`. This also works, but changes global styling configuration to support a value used by one component.

### Render the modal through a portal

Move the modal under `document.body`, eliminating dependence on its menu ancestor and sibling paint order. This is more robust for complex nesting but expands scope, requires lifecycle and accessibility consideration, and is unnecessary for this isolated layering defect.

## Chosen Design

Use `z-[60]` on the fixed backdrop of `src/app/mini-game/game/components/ConfirmModal.tsx`. The fixed backdrop already covers the viewport and contains the dialog content, so assigning a generated z-index to that root places both backdrop and content above the later-rendered blurred game surface.

No changes are needed in `TypingPracticeBody`: `blur-sm`, `pointer-events-none`, `select-none`, input blur, and read-only behavior remain active while confirmation is open.

## Testing

Add a focused `ConfirmModal` regression test that renders a later sibling with its own stacking context and verifies the modal root has the generated arbitrary z-index utility. The production change that should make this test fail is replacing the supported modal layer class with an unsupported or lower layer class.

Run:

- `npx jest src/__tests__/mini-game/game/components/ConfirmModal.test.tsx`
- Relevant mini-game typing-practice and menu tests
- `npm run lint`
- `npx tsc --noEmit --incremental false`
- `git diff --check`

## Acceptance Criteria

- Opening exit confirmation during typing practice keeps the game surface blurred.
- The WPM statistics strip and all other game content remain below the confirmation backdrop and panel.
- Confirm and cancel continue to run their existing callbacks.
- Focused modal and typing-practice tests pass.
