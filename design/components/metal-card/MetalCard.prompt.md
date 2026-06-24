The brushed-metal surface behind every tactile element. Wrap any content; choose the sweep behaviour for the context.

```jsx
<MetalCard sweep="hover">      {/* grid card: sweep on hover */}
  <span style={{fontFamily:'var(--fx-font-mono)',fontSize:34,color:'var(--fx-silver-bright)'}}>01</span>
  <h3>Make your deposit</h3>
  <p style={{color:'var(--fx-text-2)'}}>Deposit via secure transfer.</p>
</MetalCard>

<MetalCard sweep="loop" radius="var(--fx-radius-3xl)">  {/* hero/CTA: continuous */}
  …
</MetalCard>
```

- `sweep`: `hover` (grid cards) · `loop` (hero/CTA panels) · `none`
- For the floating hero look, wrap in a parent with the `fx-float` / `fx-card-in` animations.
