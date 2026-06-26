---
name: yield2pay-design
description: Use this skill to generate well-branded interfaces and assets for Yield2Pay, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping. Yield2Pay is a B2B fintech with a premium, monochrome black + silver "private bank" aesthetic built on brushed-metal surfaces.
user-invocable: true
---

Read the `readme.md` file within this skill, and explore the other available files
(`styles.css` + `tokens/` for the foundations, `components/` for React primitives,
`guidelines/` for specimen cards, `ui_kits/` for full-screen recreations).

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and
create static HTML files for the user to view, linking `styles.css` for the real tokens. If
working on production code, copy assets and read the rules here to design as an expert in the
Yield2Pay brand.

Core rules to never break:
- **Monochrome only** — near-black ink + polished silver. No vibrant hues.
- **Brushed metal** is the signature material (`--fx-metal` + grain + 1px metal edge + inner highlight).
- **Hanken Grotesk** for display/body (700, tight, embossed shadow on headings); **Geist Mono** for all data/labels/eyebrows.
- **Sentence case** prose; uppercase only for mono kickers. **No emoji.**
- Motion is restrained: entrances **fade**, life comes from the **light sweep** across metal and a slow float — never busy backgrounds. Respect `prefers-reduced-motion`.

If the user invokes this skill without other guidance, ask them what they want to build or
design, ask a few focused questions, and act as an expert designer who outputs HTML artifacts
_or_ production code depending on the need.
