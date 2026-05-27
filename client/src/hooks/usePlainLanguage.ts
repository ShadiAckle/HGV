import { useCallback, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { chartColors, chartLabelFontSize, plainPanelCopy, toPlainLabel } from '@shared/plainLanguage';

export function usePlainLanguage() {
  const { plainEnglish, togglePlainEnglish } = useAppContext();

  const label = useCallback((text: string) => toPlainLabel(text, plainEnglish), [plainEnglish]);

  const panelCopy = useCallback(
    (
      standard: { title: string; subtitle: string },
      plain: { title: string; subtitle: string },
    ) => plainPanelCopy(plainEnglish, standard, plain),
    [plainEnglish],
  );

  const charts = useMemo(
    () => ({
      colors: chartColors(plainEnglish),
      labelFontSize: chartLabelFontSize(plainEnglish),
      simplified: plainEnglish,
    }),
    [plainEnglish],
  );

  return {
    enabled: plainEnglish,
    toggle: togglePlainEnglish,
    label,
    panelCopy,
    charts,
    /** Pass to all insight API POST bodies */
    apiFlag: plainEnglish,
  };
}
