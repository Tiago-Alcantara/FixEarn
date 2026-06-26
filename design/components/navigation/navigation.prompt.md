Page-level navigation & chrome.

```jsx
<Header nav={['How it works','Services','Why Yield2Pay']} lang={lang} onLang={setLang} />

<Marquee items={['OpenAI','Anthropic','Notion','Figma','GitHub','Linear','Slack']} />

<Footer
  columns={[
    { title:'Product', links:['How it works','Services','Security'] },
    { title:'Company', links:['About','Contact','Careers'] },
    { title:'Legal',   links:['Terms','Privacy'] },
  ]} />
```

`Header` is sticky with backdrop-blur and embeds the EN/PT `SegmentedControl`. `Marquee`
duplicates its items for a seamless loop and pauses on hover.
