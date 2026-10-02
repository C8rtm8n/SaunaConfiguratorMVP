import { useEffect } from 'preact/hooks';
import { AppCtx, STEPS, useAppState, type App as AppT } from './state.js';
import type { SaunaConfig } from '@sauna/core';
import { PriceBar, Stepper, Warnings } from './components/Panels.js';
import { ViewerPane } from './components/ViewerPane.js';
import { Step1Module } from './steps/Step1Module.js';
import { Step2Layout } from './steps/Step2Layout.js';
import { Step3Openings } from './steps/Step3Openings.js';
import { Step4Exterior } from './steps/Step4Exterior.js';
import { Step5Interior } from './steps/Step5Interior.js';
import { Step6Extras } from './steps/Step6Extras.js';
import { Step7Foundation } from './steps/Step7Foundation.js';
import { Step8Summary } from './steps/Step8Summary.js';
import type { I18nKey } from './i18n.js';

const STEP_VIEWS = [Step1Module, Step2Layout, Step3Openings, Step4Exterior, Step5Interior, Step6Extras, Step7Foundation, Step8Summary];

export function App(p: { base: Pick<AppT, 'env' | 'tenant' | 'i18n' | 'repos' | 'bridge'>; initial: SaunaConfig; notice?: string }) {
  const app = useAppState(p.base, p.initial);
  const { step, setStep, i18n, bridge, tenant } = app;
  const View = STEP_VIEWS[step - 1]!;
  // Read-only hook for e2e tests and support.
  (window as unknown as { __config: unknown }).__config = app.config;

  useEffect(() => {
    bridge.send('step_change', { step, name: i18n.t(`step.${step}` as I18nKey) });
    // Standalone only: inside an iframe scrollIntoView would also scroll the host page.
    if (step > 1 && !p.base.env.embedded) document.getElementById('wizard')?.scrollIntoView({ block: 'nearest' });
  }, [step]);
  useEffect(() => {
    bridge.send('ready', { tenant: tenant.slug });
  }, []);

  return (
    <AppCtx.Provider value={app}>
      <div class={`app${p.base.env.embedded ? ' embedded' : ''}`}>
        <header class="top">
          {tenant.theme.logoUrl ? <img src={tenant.theme.logoUrl} alt={tenant.name} class="logo" /> : <strong>{tenant.name}</strong>}
          <span class="muted">{i18n.t('app.title')}</span>
        </header>
        {p.notice && <p class="err">{p.notice}</p>}
        <main class="layout">
          <div class="col-viewer">
            <ViewerPane />
          </div>
          <div class="col-wizard" id="wizard">
            <Stepper />
            <PriceBar />
            <div class="step" data-step={step}>
              <View />
            </div>
            <Warnings />
            <nav class="nav">
              <button type="button" class="btn ghost" disabled={step === 1} onClick={() => setStep(step - 1)}>
                {i18n.t('nav.back')}
              </button>
              {step < STEPS && (
                <button type="button" class="btn primary" onClick={() => setStep(step + 1)}>
                  {i18n.t('nav.next')}
                </button>
              )}
            </nav>
          </div>
        </main>
      </div>
    </AppCtx.Provider>
  );
}
