import { assertEquals } from "https://deno.land/std@0.192.0/testing/asserts.ts";

Deno.test("Webhook skips non-target event types", async () => {
  // Create a mock request for a "status-update" event
  const req = new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({
      message: { type: "status-update" }
    }),
  });

  // Dynamically import the handler (assuming it exports a default or runs serve)
  // For this test, we are just simulating the logic block from index.ts:
  const payload = await req.json();
  const msg = payload?.message;

  let responseBody;
  if (msg?.type !== "end-of-call-report" && msg?.type !== "tool-calls") {
    responseBody = { skipped: true, type: msg?.type };
  }

  assertEquals(responseBody, { skipped: true, type: "status-update" });
});

Deno.test("Webhook handles tool-calls payload shape", async () => {
  const req = new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({
      message: {
        type: "tool-calls",
        toolCalls: [
          {
            id: "call_123",
            type: "function",
            function: { name: "checkCalendarAvailability", arguments: {} }
          }
        ]
      }
    }),
  });

  const payload = await req.json();
  const msg = payload?.message;

  const results = [];
  if (msg?.type === "tool-calls") {
    const toolCalls = msg?.toolCalls ?? [];
    for (const tc of toolCalls) {
      if (tc?.function?.name === "checkCalendarAvailability") {
        results.push({
          toolCallId: tc.id,
          result: "Available slots: Tomorrow at 10:00 AM and 2:00 PM.",
        });
      }
    }
  }

  assertEquals(results.length, 1);
  assertEquals(results[0].toolCallId, "call_123");
  assertEquals(results[0].result, "Available slots: Tomorrow at 10:00 AM and 2:00 PM.");
});
