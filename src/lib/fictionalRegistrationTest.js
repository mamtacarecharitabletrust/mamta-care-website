/**
 * Fictional-only website registration TEST.
 * This is never used for genuine donor registration.
 * No secret is placed in the browser.
 * Photographs are intentionally not transmitted.
 */
const TEST_ENDPOINT = "https://mamta-website-register-test-20261019.bharathairseva-in.workers.dev/api/test-register";

export function validateFictionalTestIdentity(values) {
  if (!/^(fictional|test|demo)\b/i.test(String(values.full_name || "").trim())) {
    return "TEST ONLY: name must begin Fictional, Test, or Demo.";
  }
  if (!/^[^\s@]+@example\.test$/i.test(String(values.email || "").trim())) {
    return "TEST ONLY: use an @example.test email address.";
  }
  if (String(values.phone || "").replace(/\D/g, "") !== "9000000000") {
    return "TEST ONLY: enter fictional phone number 9000000000.";
  }
  return null;
}

export async function sendFictionalTestRegistration(id, values) {
  const response = await fetch(TEST_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ donor_id: id, values }),
  });
  const data = await response.json();
  if (!response.ok || !data.ok || !data.registration_id) {
    const error = new Error(data.error || "The TEST registration was not confirmed.");
    error.pending = Boolean(data.pending);
    throw error;
  }
  return data;
}
