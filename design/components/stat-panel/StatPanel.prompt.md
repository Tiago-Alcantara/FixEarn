The investment panel that anchors the hero — reads as a portfolio/returns view, not a credit card. Composes `MetalCard` + `Badge` and draws a built-in growth chart.

```jsx
<StatPanel
  label="Capital working" status="Active"
  balance="$18,400.00" growth="+8.4% / yr"
  returns="$214.80" covered="7 tools"
/>
```

Localize all strings (PT-BR: `R$ 92.000,00`, `+8,4% / ano`, `Cobertas`). For the floating hero, wrap in a parent running `fx-card-in` then `fx-float`.
