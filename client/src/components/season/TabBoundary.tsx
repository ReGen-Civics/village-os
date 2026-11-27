/**
 * One tab of the season page that failed to draw stays one tab that failed:
 * its own panel shows the failed-read tile with "Try again", and the hero, the
 * steps and the other tabs carry on (QA round 1: a malformed suggestions answer
 * took the whole page down). Try again draws the tab afresh, which reads it again.
 */
import { Component, type ReactNode } from "react";
import ReadFailed from "./ReadFailed";

interface State {
  failed: boolean;
  attempt: number;
}

export default class TabBoundary extends Component<
  { message: string; children: ReactNode },
  State
> {
  state: State = { failed: false, attempt: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[season] a tab failed to draw", error);
  }

  render() {
    if (this.state.failed) {
      return (
        <ReadFailed
          message={this.props.message}
          onRetry={() =>
            this.setState(s => ({ failed: false, attempt: s.attempt + 1 }))
          }
        />
      );
    }
    return (
      <div key={this.state.attempt} className="space-y-5">
        {this.props.children}
      </div>
    );
  }
}
