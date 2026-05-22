import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/evilcharts/charts/composed-chart", () => ({
  EvilComposedChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  Grid: () => null,
  Legend: () => null,
  Line: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

vi.mock("@/components/evilcharts/charts/bar-chart", () => ({
  EvilBarChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  Grid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

vi.mock("@tardis/ui/components/badge", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("@tardis/ui/components/card", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
}));

vi.mock("@tardis/ui/components/separator", () => ({
  Separator: () => <hr />,
}));

vi.mock("@tardis/ui/components/table", () => ({
  Table: ({ children }: { children: ReactNode }) => <table>{children}</table>,
  TableBody: ({ children }: { children: ReactNode }) => <tbody>{children}</tbody>,
  TableCell: ({ children }: { children: ReactNode }) => <td>{children}</td>,
  TableHead: ({ children }: { children: ReactNode }) => <th>{children}</th>,
  TableHeader: ({ children }: { children: ReactNode }) => <thead>{children}</thead>,
  TableRow: ({ children }: { children: ReactNode }) => <tr>{children}</tr>,
}));

vi.mock("@tardis/ui/components/tabs", () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: ReactNode }) => <button>{children}</button>,
}));

vi.mock("lucide-react", () => ({
  Activity: () => null,
  Clock: () => null,
  Hash: () => null,
  Zap: () => null,
}));

import { ObservabilityScreen } from "./observability-screen";

describe("ObservabilityScreen", () => {
  it("lists completed Inference Requests with provider, model, and status", () => {
    const html = renderToStaticMarkup(
      <ObservabilityScreen
        inferenceRequests={[
          {
            id: "inf_123",
            conversationId: "conv_123",
            turnId: "turn_123",
            attemptNumber: 1,
            provider: "openrouter",
            model: "openai/gpt-4o-mini",
            status: "completed",
            inputPreview: "hello",
            outputPreview: "world",
            startedAt: "2026-05-22T00:00:00.000Z",
            endedAt: "2026-05-22T00:00:01.000Z",
          },
        ]}
        selectedRequestId="inf_123"
        metrics={{
          inferenceRequestId: "inf_123",
          firstTokenLatencyMs: 120,
          totalDurationMs: 480,
          eventCount: 4,
        }}
        inspection={{
          inferenceRequest: {
            id: "inf_123",
            turnId: "turn_123",
            attemptNumber: 1,
            provider: "openrouter",
            model: "openai/gpt-4o-mini",
            status: "completed",
            inputPreview: "hello",
            outputPreview: "world",
            startedAt: "2026-05-22T00:00:00.000Z",
            endedAt: "2026-05-22T00:00:01.000Z",
          },
          events: [],
          summary: {
            eventCount: 4,
            firstTokenLatencyMs: 120,
            totalDurationMs: 480,
            usage: {
              totalTokens: 42,
            },
          },
        }}
      />,
    );

    expect(html).toContain("Observability");
    expect(html).toContain("openrouter");
    expect(html).toContain("openai/gpt-4o-mini");
    expect(html).toContain("completed");
    expect(html).toContain("inf_123");
    expect(html).toContain("120 ms");
    expect(html).toContain("480 ms");
    expect(html).toContain("42");
  });

  it("links an observed request back to its Conversation and Turn context", () => {
    const html = renderToStaticMarkup(
      <ObservabilityScreen
        inferenceRequests={[
          {
            id: "inf_123",
            conversationId: "conv_123",
            turnId: "turn_123",
            attemptNumber: 1,
            provider: "openrouter",
            model: "openai/gpt-4o-mini",
            status: "completed",
            inputPreview: "hello",
            outputPreview: "world",
            startedAt: "2026-05-22T00:00:00.000Z",
            endedAt: "2026-05-22T00:00:01.000Z",
          },
        ]}
        selectedRequestId="inf_123"
      />,
    );

    expect(html).toContain("conv_123");
    expect(html).toContain("turn_123");
    expect(html).toContain("/conversations/conv_123");
  });
});
