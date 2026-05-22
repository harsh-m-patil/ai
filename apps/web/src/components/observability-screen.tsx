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
import { Badge } from "@tardis/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@tardis/ui/components/card";
import { Separator } from "@tardis/ui/components/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@tardis/ui/components/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@tardis/ui/components/tabs";
import {
  Activity,
  Clock,
  Hash,
  Zap,
} from "lucide-react";

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
  const activeMetrics = selectedRequest ? metricsByRequestId[selectedRequest.id] ?? metrics : metrics;

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

  const summaryStats = useMemo(() => {
    const durations = chartData
      .map((d) => d.totalDurationMs)
      .filter((v): v is number => v !== null && v !== undefined);
    const latencies = chartData
      .map((d) => d.firstTokenLatencyMs)
      .filter((v): v is number => v !== null && v !== undefined);
    const tokens = chartData
      .map((d) => d.totalTokens)
      .filter((v): v is number => v !== null && v !== undefined);

    return {
      totalRequests: inferenceRequests.length,
      avgDuration: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
      avgLatency: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null,
      totalTokens: tokens.length ? tokens.reduce((a, b) => a + b, 0) : null,
    };
  }, [chartData, inferenceRequests.length]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Observability</h1>
        <p className="text-sm text-muted-foreground">
          Monitor inference performance, latency, and token usage across requests.
        </p>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Total Requests</CardDescription>
            <Hash className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.totalRequests}</div>
            <p className="text-xs text-muted-foreground">completed inference requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Avg Duration</CardDescription>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryStats.avgDuration !== null ? `${summaryStats.avgDuration} ms` : "—"}
            </div>
            <p className="text-xs text-muted-foreground">mean total duration</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Avg First Token</CardDescription>
            <Zap className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryStats.avgLatency !== null ? `${summaryStats.avgLatency} ms` : "—"}
            </div>
            <p className="text-xs text-muted-foreground">mean first-token latency</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Total Tokens</CardDescription>
            <Activity className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryStats.totalTokens !== null ? summaryStats.totalTokens.toLocaleString() : "—"}
            </div>
            <p className="text-xs text-muted-foreground">across all requests</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card onMouseLeave={() => setHoveredRequestId(undefined)}>
          <CardHeader>
            <CardTitle>Latency Trends</CardTitle>
            <CardDescription>
              Total duration and first-token latency across recent requests.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <EvilComposedChart
                className="h-72"
                data={chartData}
                config={{
                  totalDurationMs: {
                    label: "Total duration",
                    colors: { light: ["#2563eb"], dark: ["#60a5fa"] },
                  },
                  firstTokenLatencyMs: {
                    label: "First-token latency",
                    colors: { light: ["#16a34a"], dark: ["#4ade80"] },
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
              <p className="py-8 text-center text-sm text-muted-foreground">No chart data yet.</p>
            )}
          </CardContent>
        </Card>

        <Card onMouseLeave={() => setHoveredRequestId(undefined)}>
          <CardHeader>
            <CardTitle>Token Usage</CardTitle>
            <CardDescription>
              Persisted token totals across recent completed requests.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.some((entry) => entry.totalTokens !== null && entry.totalTokens !== undefined) ? (
              <EvilBarChart
                className="h-72"
                data={chartData}
                config={{
                  totalTokens: {
                    label: "Total tokens",
                    colors: { light: ["#7c3aed"], dark: ["#a78bfa"] },
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
              <p className="py-8 text-center text-sm text-muted-foreground">
                Token usage is not available yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Request Table + Detail Panel */}
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Inference Requests</CardTitle>
            <CardDescription>
              All completed requests from the Runtime API.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request ID</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inferenceRequests.map((request) => {
                  const isSelected = request.id === activeRequestId;
                  const reqMetrics = metricsByRequestId[request.id];
                  const reqTokens = usageByRequestId[request.id];

                  return (
                    <TableRow
                      key={request.id}
                      data-state={isSelected ? "selected" : undefined}
                      className="cursor-pointer"
                      onClick={() => onRequestSelect?.(request.id)}
                    >
                      <TableCell className="font-mono text-xs">{request.id.slice(0, 12)}</TableCell>
                      <TableCell>{request.provider}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{request.model}</TableCell>
                      <TableCell>
                        <Badge variant={request.status === "completed" ? "default" : "outline"}>
                          {request.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatMetric(reqMetrics?.totalDurationMs ?? computeDurationFromRequest(request))}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {reqTokens ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Request Detail</CardTitle>
            {selectedRequest && (
              <CardDescription className="font-mono">{selectedRequest.id}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {selectedRequest ? (
              <Tabs defaultValue="metrics">
                <TabsList>
                  <TabsTrigger value="metrics">Metrics</TabsTrigger>
                  <TabsTrigger value="context">Context</TabsTrigger>
                </TabsList>
                <TabsContent value="metrics" className="space-y-4 pt-4">
                  <div className="space-y-3">
                    <MetricRow label="First-token latency" value={formatMetric(activeMetrics?.firstTokenLatencyMs)} />
                    <Separator />
                    <MetricRow label="Total duration" value={formatMetric(activeMetrics?.totalDurationMs)} />
                    <Separator />
                    <MetricRow label="Total tokens" value={usage?.totalTokens != null ? String(usage.totalTokens) : "—"} />
                    <Separator />
                    <MetricRow label="Event count" value={activeMetrics?.eventCount != null ? String(activeMetrics.eventCount) : "—"} />
                  </div>
                </TabsContent>
                <TabsContent value="context" className="space-y-4 pt-4">
                  <div className="space-y-3">
                    <MetricRow label="Provider" value={selectedRequest.provider} />
                    <Separator />
                    <MetricRow label="Model" value={selectedRequest.model} />
                    <Separator />
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Conversation</p>
                      <p className="font-mono text-xs">{selectedRequest.conversationId}</p>
                    </div>
                    <Separator />
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Turn</p>
                      <p className="font-mono text-xs">{selectedRequest.turnId}</p>
                    </div>
                    <Separator />
                    <a
                      href={`/conversations/${selectedRequest.conversationId}`}
                      className="inline-block text-xs text-primary underline underline-offset-4 hover:text-primary/80"
                    >
                      Open conversation
                    </a>
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No Inference Requests yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
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
