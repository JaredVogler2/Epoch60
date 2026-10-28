import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { downloadBackup } from '../game/backup';
import { clearSave } from '../game/persist';

/** True when this browser can create a WebGL context at all (checked once, before the 3D scene mounts). */
export function hasWebGL(): boolean {
  try {
    const cv = document.createElement('canvas');
    const gl = (cv.getContext('webgl2') ?? cv.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** Shown instead of a blank page when the browser has no WebGL. */
export function NoWebGL() {
  return (
    <div className="fatal" role="alert" data-testid="no-webgl">
      <h1>The valley needs 3D graphics</h1>
      <p>
        EPOCH draws its world with WebGL, which this browser has turned off or does not support. Turning on
        hardware acceleration in the browser settings, or opening the game in a current Safari, Chrome, Edge
        or Firefox, will bring it back.
      </p>
    </div>
  );
}

interface State {
  error: Error | null;
  /** "Start fresh" was pressed once: the next press erases the saved lineage. */
  erase: boolean;
}

/**
 * Last line of defence: a render error shows a way out instead of an empty page. Saves are untouched unless the
 * player asks to start fresh.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null, erase: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[epoch60] render failed', error, info.componentStack);
  }

  override render(): ReactNode {
    const e = this.state.error;
    if (!e) return this.props.children;
    return (
      <div className="fatal" role="alert" data-testid="fatal">
        <h1>The valley could not be drawn</h1>
        <p>
          Something went wrong while showing the game. Your saved civilization is kept unless you start fresh;
          a backup keeps a copy of it, your Codex and your run cards whatever happens.
        </p>
        <div className="title-row">
          <button type="button" className="btn primary" onClick={() => location.reload()}>
            Reload
          </button>
          <button type="button" className="btn" data-testid="fatal-export" onClick={() => downloadBackup()}>
            Export a backup
          </button>
          {this.state.erase ? (
            <button
              type="button"
              className="btn"
              data-testid="fatal-erase"
              onClick={() => {
                clearSave();
                location.reload();
              }}
            >
              Erase the saved lineage and start fresh
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              data-testid="fatal-fresh"
              onClick={() => this.setState({ erase: true })}
            >
              Start fresh…
            </button>
          )}
        </div>
        <p className="dim small">{String(e.message).slice(0, 200)}</p>
      </div>
    );
  }
}
