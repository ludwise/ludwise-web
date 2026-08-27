---
ste-prose: descriptive
---

# Screen composition reference

The four screens of the LUDWISE consumer web product, as composed from the design-system components. Read these as **composition reference**: what goes on each screen, in what order, at what density, and which states are demonstrated.

| Screen | Route it maps to | What it demonstrates |
| --- | --- | --- |
| Sales | `/sales` | Card grid, active-filter chips, sort, density toggle, isolated ad container, pagination |
| Search results | `/games` | Facet sidebar with counts, skeleton loading, partial-provider warning, row list, empty state |
| Game detail | `/games/[slug]` | Tabs, offer table with best-offer marking and affiliate disclosure, price-history chart, observation table, per-source ratings, canonical metadata, sticky best-offer panel |
| Preferences | `/preferences` | Market vs language separation, notification switches, price-alert table, destructive confirmation modal, toast |

The sample data below is illustrative. **Do not treat it as a schema** — the canonical domain model does not exist yet.

---

## SalesScreen

```jsx
const { GameCard, Chip, Select, Button, PromoSlot, PriceSignal, Pagination, IconButton, Icon } = window.LUDWISEDesignSystem_b33af6;

function SalesScreen({ onOpenGame }) {
  const [filters, setFilters] = React.useState(["Discounted", "Under €40"]);
  const [dense, setDense] = React.useState(false);
  const drop = t => setFilters(filters.filter(x => x !== t));

  return (
    <div style={{ maxWidth: "var(--layout-max-width-wide)", margin: "0 auto", padding: "var(--space-8) var(--layout-gutter-desktop) var(--space-16)" }}>
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "var(--space-6)", flexWrap: "wrap", marginBottom: "var(--space-5)" }}>
        <div>
          <h1 className="lw-text-heading-xl" style={{ margin: 0 }}>Current sales</h1>
          <p className="lw-text-body-md" style={{ color: "var(--color-text-secondary)", marginTop: "var(--space-2)" }}>
            2,914 games discounted across 3 legitimate stores. Prices shown for the Eurozone market in EUR.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <Select options={[{ value: "d", label: "Discount, largest first" }, { value: "p", label: "Price, lowest first" }, { value: "r", label: "Rating, highest first" }]} size="sm" />
          <IconButton icon="grid-2x2" label="Grid view" pressed={!dense} onClick={() => setDense(false)} />
          <IconButton icon="list" label="List view" pressed={dense} onClick={() => setDense(true)} />
        </div>
      </header>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap", paddingBottom: "var(--space-5)", borderBottom: "1px solid var(--color-border-default)", marginBottom: "var(--space-6)" }}>
        <span className="lw-text-label-sm" style={{ color: "var(--color-text-tertiary)", marginRight: "var(--space-1)" }}>Filters</span>
        {filters.map(t => <Chip key={t} label={t} onRemove={() => drop(t)} />)}
        <Chip label="RPG" count={412} onClick={() => {}} />
        <Chip label="Steam" count={2914} onClick={() => {}} />
        {filters.length > 0 && <Button variant="ghost" size="sm" iconStart="rotate-ccw" onClick={() => setFilters([])}>Reset filters</Button>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "var(--space-8)", alignItems: "start" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: "var(--space-4)" }}>
          {window.LW_GAMES.map(g => (
            <GameCard key={g.id} title={g.title} variant={dense ? "compact" : "standard"}
              price={{ amount: g.price, referenceAmount: g.ref || undefined, currency: "EUR" }}
              discountPercentage={g.ref ? Math.round((1 - g.price / g.ref) * 100) : null}
              storeCount={g.stores} ratingSummary={g.rating}
              signal={g.signal === "observed-low" ? <PriceSignal kind="observed-low" observedSince="May 2026">Lowest observed</PriceSignal>
                : g.signal === "matches-low" ? <PriceSignal kind="matches-low">Matches lowest observed</PriceSignal> : null}
              href="#" onOpen={e => { e.preventDefault(); onOpenGame(g); }} />
          ))}
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", position: "sticky", top: 80 }}>
          <PromoSlot height={220}>Ad unit</PromoSlot>
          <div style={{ border: "1px solid var(--color-border-default)", borderRadius: "var(--radius-card)", padding: "var(--space-4)", background: "var(--color-surface-default)" }}>
            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", marginBottom: "var(--space-2)", color: "var(--color-text-secondary)" }}>
              <Icon name="shield-check" size="sm" />
              <span className="lw-text-label-md">Legitimate stores only</span>
            </div>
            <p className="lw-text-body-sm" style={{ color: "var(--color-text-secondary)", margin: 0 }}>
              LUDWISE compares first-party storefronts and authorised retailers. Key resellers and account marketplaces are out of scope.
            </p>
          </div>
        </aside>
      </div>

      <div style={{ marginTop: "var(--space-8)" }}>
        <Pagination page={1} pageCount={61} totalLabel="1–12 of 2,914 discounted games" />
      </div>
    </div>
  );
}

Object.assign(window, { SalesScreen });
```

---

## SearchScreen

```jsx
const { GameRow, Checkbox, Select, Button, EmptyState, Skeleton, InlineMessage, Pagination } = window.LUDWISEDesignSystem_b33af6;

function FilterGroup({ title, children }) {
  return (
    <section style={{ paddingBottom: "var(--space-4)", marginBottom: "var(--space-4)", borderBottom: "1px solid var(--color-border-subtle)" }}>
      <h3 className="lw-text-label-sm" style={{ color: "var(--color-text-tertiary)", margin: "0 0 var(--space-1)" }}>{title}</h3>
      {children}
    </section>
  );
}

function SearchScreen({ query, onOpenGame }) {
  const [loading, setLoading] = React.useState(false);
  const results = window.LW_GAMES.filter(g => g.title.toLowerCase().includes((query || "").toLowerCase()));

  React.useEffect(() => { setLoading(true); const t = setTimeout(() => setLoading(false), 450); return () => clearTimeout(t); }, [query]);

  return (
    <div style={{ maxWidth: "var(--layout-max-width-wide)", margin: "0 auto", padding: "var(--space-6) var(--layout-gutter-desktop) var(--space-16)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "var(--space-8)", alignItems: "start" }}>
        <aside style={{ position: "sticky", top: 80 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
            <span className="lw-text-heading-sm">Filters</span>
            <Button variant="ghost" size="sm" iconStart="rotate-ccw">Reset</Button>
          </div>
          <FilterGroup title="Store">
            <Checkbox label="Steam" count={2914} checked />
            <Checkbox label="GOG" count={1284} />
            <Checkbox label="Epic Games Store" count={640} />
          </FilterGroup>
          <FilterGroup title="Discount">
            <Checkbox label="Any discount" count={2914} checked />
            <Checkbox label="50% or more" count={1102} />
            <Checkbox label="75% or more" count={318} />
          </FilterGroup>
          <FilterGroup title="Price">
            <Checkbox label="Under €10" count={806} />
            <Checkbox label="€10 – €30" count={1240} />
            <Checkbox label="Over €30" count={868} />
          </FilterGroup>
          <FilterGroup title="Historical context">
            <Checkbox label="At lowest observed price" count={94} />
            <Checkbox label="Within 10% of observed low" count={287} />
          </FilterGroup>
        </aside>

        <div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-4)", flexWrap: "wrap", marginBottom: "var(--space-4)" }}>
            <h1 className="lw-text-heading-lg" style={{ margin: 0 }}>
              {query ? <>Results for &ldquo;{query}&rdquo;</> : "All games"}
            </h1>
            <Select options={[{ value: "r", label: "Relevance" }, { value: "p", label: "Price, lowest first" }, { value: "d", label: "Discount, largest first" }]} size="sm" />
          </div>

          <InlineMessage tone="warning" title="Epic Games Store prices may be out of date"
            action={<Button size="sm" variant="secondary" iconStart="refresh-cw">Retry now</Button>}
            style={{ marginBottom: "var(--space-4)" }}>
            The Epic provider last responded on 19 Aug 2026 at 08:20 CEST. Offers from other stores are current.
          </InlineMessage>

          <div style={{ border: "1px solid var(--color-border-default)", borderRadius: "var(--radius-card)", background: "var(--color-surface-default)", overflow: "hidden" }}>
            {loading ? (
              [0, 1, 2, 3, 4].map(i => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "64px 1fr 100px", gap: "var(--space-4)", alignItems: "center", padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--color-border-subtle)" }}>
                  <Skeleton height={43} radius="var(--radius-sm)" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}><Skeleton height={14} width="45%" /><Skeleton height={10} width="30%" /></div>
                  <Skeleton height={18} />
                </div>
              ))
            ) : results.length === 0 ? (
              <EmptyState icon="search" title={"No games match \u201c" + query + "\u201d"}
                action={<Button variant="secondary">Browse all games</Button>}>
                LUDWISE searched 41,208 canonical game titles. Check the spelling, or try the developer or publisher name.
              </EmptyState>
            ) : results.map(g => (
              <GameRow key={g.id} title={g.title} subtitle={g.dev + " · " + g.year}
                storeName={g.stores + " stores"} href="#"
                price={{ amount: g.price, referenceAmount: g.ref || undefined, currency: "EUR" }}
                discountPercentage={g.ref ? Math.round((1 - g.price / g.ref) * 100) : null}
                freshness={{ level: "fresh", label: "8 min ago" }} />
            ))}
          </div>

          {!loading && results.length > 0 && (
            <div style={{ marginTop: "var(--space-6)" }}>
              <Pagination page={1} pageCount={1} totalLabel={"1–" + results.length + " of " + results.length + " games"} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { SearchScreen });
```

---

## GameScreen

```jsx
const {
  Breadcrumbs, Tabs, GameArtwork, Price, DiscountBadge, PriceSignal, FreshnessIndicator,
  StoreIdentity, Rating, OfferRow, DataTable, KeyValueList, PriceHistoryChart, Button,
  Badge, Popover, ProvenanceNote, AffiliateDisclosure, InlineMessage, Icon
} = window.LUDWISEDesignSystem_b33af6;

function SectionHeading({ children, aside }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
      <h2 className="lw-text-heading-md" style={{ margin: 0 }}>{children}</h2>
      {aside}
    </div>
  );
}

function GameScreen({ onTrack }) {
  const [tab, setTab] = React.useState("offers");

  return (
    <div style={{ maxWidth: "var(--layout-max-width-standard)", margin: "0 auto", padding: "var(--space-5) var(--layout-gutter-desktop) var(--space-16)" }}>
      <Breadcrumbs items={[{ label: "Games", href: "#" }, { label: "RPG", href: "#" }, { label: "Cyberpunk 2077" }]} />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: "var(--space-8)", alignItems: "start", marginTop: "var(--space-5)" }}>
        <div>
          <GameArtwork title="Cyberpunk 2077" ratio="hero" />
          <h1 className="lw-text-heading-xl" style={{ margin: "var(--space-5) 0 var(--space-2)" }}>Cyberpunk 2077</h1>
          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "center", marginBottom: "var(--space-6)" }}>
            <span className="lw-text-body-md" style={{ color: "var(--color-text-secondary)" }}>CD PROJEKT RED · Released 10 Dec 2020</span>
            <Badge>RPG</Badge><Badge>Open world</Badge><Badge>Single-player</Badge>
          </div>

          <Tabs activeId={tab} onChange={setTab} tabs={[
            { id: "offers", label: "Offers", count: 5 },
            { id: "history", label: "Price history" },
            { id: "ratings", label: "Ratings", count: 3 },
            { id: "about", label: "About" }
          ]} />

          <div style={{ marginTop: "var(--space-6)" }}>
            {tab === "offers" && (
              <div>
                <SectionHeading aside={<span className="lw-text-caption" style={{ color: "var(--color-text-tertiary)" }}>Sorted by current price. Commission never affects this order.</span>}>
                  Current offers
                </SectionHeading>
                <div style={{ border: "1px solid var(--color-border-default)", borderRadius: "var(--radius-card)", overflow: "hidden" }}>
                  {window.LW_OFFERS.map((o, i) => (
                    <OfferRow key={i} store={o.store} edition={o.edition} best={o.best} affiliate={o.affiliate} unavailable={o.unavailable}
                      price={o.unavailable ? { state: "unavailable" } : { amount: o.amount, referenceAmount: o.ref, currency: "EUR" }}
                      freshness={o.fresh}
                      signal={o.best ? <PriceSignal kind="above-low" >€5.00 above observed low</PriceSignal> : null}
                      ctaLabel={"Open " + o.store.name} />
                  ))}
                </div>
                <div style={{ marginTop: "var(--space-4)" }}><AffiliateDisclosure /></div>
                <InlineMessage tone="neutral" title="About editions" style={{ marginTop: "var(--space-4)" }}>
                  Ultimate Edition includes content the Standard Edition does not. LUDWISE lists it separately rather than presenting it as a cheaper or more expensive version of the same product.
                </InlineMessage>
              </div>
            )}

            {tab === "history" && (
              <div>
                <SectionHeading aside={
                  <Popover align="end" width={300} trigger={<FreshnessIndicator level="fresh" label="Updated 8 min ago" absolute="21 Aug 2026, 15:12 CEST" />}>
                    <ProvenanceNote items={[
                      { label: "Source", value: "Steam Store API" },
                      { label: "Provider", value: "steam" },
                      { label: "Observed", value: "21 Aug 2026, 15:12 CEST" },
                      { label: "Last checked", value: "21 Aug 2026, 15:20 CEST" }
                    ]} />
                  </Popover>
                }>Observed price history</SectionHeading>
                <PriceHistoryChart currency="EUR" observedSince="4 May 2026" observedLow={24.99} height={280}
                  series={[{ label: "Steam", points: window.LW_HISTORY_STEAM }, { label: "GOG", points: window.LW_HISTORY_GOG }]} />
                <div style={{ marginTop: "var(--space-6)" }}>
                  <SectionHeading>Observations</SectionHeading>
                  <DataTable caption="Observed price changes for Cyberpunk 2077" density="compact" sortKey="date" sortDirection="desc"
                    columns={[
                      { key: "date", header: "Observed", sortable: true },
                      { key: "store", header: "Store" },
                      { key: "price", header: "Price", align: "end", sortable: true },
                      { key: "change", header: "Change", align: "end" }
                    ]}
                    rows={window.LW_OBSERVATIONS} />
                </div>
              </div>
            )}

            {tab === "ratings" && (
              <div>
                <SectionHeading>Ratings by source</SectionHeading>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "var(--space-3)" }}>
                  <Rating sourceName="Steam" displayValue="91%" summary="Very Positive" reviewCount={125304} normalized={91} />
                  <Rating sourceName="GOG" displayValue="4.4/5" reviewCount={2810} normalized={88} />
                  <Rating sourceName="Epic Games Store" displayValue="Not provided" confidence="This store does not publish user scores" />
                </div>
                <p className="lw-text-caption" style={{ color: "var(--color-text-tertiary)", marginTop: "var(--space-4)", maxWidth: "62ch" }}>
                  Each score is shown on the scale its source uses. The LUDWISE normalised figure is derived, not supplied by the store, and is never presented as the store's own number.
                </p>
              </div>
            )}

            {tab === "about" && (
              <div>
                <SectionHeading>Canonical metadata</SectionHeading>
                <KeyValueList columns={2} items={[
                  { label: "Developer", value: "CD PROJEKT RED" },
                  { label: "Publisher", value: "CD PROJEKT RED" },
                  { label: "Released", value: "10 Dec 2020" },
                  { label: "Genres", value: "RPG, Open world, Action" },
                  { label: "Operating systems", value: "Windows" },
                  { label: "Critic score", value: null }
                ]} />
                <p className="lw-text-caption" style={{ color: "var(--color-text-tertiary)", marginTop: "var(--space-4)" }}>
                  Canonical metadata resolved from Steam. Fields marked “Not provided” were supplied by no connected provider.
                </p>
              </div>
            )}
          </div>
        </div>

        <aside style={{ position: "sticky", top: 80, display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ border: "1px solid var(--color-border-default)", borderTop: "3px solid var(--color-accent-primary)", borderRadius: "var(--radius-card)", background: "var(--color-surface-default)", padding: "var(--space-4)" }}>
            <div className="lw-text-label-sm" style={{ color: "var(--color-text-tertiary)", marginBottom: "var(--space-3)" }}>Best current offer</div>
            <StoreIdentity name="Steam" verified />
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "var(--space-3)", marginTop: "var(--space-3)" }}>
              <Price amount={29.99} referenceAmount={59.99} currency="EUR" size="lg" kindLabel="Standard Edition" />
              <DiscountBadge percentage={50} emphasis="strong" />
            </div>
            <div style={{ marginTop: "var(--space-3)" }}>
              <PriceSignal kind="above-low" observedSince="May 2026">€5.00 above observed low</PriceSignal>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
              <Button variant="primary" fullWidth iconEnd="arrow-up-right">View on Steam</Button>
              <Button variant="secondary" fullWidth iconStart="bell" onClick={onTrack}>Track price</Button>
            </div>
            <div style={{ marginTop: "var(--space-3)" }}>
              <Popover width={280} trigger={<FreshnessIndicator level="fresh" label="Updated 8 min ago" absolute="21 Aug 2026, 15:12 CEST" />}>
                <ProvenanceNote items={[
                  { label: "Source", value: "Steam Store API" },
                  { label: "Observed", value: "21 Aug 2026, 15:12 CEST" },
                  { label: "Market", value: "Eurozone · EUR" }
                ]} />
              </Popover>
            </div>
          </div>

          <div style={{ border: "1px solid var(--color-border-default)", borderRadius: "var(--radius-card)", background: "var(--color-surface-default)", padding: "var(--space-4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", color: "var(--color-text-secondary)", marginBottom: "var(--space-2)" }}>
              <Icon name="clock-fading" size="sm" /><span className="lw-text-label-md">Observation window</span>
            </div>
            <p className="lw-text-body-sm" style={{ color: "var(--color-text-secondary)", margin: 0 }}>
              LUDWISE has recorded 412 price observations for this game since 4 May 2026. Prices before that date are outside our record.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

Object.assign(window, { GameScreen });
```

---

## AccountScreen

```jsx
const { Switch, Select, TextField, Radio, Button, Badge, Modal, Toast, DataTable, EmptyState } = window.LUDWISEDesignSystem_b33af6;

function Panel({ title, description, children }) {
  return (
    <section style={{ border: "1px solid var(--color-border-default)", borderRadius: "var(--radius-card)", background: "var(--color-surface-default)", padding: "var(--space-5)" }}>
      <h2 className="lw-text-heading-sm" style={{ margin: 0 }}>{title}</h2>
      {description && <p className="lw-text-body-sm" style={{ color: "var(--color-text-secondary)", margin: "var(--space-1) 0 var(--space-4)" }}>{description}</p>}
      {children}
    </section>
  );
}

function AccountScreen() {
  const [confirm, setConfirm] = React.useState(false);
  const [toast, setToast] = React.useState(false);
  const [alerts, setAlerts] = React.useState([
    { id: "a1", game: "Cyberpunk 2077", threshold: "€25.00", store: "Any store", status: "Watching" },
    { id: "a2", game: "Elden Ring", threshold: "€29.99", store: "Steam or GOG", status: "Watching" }
  ]);

  return (
    <div style={{ maxWidth: "var(--layout-max-width-standard)", margin: "0 auto", padding: "var(--space-8) var(--layout-gutter-desktop) var(--space-16)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-6)" }}>
        <h1 className="lw-text-heading-xl" style={{ margin: 0 }}>Preferences</h1>
        <Badge tone="accent">Early Supporter</Badge>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-5)", alignItems: "start" }}>
        <Panel title="Market and currency" description="Your commercial market decides which prices LUDWISE shows. It is separate from the language of the interface.">
          <Select label="Market" options={[{ value: "eu", label: "Eurozone — EUR" }, { value: "cz", label: "Czechia — CZK" }, { value: "uk", label: "United Kingdom — GBP" }]} />
          <div style={{ marginTop: "var(--space-4)" }}>
            <Select label="Interface language" options={[{ value: "en", label: "English" }]} hint="Additional languages are not available yet." />
          </div>
          <fieldset style={{ border: 0, padding: 0, margin: "var(--space-4) 0 0" }}>
            <legend className="lw-text-label-md" style={{ color: "var(--color-text-secondary)", marginBottom: "var(--space-1)" }}>Converted prices</legend>
            <Radio name="conv" label="Show store currency only" defaultChecked />
            <Radio name="conv" label="Also show a converted figure" description="Converted prices are always labelled as derived by LUDWISE." />
          </fieldset>
        </Panel>

        <Panel title="Notifications" description="LUDWISE sends at most one email a day, and never a marketing message you did not ask for.">
          <Switch label="Email price alerts" description="One digest a day, never more" defaultChecked />
          <Switch label="Sale round-up" description="Weekly, Thursday morning" />
          <Switch label="Wishlist availability" description="When a wishlisted game becomes available in your market" defaultChecked />
          <div style={{ marginTop: "var(--space-4)" }}>
            <TextField label="Email" defaultValue="daniel@example.com" iconStart="user" />
          </div>
        </Panel>

        <div style={{ gridColumn: "1 / -1" }}>
          <Panel title="Price alerts" description="An alert fires once when the current price crosses your threshold in your market.">
            {alerts.length === 0 ? (
              <EmptyState compact icon="bell" title="No price alerts yet" action={<Button variant="secondary">Browse sales</Button>}>
                Open any game and choose “Track price” to be told when it drops below a price you set.
              </EmptyState>
            ) : (
              <DataTable caption="Active price alerts" density="comfortable"
                columns={[
                  { key: "game", header: "Game" },
                  { key: "store", header: "Stores" },
                  { key: "threshold", header: "Threshold", align: "end" },
                  { key: "status", header: "Status" },
                  { key: "actions", header: "", align: "end" }
                ]}
                rows={alerts.map(a => ({
                  ...a,
                  status: <Badge tone="success">{a.status}</Badge>,
                  actions: <Button size="sm" variant="ghost" onClick={() => setConfirm(a)}>Delete</Button>
                }))} />
            )}
          </Panel>
        </div>
      </div>

      <Modal open={!!confirm} title="Delete this price alert?"
        description={confirm ? "You will stop receiving emails about " + confirm.game + "." : ""}
        onClose={() => setConfirm(false)}
        footer={<>
          <Button onClick={() => setConfirm(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => { setAlerts(alerts.filter(a => a.id !== confirm.id)); setConfirm(false); setToast(true); setTimeout(() => setToast(false), 4000); }}>Delete alert</Button>
        </>} />

      {toast && (
        <div style={{ position: "fixed", right: "var(--space-6)", bottom: "var(--space-6)", zIndex: 120 }}>
          <Toast tone="success" title="Price alert deleted" onDismiss={() => setToast(false)}>
            You will no longer receive emails about this game.
          </Toast>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { AccountScreen });
```

---

## Sample data

```js
/* Sample data for the LUDWISE UI kit. No artwork URLs are supplied, so every
   GameArtwork renders its designed "No artwork available" state. Drop real
   capsule URLs into artworkSrc to see the artwork treatment. */

const LW_GAMES = [
  { id: "cyberpunk-2077", title: "Cyberpunk 2077", dev: "CD PROJEKT RED", year: 2020, price: 29.99, ref: 59.99, stores: 3, rating: "Steam 91%", signal: "observed-low" },
  { id: "baldurs-gate-3", title: "Baldur's Gate 3", dev: "Larian Studios", year: 2023, price: 47.99, ref: 59.99, stores: 2, rating: "Steam 96%" },
  { id: "hades-ii", title: "Hades II", dev: "Supergiant Games", year: 2025, price: 24.99, ref: 29.99, stores: 2, rating: "Steam 95%" },
  { id: "elden-ring", title: "Elden Ring", dev: "FromSoftware", year: 2022, price: 34.99, ref: 59.99, stores: 2, rating: "Steam 92%", signal: "matches-low" },
  { id: "factorio", title: "Factorio", dev: "Wube Software", year: 2020, price: 30.00, ref: null, stores: 2, rating: "Steam 96%" },
  { id: "disco-elysium", title: "Disco Elysium — The Final Cut", dev: "ZA/UM", year: 2021, price: 9.99, ref: 39.99, stores: 3, rating: "Steam 93%", signal: "observed-low" },
  { id: "outer-wilds", title: "Outer Wilds", dev: "Mobius Digital", year: 2019, price: 8.74, ref: 24.99, stores: 2, rating: "Steam 96%" },
  { id: "stardew-valley", title: "Stardew Valley", dev: "ConcernedApe", year: 2016, price: 10.79, ref: 13.99, stores: 3, rating: "Steam 98%" },
  { id: "control-ultimate", title: "Control Ultimate Edition", dev: "Remedy Entertainment", year: 2020, price: 7.49, ref: 39.99, stores: 3, rating: "Steam 90%" },
  { id: "return-of-the-obra-dinn", title: "Return of the Obra Dinn", dev: "Lucas Pope", year: 2018, price: 9.99, ref: 19.99, stores: 2, rating: "Steam 97%" },
  { id: "terraria", title: "Terraria", dev: "Re-Logic", year: 2011, price: 4.99, ref: 9.99, stores: 2, rating: "Steam 97%" },
  { id: "hollow-knight", title: "Hollow Knight", dev: "Team Cherry", year: 2017, price: 7.24, ref: 14.99, stores: 2, rating: "Steam 97%" }
];

const LW_OFFERS = [
  { store: { name: "Steam", verified: true }, edition: "Standard Edition", amount: 29.99, ref: 59.99, best: true, fresh: { level: "fresh", label: "Updated 8 min ago", absolute: "21 Aug 2026, 15:12 CEST" }, affiliate: false },
  { store: { name: "GOG", verified: true }, edition: "Standard Edition", amount: 31.99, ref: 59.99, fresh: { level: "fresh", label: "Updated 21 min ago", absolute: "21 Aug 2026, 14:59 CEST" }, affiliate: true },
  { store: { name: "Epic Games Store", verified: true }, edition: "Standard Edition", amount: 35.99, ref: 59.99, fresh: { level: "stale", label: "Last checked 2 days ago", absolute: "19 Aug 2026, 08:20 CEST" } },
  { store: { name: "GOG", verified: true }, edition: "Ultimate Edition", amount: 49.99, ref: 79.99, fresh: { level: "fresh", label: "Updated 21 min ago" } },
  { store: { name: "Humble Bundle", verified: true }, edition: "Standard Edition", amount: null, ref: null, unavailable: true, fresh: { level: "unavailable", label: "Store not responding" } }
];

const LW_HISTORY_STEAM = [
  ["2026-05-04", 59.99], ["2026-05-22", 59.99], ["2026-06-01", 44.99], ["2026-06-26", 44.99],
  ["2026-07-11", 29.99], ["2026-07-30", 39.99], ["2026-08-12", 29.99], ["2026-08-21", 29.99]
].map(([date, amount]) => ({ date, amount }));

const LW_HISTORY_GOG = [
  ["2026-05-04", 59.99], ["2026-06-10", 49.99], ["2026-07-11", 34.99], ["2026-08-21", 31.99]
].map(([date, amount]) => ({ date, amount }));

const LW_OBSERVATIONS = [
  { id: 1, date: "21 Aug 2026", store: "GOG", price: "€31.99", change: "−8.6%" },
  { id: 2, date: "12 Aug 2026", store: "Steam", price: "€29.99", change: "−25.0%" },
  { id: 3, date: "30 Jul 2026", store: "Steam", price: "€39.99", change: "+33.3%" },
  { id: 4, date: "11 Jul 2026", store: "Steam", price: "€29.99", change: "−33.3%" },
  { id: 5, date: "1 Jun 2026", store: "Steam", price: "€44.99", change: "−25.0%" },
  { id: 6, date: "4 May 2026", store: "Steam", price: "€59.99", change: "First observation" }
];

Object.assign(window, { LW_GAMES, LW_OFFERS, LW_HISTORY_STEAM, LW_HISTORY_GOG, LW_OBSERVATIONS });
```
