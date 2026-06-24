Display helpers that compose the metal foundations.

```jsx
<SectionHeading kicker="01 — 02 — 03" title="How it works"
  lead="Three simple steps to put your capital to work." />

<StatTile label="Returns / month" value="$214.80" sub="▲ +8.4% / yr" />
<ProgressBar label="Subscriptions covered" value={86} />

<SubscriptionRow name="OpenAI" price="$20.00" paid />
<SubscriptionRow name="Linear" price="$8.00" paid={false} />

<Divider />
```

`SectionHeading` is the canonical section intro (embossed h2). `StatTile` wraps `MetalCard`.
`SubscriptionRow` lists tools paid by returns — stack several with `Divider`s between.
