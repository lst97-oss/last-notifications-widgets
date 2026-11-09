// Browser harness for scripts/check-bell.ts, the Angular port. Same globals, query params and DOM as the React fixture
// (scripts/fixtures/bell-page.tsx), so every scenario runs unchanged. The partial-compilation output loads through JIT,
// which needs @angular/compiler first. Bundled with tsup, not Bun's bundler.
import '@angular/compiler'
import { Component, signal } from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'

import {
  NotificationBellComponent,
  NotificationBellUnavailableComponent,
  type Theme,
} from '../dist/fesm2022/last-notifications-widgets-angular.mjs'

declare global {
  interface Window {
    __setSession: (session: string | null) => void
    __setTheme: (theme: Theme) => void
    __errors: { source: string; code: string }[]
  }
}

const params = new URLSearchParams(location.search)
const apiBase = params.get('api') ?? ''

// The host would mint this from its own session; a failed request throws, as the README tells hosts to.
async function tokenFor(session: string | null): Promise<string | null> {
  const response = await fetch(`${apiBase}/api/notifications-token?session=${encodeURIComponent(session ?? '')}`)
  if (!response.ok) throw new Error(`token request failed (${response.status})`)
  return ((await response.json()) as { token: string | null }).token
}

window.__errors = []

class Fixture {
  readonly apiBase = apiBase
  readonly session = signal<string | null>(params.get('session'))
  readonly theme = signal<Theme>((params.get('theme') ?? 'system') as Theme)
  readonly themeVars = { vars: { destructive: 'rgb(0, 128, 0)' } }
  readonly unavailable = params.get('unavailable') === '1'

  // Reads the session at call time, so a session change is picked up by the next token request.
  readonly getToken = () => tokenFor(this.session())
  readonly onError = (error: { source: string; code: string }) =>
    window.__errors.push({ source: error.source, code: error.code })
  readonly retried = () =>
    document.body.setAttribute('data-retried', String(Number(document.body.dataset.retried ?? 0) + 1))

  constructor() {
    window.__setSession = (value) => this.session.set(value)
    window.__setTheme = (value) => this.theme.set(value)
  }
}

Component({
  selector: 'fixture-root',
  imports: [NotificationBellComponent, NotificationBellUnavailableComponent],
  template: `
    @if (unavailable) {
      <ln-notification-bell-unavailable [theme]="theme()" [themeVars]="themeVars" (retry)="retried()" />
    } @else {
      <ln-notification-bell
        [baseUrl]="apiBase"
        appKey="app-1"
        [session]="session()"
        [getToken]="getToken"
        (error)="onError($event)"
        [theme]="theme()"
        [themeVars]="themeVars"
      />
    }
  `,
})(Fixture)

const host = document.createElement('fixture-root')
document.getElementById('root')?.append(host)
void bootstrapApplication(Fixture)
