import { NextResponse } from "next/server";
import { getPaymentConfig, retrievePaymentRequest } from "@/lib/payments";
import { limitBookingRequest } from "@/lib/booking-http";
import { syncBookingFromPayment } from "@/lib/bookings";

export const runtime = "nodejs";

function failure(message, status) {
  return new NextResponse(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function POST(request) {
  let config;
  try { config = getPaymentConfig(); }
  catch { return failure("Online checkout is unavailable. Please contact the host.", 503); }
  if (request.headers.get("origin") !== config.siteUrl) {
    return failure("Please open your original payment link to continue.", 403);
  }
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) {
    return failure("Please use the payment button on your booking page.", 415);
  }
  if (Number(request.headers.get("content-length")) > 4096) {
    return failure("Invalid payment request.", 413);
  }
  const reader = request.body?.getReader();
  if (!reader) return failure("Invalid payment request.", 400);
  const chunks = [];
  let bytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > 4096) { await reader.cancel(); return failure("Invalid payment request.", 413); }
    chunks.push(value);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  const token = new URLSearchParams(body).get("token");
  try {
    await limitBookingRequest(request, "payment-read", 60, 5 * 60 * 1000);
    const payment = await retrievePaymentRequest(token, config);
    try { await syncBookingFromPayment(payment); } catch {}
    if (payment.status !== "pending") {
      return NextResponse.redirect(new URL(`/pay/${encodeURIComponent(token)}?returned=1`, config.siteUrl), 303);
    }
    const response = NextResponse.redirect(payment.checkoutUrl, 303);
    response.cookies.set(`haus26_payment_${payment.request.reference}`, token, {
      httpOnly: true,
      secure: config.siteUrl.startsWith("https:"),
      sameSite: "lax",
      path: "/payment",
      maxAge: 60 * 60 * 24 * 7,
    });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    if (error.status === 429) return failure("Too many payment checks. Please try again in a few minutes.", 429);
    if (["invalid-link", "invalid-request", "request-mismatch"].includes(error.code)) {
      return failure("This payment request could not be verified. Please ask the host for a new link.", 400);
    }
    return NextResponse.redirect(new URL(`/pay/${encodeURIComponent(token || "invalid")}?returned=1`, config.siteUrl), 303);
  }
}
