import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/conversations")({
  component: ConversationsLayout,
});

function ConversationsLayout() {
  return <Outlet />;
}
