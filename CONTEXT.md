# AI SDK

This repository defines a provider-agnostic SDK for LLM inference and a companion telemetry package for observing inference lifecycles. A demo chat application exists to validate the SDK design, not as the primary product.

## Language

**AI SDK**:
A reusable package that exposes a provider-agnostic request-first interface for LLM inference and emits canonical inference lifecycle events.
_Avoid_: Chat backend, app logic

**Telemetry Package**:
A companion package that consumes canonical inference lifecycle events from the AI SDK and transforms them into structured observability records.
_Avoid_: Logger, analytics app

**Demo Chat App**:
A sample application used to exercise the AI SDK in realistic multi-turn conversations.
_Avoid_: Primary product, core platform

**Runtime API**:
A server application that handles chat requests, performs inference through the AI SDK, captures telemetry, and stores conversations and inference data.
_Avoid_: Ingestion API, telemetry package, exporter only

**Conversation**:
A persisted chat session composed of multiple turns.
_Avoid_: Session, thread

**Message**:
A persisted utterance in a conversation authored by a user or the assistant.
_Avoid_: Turn, request

**Turn**:
A unit of user-visible interaction within a conversation that may involve one or more model invocations.
_Avoid_: Exchange, request

**Inference Request**:
A single concrete LLM invocation performed by the runtime while handling a turn.
_Avoid_: Turn, conversation

**Committed Assistant Message**:
The assistant message recorded on a turn as the final response shown to the user.
_Avoid_: Raw provider output, attempt output

## Relationships

- The **Demo Chat App** calls the **Runtime API** to continue a **Conversation**
- A **Conversation** contains many **Messages** and many **Turns**
- A **Turn** is initiated by a user **Message**
- A **Turn** may produce many **Inference Requests**
- A **Turn** records one **Committed Assistant Message**
- The **Committed Assistant Message** is an assistant **Message** in the conversation
- An **Inference Request** may store attempt-level output whether or not it becomes the **Committed Assistant Message**
- The **Runtime API** translates conversation history into request context for the **AI SDK**
- The **AI SDK** performs inference over request context rather than stored conversations
- The **Telemetry Package** consumes lifecycle events emitted by the **AI SDK**
- The **Runtime API** stores **Conversations**, **Turns**, **Inference Requests**, and telemetry in a single database

## Example dialogue

> **Dev:** "If two provider attempts run for one **Turn**, where do we store the answer the user actually saw?"
> **Domain expert:** "Record it as the **Committed Assistant Message** on the **Turn**, while each **Inference Request** keeps its own attempt-level output."

## Flagged ambiguities

- "chat app" could have meant the main product or a sample consumer — resolved: it is a **Demo Chat App**.
- "sdk" could have meant an app-local wrapper — resolved: it is a reusable **AI SDK** package.
- "app" could have meant either a user-facing UI or a backend service — resolved: the backend service is the **Runtime API**.
- "ingestion API" implied a passive log receiver, but the chosen design also performs inference — resolved: call it the **Runtime API**.
- "chat" could have implied the SDK owns conversations — resolved: the **AI SDK** is request-first, and the **Runtime API** owns conversations.
- "turn" could have been confused with a single model call — resolved: a **Turn** may contain multiple **Inference Requests**.
- "assistant response" could have meant either final user-visible output or per-attempt output — resolved: a **Turn** stores the **Committed Assistant Message**, and each **Inference Request** may store attempt-level output.
- "message" could have been collapsed into turn storage — resolved: **Message** is a first-class concept distinct from **Turn**.
