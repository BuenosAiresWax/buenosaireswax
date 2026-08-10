const BASE_URL = process.argv[2] || "https://buenosaireswax-git-vinyl-club-buenos-aires-waxs-projects.vercel.app";
const BYPASS_SECRET = process.argv[3] || "";
const WEBHOOK_URL = BYPASS_SECRET
  ? `${BASE_URL}/api/mercadopago/webhook?x-vercel-protection-bypass=${BYPASS_SECRET}`
  : `${BASE_URL}/api/mercadopago/webhook`;

const testPayloads = [
  {
    name: "subscription_preapproval - authorized",
    payload: {
      action: "updated",
      application_id: "911852538158561",
      data: { id: "123456", status: "authorized" },
      date: "2021-11-01T02:02:02Z",
      entity: "preapproval",
      id: "123456",
      type: "subscription_preapproval",
      version: 8,
    },
  },
  {
    name: "subscription_preapproval - paused",
    payload: {
      action: "updated",
      application_id: "91185253818561",
      data: { id: "123456", status: "paused" },
      date: "2021-11-01T02:02:02Z",
      entity: "preapproval",
      id: "123456",
      type: "subscription_preapproval",
      version: 8,
    },
  },
  {
    name: "payment event",
    payload: {
      action: "created",
      application_id: "911852538158561",
      data: { id: "98765", preapproval_id: "123456", status: "approved", transaction_amount: 70000 },
      date: "2021-11-01T02:02:02Z",
      entity: "payment",
      id: "98765",
      type: "payment",
      version: 8,
    },
  },
];

async function testWebhook(url, test) {
  console.log(`\n--- ${test.name} ---`);
  console.log(`POST ${url}`);
  console.log(`Payload: ${JSON.stringify(test.payload, null, 2)}`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(test.payload),
    });

    const body = await res.text();
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${body}`);
    return res.status;
  } catch (err) {
    console.error(`Error: ${err.message}`);
    return null;
  }
}

async function testHealth(url) {
  console.log("\n--- GET Health Check ---");
  try {
    const res = await fetch(url);
    const body = await res.text();
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${body}`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
  }
}

async function main() {
  console.log("=== Webhook Test ===");
  console.log(`URL: ${WEBHOOK_URL}`);
  console.log(`Bypass: ${BYPASS_SECRET ? "YES" : "NO (add secret as 2nd arg)"}`);
  console.log(`Usage: node test-webhook.js [base-url] [bypass-secret]`);

  await testHealth(WEBHOOK_URL);

  for (const test of testPayloads) {
    await testWebhook(WEBHOOK_URL, test);
  }
}

main();
