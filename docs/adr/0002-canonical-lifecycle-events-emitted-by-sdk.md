# Canonical lifecycle events emitted by SDK

`packages/ai` will emit canonical inference lifecycle events for request start, payload creation, response start, first token, usage, errors, and request end. We chose this over exposing only raw provider hooks because observability semantics such as latency, attempt boundaries, and normalized errors must be consistent across providers and consumers.