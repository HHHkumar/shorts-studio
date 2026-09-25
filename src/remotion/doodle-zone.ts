import React from 'react';

/**
 * Where a scene's text is allowed to sit.
 *
 *   'none'      - the whole frame, as every look but Doodle uses it.
 *   'text-top'  - portrait doodle scene: the top band, drawing below.
 *   'text-left' - landscape doodle scene: the left band, drawing beside.
 *
 * Its own module so that ui.tsx, which reads it, and DoodleStage, which sets
 * it, do not import each other.
 */
export type DoodleZone = 'none' | 'text-top' | 'text-left';

export const DoodleZoneContext = React.createContext<DoodleZone>('none');
