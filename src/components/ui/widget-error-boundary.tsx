import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface State { error: Error | null; }

export class WidgetErrorBoundary extends Component<{ label: string; children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="flex flex-col items-center gap-2 px-6 py-10 text-center">
        <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
        <p className="text-sm font-medium">Couldn't render {this.props.label}</p>
        <p className="max-w-md break-all font-mono text-xs text-muted-foreground">
          {this.state.error.message}
        </p>
        <Button variant="outline" size="sm" onClick={() => this.setState({ error: null })}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
        </Button>
      </div>
    );
  }
}