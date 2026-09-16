/**
 * The site-level control that changes the visitor pricing region.
 *
 * A Popover that holds one native POST form. The `/region` page checks the
 * choice and saves it. The one selector offers regions, never a market or a
 * currency. The currency is shown as a fact of the chosen region, and nobody
 * can edit it.
 *
 * Apply submits the choice. Cancel, Escape and an outside click close the
 * panel and discard it.
 */
import { useId, useState } from 'react';

import type { RegionOption } from '../../lib/formatting/region.js';
import { Select } from '../forms/Select.js';
import { Popover } from '../overlays/Popover.js';
import './RegionControl.css';

export interface RegionControlCopy {
  /** Read before the codes by assistive technology, for example "Region:". */
  readonly triggerPrefix: string;
  readonly heading: string;
  /** Why this region is active, for the source the request resolved. */
  readonly source: string;
  /** What applying a different region does to the page. */
  readonly refresh: string;
  readonly selectLabel: string;
  readonly currencyLabel: string;
  readonly noConversion: string;
  readonly apply: string;
  readonly cancel: string;
}

export interface RegionControlProps {
  /** The active region's name, for example "Germany". */
  readonly name: string;
  /** The visible label, for example "DE · EUR". */
  readonly codes: string;
  readonly currentCountryCode: string;
  readonly options: readonly RegionOption[];
  /** Where the form posts the choice. */
  readonly action: string;
  /** The path and query to come back to after a save. */
  readonly returnTo: string;
  readonly copy: RegionControlCopy;
}

export function RegionControl({
  name,
  codes,
  currentCountryCode,
  options,
  action,
  returnTo,
  copy,
  align = 'start',
}: RegionControlProps & { readonly align?: 'start' | 'end' | undefined }) {
  const [countryCode, setCountryCode] = useState(currentCountryCode);
  const headingId = useId();
  const currencyId = useId();
  const chosen = options.find((option) => option.countryCode === countryCode);

  return (
    <Popover
      align={align}
      width={320}
      onOpenChange={(open) => {
        if (!open) setCountryCode(currentCountryCode);
      }}
      trigger={
        // The accessible name holds the visible codes, so a voice command
        // that reads the label out still reaches the button (WCAG 2.5.3).
        <span className="lw-region-control__trigger">
          <span className="lw-visually-hidden">
            {copy.triggerPrefix} {name},{' '}
          </span>
          <span className="lw-region-control__codes">{codes}</span>
        </span>
      }
    >
      {({ close }) => (
        <form
          method="post"
          action={action}
          className="lw-region-control"
          aria-labelledby={headingId}
        >
          <h2 id={headingId} className="lw-region-control__heading">
            {copy.heading}
          </h2>
          <p className="lw-region-control__text">{copy.source}</p>
          <input type="hidden" name="return" value={returnTo} />
          <Select
            label={copy.selectLabel}
            name="country"
            options={options.map((option) => ({ value: option.countryCode, label: option.label }))}
            value={countryCode}
            onChange={(event) => setCountryCode(event.target.value)}
          />
          <p className="lw-region-control__currency">
            <span id={currencyId}>{copy.currencyLabel}</span>
            <output aria-labelledby={currencyId}>{chosen?.currencyCode}</output>
          </p>
          <p className="lw-region-control__text">{copy.refresh}</p>
          <p className="lw-region-control__text">{copy.noConversion}</p>
          <div className="lw-region-control__actions">
            <button type="submit" className="lw-region-control__apply">
              {copy.apply}
            </button>
            <button type="button" className="lw-region-control__cancel" onClick={close}>
              {copy.cancel}
            </button>
          </div>
        </form>
      )}
    </Popover>
  );
}
