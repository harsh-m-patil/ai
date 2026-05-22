import { useMemo, useState } from "react";

import {
  EvilBarChart,
  Bar as TokenBar,
  Grid as TokenGrid,
  Tooltip as TokenTooltip,
  XAxis as TokenXAxis,
  YAxis as TokenYAxis,
} from "@/components/evilcharts/charts/bar-chart";
import {
  EvilComposedChart,
  Bar as ChartBar,
  Grid as ChartGrid,
  Legend as ChartLegend,
  Line as ChartLine,
  Tooltip as ChartTooltip,
  XAxis as ChartXAxis,
  YAxis as ChartYAxis,
} from "@/components/evilcharts/charts/composed-chart";
import type {
  InferenceRequestInspection,
  InferenceRequestMetrics,
  ObservableInferenceRequest,
} from "@/lib/api";

export function ObservabilityScreen({
  inferenceRequests,
  selectedRequestId,
  onRequestSelect,
  metrics,
  inspection,
  metricsByRequestId = {},
  usageByRequestId = {},
}: {
  inferenceRequests: ObservableInferenceRequest[];
  selectedRequestId?: string;
  onRequestSelect?: (requestId: string) => void;
  metrics?: InferenceRequestMetrics;
  inspection?: InferenceRequestInspection;
  metricsByRequestId?: Record<string, InferenceRequestMetrics>;
  usageByRequestId?: Record<string, number | null>;
}) {
  const [hoveredRequestId, setHoveredRequestId] = useState<string | undefined>();
  const activeRequestId = hoveredRequestId ?? selectedRequestId ?? inferenceRequests[0]?.id;
  const selectedRequest =
    inferenceRequests.find((request) => request.id === activeRequestId) ?? inferenceRequests[0] ?? null;
  const usage =
    selectedRequest?.id === inspection?.inferenceRequest.id
      ? inspection.summary.usage
      : { totalTokens: selectedRequest ? usageByRequestId[selectedRequest.id] ?? null : null };
  const chartData = useMemo(
    () =>
      inferenceRequests
        .map((request, index) => ({
          id: request.id,
          requestLabel: request.id.slice(0, 8),
          totalDurationMs:
            metricsByRequestId[request.id]?.totalDurationMs ?? computeDurationFromRequest(request),
          firstTokenLatencyMs: metricsByRequestId[request.id]?.firstTokenLatencyMs,
          totalTokens: usageByRequestId[request.id],
          order: inferenceRequests.length - index,
        }))
        .reverse(),
    [inferenceRequests, metricsByRequestId, usageByRequestId],
  );
  const activeMetrics = selectedRequest ? metricsByRequestId[selectedRequest.id] ?? metrics : metrics;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Observability</h1>
        <p className="text-sm text-muted-foreground">
          Recent persisted Inference Requests from the Runtime API.
        </p>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <div
          className="rounded-xl border border-border/50 bg-card p-4"
          onMouseLeave={() => setHoveredRequestId(undefined)}
        >
        <div className="mb-3">
          <h2 className="font-semibold">Latency trends</h2>
          <p className="text-sm text-muted-foreground">
            Total duration and first-token latency across recent completed Inference Requests.
          </p>
        </div>
        {chartData.length > 0 ? (
          <EvilComposedChart
            className="h-80"
            data={chartData}
            config={{
              totalDurationMs: {
                label: "Total duration",
                colors: {
                  light: ["#2563eb"],
                  dark: ["#60a5fa"],
                },
              },
              firstTokenLatencyMs: {
                label: "First-token latency",
                colors: {
                  light: ["#16a34a"],
                  dark: ["#4ade80"],
                },
              },
            }}
            chartProps={{
              margin: { top: 8, right: 12, left: 12, bottom: 8 },
              onMouseMove: (state) => {
                const index = getActiveTooltipIndex(state);
                setHoveredRequestId(index === null ? undefined : chartData[index]?.id);
              },
            }}
          >
            <ChartGrid />
            <ChartXAxis dataKey="requestLabel" />
            <ChartYAxis />
            <ChartTooltip />
            <ChartLegend />
            <ChartBar dataKey="totalDurationMs" variant="gradient" radius={8} />
            <ChartLine dataKey="firstTokenLatencyMs" glow strokeVariant="solid" />
          </EvilComposedChart>
        ) : (
          <p className="text-sm text-muted-foreground">No chart data yet.</p>
        )}
        </div>

        <div
          className="rounded-xl border border-border/50 bg-card p-4"
          onMouseLeave={() => setHoveredRequestId(undefined)}
        >
          <div className="mb-3">
            <h2 className="font-semibold">Token usage</h2>
            <p className="text-sm text-muted-foreground">
              Persisted token totals across recent completed Inference Requests.
            </p>
          </div>
          {chartData.some((entry) => entry.totalTokens !== null && entry.totalTokens !== undefined) ? (
            <EvilBarChart
              className="h-80"
              data={chartData}
              config={{
                totalTokens: {
                  label: "Total tokens",
                  colors: {
                    light: ["#7c3aed"],
                    dark: ["#a78bfa"],
                  },
                },
              }}
              chartProps={{
                margin: { top: 8, right: 12, left: 12, bottom: 8 },
                onMouseMove: (state) => {
                  const index = getActiveTooltipIndex(state);
                  setHoveredRequestId(index === null ? undefined : chartData[index]?.id);
                },
              }}
            >
              <TokenGrid />
              <TokenXAxis dataKey="requestLabel" />
              <TokenYAxis />
              <TokenTooltip />
              <TokenBar dataKey="totalTokens" variant="duotone" radius={8} />
            </EvilBarChart>
          ) : (
            <p className="text-sm text-muted-foreground">Token usage is not available yet for these requests.</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]">
        <div className="space-y-3">
          {inferenceRequests.map((request) => {
            const isSelected = request.id === activeRequestId;

            return (
              <button
                key={request.id}
                type="button"
                onClick={() => onRequestSelect?.(request.id)}
                className={[
                  "block w-full rounded-xl border bg-card p-4 text-left transition-colors",
                  isSelected ? "border-primary bg-primary/5" : "border-border/50",
                ].join(" ")}
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{request.provider}</span>
                  <span className="text-muted-foreground">{request.model}</span>
                  <span className="rounded-full border px-2 py-0.5 text-xs">{request.status}</span>
                </div>
                <p className="mt-2 font-mono text-xs text-muted-foreground">{request.id}</p>
              </button>
            );
          })}
        </div>

        <aside className="rounded-xl border border-border/50 bg-card p-4">
          {selectedRequest ? (
            <div className="space-y-4 text-sm">
              <div>
                <h2 className="font-semibold">Request detail</h2>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{selectedRequest.id}</p>
              </div>

              <dl className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">First-token latency</dt>
                  <dd>{formatMetric(activeMetrics?.firstTokenLatencyMs)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Total duration</dt>
                  <dd>{formatMetric(activeMetrics?.totalDurationMs)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Total tokens</dt>
                  <dd>{usage?.totalTokens ?? "—"}</dd>
                </div>
              </dl>

              <div className="space-y-2">
                <p className="text-muted-foreground">Context</p>
                <p className="font-mono text-xs">Conversation: {selectedRequest.conversationId}</p>
                <p className="font-mono text-xs">Turn: {selectedRequest.turnId}</p>
                <a
                  href={`/conversations/${selectedRequest.conversationId}`}
                  className="text-xs underline underline-offset-4"
                >
                  Open conversation
                </a>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No Inference Requests yet.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function formatMetric(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "—";
  }

  return `${value} ms`;
}

function computeDurationFromRequest(request: ObservableInferenceRequest) {
  if (!request.endedAt) {
    return null;
  }

  return new Date(request.endedAt).getTime() - new Date(request.startedAt).getTime();
}

function getActiveTooltipIndex(state: unknown) {
  if (!state || typeof state !== "object" || !("activeTooltipIndex" in state)) {
    return null;
  }

  const index = state.activeTooltipIndex;
  return typeof index === "number" ? index : null;
}
