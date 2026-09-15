/**
 * The site-level control that changes the visitor pricing region.
 *
 * A Popover that holds one native POST form. The `/region` page checks the
 * choice and saves it. The one selector offers regions, never a market or a
 * currency. The currency is shown as a fact of the chosen region, and nobody
 * can edit it.
 */
import { useId, useState } from 'react';

import type { RegionOption } from '../../lib/formatting/region.js';
import { Select } from '../forms/Select.js';
import { Popover } from '../overlays/Popover.js';
import './RegionControl.css';

export interface RegionControlCopy {
  /** Read before the label by assistive technology, for example "Region:". */
  readonly triggerPrefix: string;
  readonly heading: string;
  readonly explanation: string;
  readonly selectLabel: string;
  readonly currencyLabel: string;
  readonly noConversion: string;
  readonly save: string;
}

export interface RegionControlProps {
  /** The active region, for example "Germany · EUR". */
  readonly label: string;
  readonly currentCountryCode: string;
  readonly options: readonly RegionOption[];
  /** Where the form posts the choice. */
  readonly action: string;
  /** The path and query to come back to after a save. */
  readonly returnTo: string;
  readonly copy: RegionControlCopy;
}

export function RegionControl({
  label,
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
      trigger={
        <span className="lw-region-control__trigger">
          <span className="lw-visually-hidden">{copy.triggerPrefix} </span>
          {label}
        </span>
      }
    >
      <form method="post" action={action} className="lw-region-control" aria-labelledby={headingId}>
        <h2 id={headingId} className="lw-region-control__heading">
          {copy.heading}
        </h2>
        <p className="lw-region-control__text">{copy.explanation}</p>
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
        <p className="lw-region-control__text">{copy.noConversion}</p>
        <button type="submit" className="lw-region-control__save">
          {copy.save}
        </button>
      </form>
    </Popover>
  );
}
