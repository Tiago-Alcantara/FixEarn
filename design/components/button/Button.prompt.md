Primary call-to-action; use `primary` (polished chrome) for the single key action, `secondary` (hairline outline) for an alternate, `ghost` for low-emphasis.

```jsx
<Button variant="primary" size="lg">Get started</Button>
<Button variant="secondary" as="a" href="#how">See how it works</Button>
```

- `variant`: `primary` | `secondary` | `ghost`
- `size`: `sm` | `md` | `lg`
- `as`: render as a link with `as="a" href="…"`
- Hover lifts + adds a silver glow on primary; respects the token motion timing.
