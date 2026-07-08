import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

// Must run on Node.js runtime to access raw request body and crypto
export const runtime = "nodejs";


/**
 * Returns true when the subscription status represents an actively paid plan.
 * "trialing" is included so trial users also get premium access.
 */
function isActiveStatus(status: Stripe.Subscription.Status): boolean {
  return status === "active" || status === "trialing";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!webhookSecret || !secretKey) {
    console.error("[stripe/webhook] Stripe env vars are not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(secretKey);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("[stripe/webhook] Signature verification failed:", (err as Error).message);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  // Idempotency guard: skip events already recorded in the database.
  // stripeEventId has a @unique constraint so a duplicate insert throws P2002.
  try {
    await prisma.stripeWebhookEvent.create({
      data: { stripeEventId: event.id, type: event.type },
    });
  } catch {
    // Unique constraint violation means we already handled this event — safe to ack it.
    return NextResponse.json({ received: true });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;
      }

      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
        await handleInvoice(event.data.object as Stripe.Invoice);
        break;
      }

      default:
        // Unhandled event types are acknowledged without processing
        break;
    }
  } catch (err) {
    console.error("[stripe/webhook] Error processing event", event.type, err);
    // Return 500 so Stripe retries the delivery
    return NextResponse.json({ error: "Internal processing error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleSubscriptionChange(sub: Stripe.Subscription): Promise<void> {
  const stripeCustomerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  const customer = await prisma.stripeCustomer.findUnique({
    where: { stripeCustomerId },
  });

  if (!customer) {
    // Customer record must be created when a checkout session completes.
    // If it's missing here, log and move on rather than crash.
    console.warn(
      "[stripe/webhook] No StripeCustomer row for stripeCustomerId:",
      stripeCustomerId
    );
    return;
  }

  const firstItem = sub.items.data[0];
  const price = firstItem?.price;

  // In Stripe API 2024-09-30+, current_period_start/end live on SubscriptionItem
  const periodStart = firstItem?.current_period_start ?? sub.billing_cycle_anchor;
  const periodEnd = firstItem?.current_period_end ?? sub.billing_cycle_anchor;

  const productId =
    typeof price?.product === "string"
      ? price.product
      : (price?.product as Stripe.Product | undefined)?.id ?? "";

  await prisma.stripeSubscription.upsert({
    where: { stripeSubscriptionId: sub.id },
    create: {
      userId: customer.userId,
      stripeSubscriptionId: sub.id,
      stripePriceId: price?.id ?? "",
      product: productId,
      status: sub.status,
      interval: price?.recurring?.interval ?? "month",
      currentPeriodStart: new Date(periodStart * 1000),
      currentPeriodEnd: new Date(periodEnd * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
    },
    update: {
      status: sub.status,
      stripePriceId: price?.id ?? "",
      product: productId,
      interval: price?.recurring?.interval ?? "month",
      currentPeriodStart: new Date(periodStart * 1000),
      currentPeriodEnd: new Date(periodEnd * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
    },
  });

  await prisma.user.update({
    where: { id: customer.userId },
    data: { isPremium: isActiveStatus(sub.status) },
  });
}

async function handleInvoice(invoice: Stripe.Invoice): Promise<void> {
  if (!invoice.customer || !invoice.id) return;

  const stripeCustomerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer.id;

  const customer = await prisma.stripeCustomer.findUnique({
    where: { stripeCustomerId },
  });

  if (!customer) {
    console.warn(
      "[stripe/webhook] No StripeCustomer row for stripeCustomerId:",
      stripeCustomerId
    );
    return;
  }

  // In Stripe API 2024-09-30+, the subscription reference is at invoice.parent.subscription_details.subscription
  const rawSub = invoice.parent?.subscription_details?.subscription ?? null;
  const subscriptionId =
    rawSub == null
      ? null
      : typeof rawSub === "string"
      ? rawSub
      : rawSub.id;

  const invoiceRecord = {
    userId: customer.userId,
    stripeInvoiceId: invoice.id,
    subscriptionId,
    status: invoice.status ?? "unknown",
    amountPaid: invoice.amount_paid,
    currency: invoice.currency,
    invoiceUrl: invoice.hosted_invoice_url ?? null,
    invoicePdf: invoice.invoice_pdf ?? null,
    periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
    periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
    paidAt: invoice.status_transitions?.paid_at
      ? new Date(invoice.status_transitions.paid_at * 1000)
      : null,
  };

  await prisma.stripeInvoice.upsert({
    where: { stripeInvoiceId: invoice.id },
    create: invoiceRecord,
    update: {
      status: invoiceRecord.status,
      amountPaid: invoiceRecord.amountPaid,
      invoiceUrl: invoiceRecord.invoiceUrl,
      invoicePdf: invoiceRecord.invoicePdf,
      paidAt: invoiceRecord.paidAt,
    },
  });
}
