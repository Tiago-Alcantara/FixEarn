Yield2Pay form controls — dark wells, silver focus, mono input text.

```jsx
<Input label="Deposit amount" prefix="$" placeholder="10,000" type="number"
       hint="Between $1,000 and $20,000" />
<Select label="Currency" options={['USD','BRL']} />
<Switch checked={on} onChange={setOn} label="Auto-pay subscriptions" />
<SegmentedControl size="sm" value={lang} onChange={setLang}
  options={[{value:'en',label:'EN'},{value:'pt',label:'PT'}]} />
```

`Input` numerics use the mono face. `SegmentedControl` doubles as the EN/PT toggle in the header.
