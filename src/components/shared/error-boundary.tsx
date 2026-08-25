"use client";

import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in component tree:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-8 rounded-2xl glass-card border border-destructive/30 bg-destructive/5 text-center my-6 max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">
            Something went wrong
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            {this.state.error?.message || "An unexpected rendering error occurred."}
          </p>
          <Button
            size="sm"
            onClick={this.handleReset}
            variant="outline"
            className="gap-2 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
