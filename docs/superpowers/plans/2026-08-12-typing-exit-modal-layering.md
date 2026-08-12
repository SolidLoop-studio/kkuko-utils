# Typing Practice Exit Modal Layering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the blurred typing-practice background while ensuring the exit confirmation backdrop and panel always render above the WPM statistics strip and all game content.

**Architecture:** Retain the existing `KkutuMenu` ownership and fixed-backdrop `ConfirmModal` structure. Replace the unsupported Tailwind 3 `z-60` class with the arbitrary-value utility `z-[60]`, and protect that layer contract with a focused component regression test.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 3.4, Jest 30, Testing Library

## Global Constraints

- Keep the existing blurred and disabled typing-practice background while exit confirmation is open.
- Preserve all existing confirm, cancel, result, and focus behavior.
- Do not redesign the modal, change the live statistics layout, introduce a portal, or modify global Tailwind configuration.
- Do not manually edit `src/app/types/database.types.ts`.
- Use camelCase for variables/functions and PascalCase for components and types.

---

## File Structure

- `src/app/mini-game/game/components/ConfirmModal.tsx`: owns the mini-game confirmation backdrop, content, and stacking layer.
- `src/__tests__/mini-game/game/components/ConfirmModal.test.tsx`: verifies visible modal behavior and the supported Tailwind layer contract.

### Task 1: Place the Mini-Game Confirmation Modal Above Blurred Game Content

**Files:**
- Modify: `src/app/mini-game/game/components/ConfirmModal.tsx:12`
- Test: `src/__tests__/mini-game/game/components/ConfirmModal.test.tsx`

**Interfaces:**
- Consumes: existing `ConfirmModal` props `{ message: string; onConfirm: () => void; onCancel: () => void }`.
- Produces: the same component API, with its fixed root assigned Tailwind class `z-[60]` so generated CSS applies `z-index: 60`.

- [x] **Step 1: Write the failing regression test**

Add this test inside the existing `describe('ConfirmModal', ...)` block. The production regression it catches is replacing the supported `z-[60]` class with unsupported `z-60`, which removes the intended modal layer from generated Tailwind CSS.

```tsx
it('renders above later stacking contexts used by the blurred game surface', () => {
    const { container } = render(
        <>
            <ConfirmModal message="Test" onConfirm={() => {}} onCancel={() => {}} />
            <div data-testid="blurred-game-surface" className="blur-sm">WPM</div>
        </>,
    );

    expect(container.firstElementChild).toHaveClass('fixed', 'z-[60]');
    expect(screen.getByTestId('blurred-game-surface')).toHaveClass('blur-sm');
});
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx jest src/__tests__/mini-game/game/components/ConfirmModal.test.tsx --runInBand
```

Expected: FAIL because the modal root has `z-60` instead of `z-[60]`. Existing callback and rendering tests should still pass.

- [x] **Step 3: Apply the minimal production fix**

In `ConfirmModal.tsx`, change only the root backdrop class:

```tsx
<div className="fixed inset-0 backdrop-blur-md bg-black/30 dark:bg-black/40 flex items-center justify-center z-[60]" onClick={onCancel}>
```

Do not change the modal DOM structure, callbacks, colors, dimensions, or blur behavior.

- [x] **Step 4: Run focused modal and exit-flow tests and verify GREEN**

Run:

```bash
npx jest src/__tests__/mini-game/game/components/ConfirmModal.test.tsx src/__tests__/mini-game/game/components/KkutuMenu.test.tsx src/__tests__/mini-game/game/typing-practice/TypingPracticeBody.test.tsx --runInBand
```

Expected: all tests PASS with no unexpected warnings or errors.

- [x] **Step 5: Verify generated styling and static checks**

Run:

```bash
npm run build
rg -n --fixed-strings '.z-\\[60\\]' .next/static
npm run lint
npx tsc --noEmit --incremental false
git diff --check
```

Expected:

- Production build succeeds.
- Generated CSS contains the escaped `.z-\\[60\\]` selector with `z-index: 60`.
- Lint, TypeScript, and whitespace checks pass. If the repository's existing `next lint` script is incompatible with Next.js 15, record the exact failure and run the configured ESLint CLI against the two changed source/test files instead.

- [x] **Step 6: Commit the tested fix**

```bash
git add src/app/mini-game/game/components/ConfirmModal.tsx src/__tests__/mini-game/game/components/ConfirmModal.test.tsx docs/superpowers/plans/2026-08-12-typing-exit-modal-layering.md
git commit -m "fix: keep typing exit modal above game stats"
```
