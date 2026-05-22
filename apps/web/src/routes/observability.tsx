import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { ObservabilityScreen } from "@/components/observability-screen";
import {
  getInferenceRequestInspection,
  getInferenceRequestMetrics,
  listInferenceRequests,
  type InferenceRequestInspection,
  type InferenceRequestMetrics,
} from "@/lib/api";

export const Route = createFileRoute("/observability")({
  loader: () => listInferenceRequests(),
  component: ObservabilityPage,
});

function ObservabilityPage() {
  const inferenceRequests = Route.useLoaderData();
  const completedRequests = useMemo(
    () => inferenceRequests.filter((request) => request.status === "completed"),
    [inferenceRequests],
  );
  const [selectedRequestId, setSelectedRequestId] = useState<string | undefined>(
    completedRequests[0]?.id,
  );
  const [metrics, setMetrics] = useState<InferenceRequestMetrics>();
  const [metricsByRequestId, setMetricsByRequestId] = useState<Record<string, InferenceRequestMetrics>>({});
  const [usageByRequestId, setUsageByRequestId] = useState<Record<string, number | null>>({});
  const [inspection, setInspection] = useState<InferenceRequestInspection>();

  useEffect(() => {
    if (!completedRequests.some((request) => request.id === selectedRequestId)) {
      setSelectedRequestId(completedRequests[0]?.id);
    }
  }, [completedRequests, selectedRequestId]);

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      completedRequests.map(async (request) => [request.id, await getInferenceRequestMetrics(request.id)] as const),
    ).then((entries) => {
      if (cancelled) {
        return;
      }

      setMetricsByRequestId(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [completedRequests]);

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      completedRequests.map(async (request) => [request.id, await getInferenceRequestInspection(request.id)] as const),
    ).then((entries) => {
      if (cancelled) {
        return;
      }

      setUsageByRequestId(
        Object.fromEntries(entries.map(([requestId, nextInspection]) => [requestId, nextInspection.summary.usage?.totalTokens ?? null])),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [completedRequests]);

  useEffect(() => {
    if (!selectedRequestId) {
      setMetrics(undefined);
      setInspection(undefined);
      return;
    }

    let cancelled = false;

    Promise.all([
      getInferenceRequestMetrics(selectedRequestId),
      getInferenceRequestInspection(selectedRequestId),
    ]).then(([nextMetrics, nextInspection]) => {
      if (cancelled) {
        return;
      }

      setMetrics(nextMetrics);
      setInspection(nextInspection);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedRequestId]);

  return (
    <div className="h-full overflow-y-auto">
      <ObservabilityScreen
        inferenceRequests={completedRequests}
        selectedRequestId={selectedRequestId}
        onRequestSelect={setSelectedRequestId}
        metrics={metrics}
        metricsByRequestId={metricsByRequestId}
        usageByRequestId={usageByRequestId}
        inspection={inspection}
      />
    </div>
  );
}
