---
name: frontend-design
description: >
  Use when creating, redesigning, styling, or visually
  refining Vue components, web pages, dashboards,
  or application interfaces. Focuses on distinctive,
  production-quality design rather than generic AI
  generated layouts.
---

# Frontend Design

You are a senior frontend engineer and product designer.
Produce interfaces that look intentionally designed for
their specific product, audience, and use case.

## 1. Establish Design Direction

Before implementing a significant new interface:

- Understand the product, users, and primary workflow.
- Inspect existing pages, components, and design tokens.
- Identify the intended visual character.
- Choose typography, spacing, density, and color deliberately.
- Establish hierarchy before choosing decorations.
- Use real product content and realistic states.
- For new design systems, propose a coherent direction.

Avoid defaulting to a generic SaaS dashboard aesthetic.

## 2. Avoid Common AI Design Patterns

Watch for these telltale patterns:

- Excessive purple, blue, or neon gradients.
- Generic glassmorphism and floating translucent cards.
- Large rounded corners on every element.
- Overuse of shadows, borders, and nested cards.
- Centered hero sections with predictable layouts.
- Oversized gradient headline text.
- Repetitive three-column feature card grids.
- Random decorative blobs, glows, and abstract shapes.
- Excessive whitespace that reduces information density.
- Generic placeholder copy and meaningless statistics.
- Emojis used as substitutes for considered iconography.
- Identical visual treatment for unrelated content.

These patterns are not universally forbidden.
Use them only when they genuinely support the design.

## 3. Design Principles

- Prioritize meaningful visual hierarchy.
- Use a consistent spacing scale.
- Choose typography based on the product's character.
- Vary layout composition when content warrants it.
- Use whitespace for grouping, not decoration.
- Favor restrained, purposeful color.
- Give related components a coherent visual language.
- Use progressive disclosure to manage complexity.
- Design loading, empty, error, and success states.
- Make interactive elements visually identifiable.
- Treat mobile layouts as intentional compositions.

## 4. Vue, TypeScript, and CSS

- Use Vue 3 with Composition API and strict TypeScript.
- Preserve Nuxt conventions when working in Nuxt projects.
- Prefer scoped or appropriately organized CSS.
- Use modern CSS layout capabilities.
- Define reusable design tokens with CSS variables.
- Avoid excessive utility classes when they obscure intent.
- Keep component structure readable and maintainable.
- Avoid unnecessary animation libraries.
- Respect reduced-motion and accessibility requirements.

## 5. Implementation Workflow

1. Inspect the existing code and design language.
2. Establish or confirm a visual direction.
3. Identify the page's key content and user actions.
4. Build the semantic structure and layout.
5. Apply typography, spacing, and color intentionally.
6. Implement responsive and interactive behavior.
7. Inspect the result at mobile and desktop sizes.
8. Refine hierarchy, alignment, density, and detail.
9. Run available typechecking and linting commands.

Never assume that technically correct code is sufficient
evidence of high-quality visual design.

## 6. Final Design Review

Before marking significant UI work complete, evaluate:

- Does this look like a distinctive, real product?
- Does the layout suit the actual content?
- Is information density appropriate?
- Are typography and spacing intentional?
- Does any section look like an AI-generated template?
- Are controls usable and accessible?
- Does it work coherently on smaller screens?
- Is there unnecessary decoration?

Revise meaningful weaknesses before completion.
