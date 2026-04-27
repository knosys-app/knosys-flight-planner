import type { FC } from 'react';
import type { AeroSourceId } from '../../data/multi-source-aero-data';
import { getMultiSourceAeroData } from '../../data/multi-source-aero-data';

export interface AttributionFooterProps {
  source: AeroSourceId;
}

/**
 * Thin muted line at the bottom of the place card. Updates with the
 * active source's attribution. Settings panel additionally lists every
 * source's full license under "About data".
 */
export const AttributionFooter: FC<AttributionFooterProps> = ({ source }) => {
  const meta = getMultiSourceAeroData().getMeta(source);
  return (
    <div className="kfp-place-attribution" role="contentinfo">
      {meta.attribution}
    </div>
  );
};
