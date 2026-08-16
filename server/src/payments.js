import Razorpay from "razorpay";
import crypto from "crypto";

function client() {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

export async function createRazorpayOrder(amountInRupees) {
  const amountPaise = Math.round(amountInRupees * 100);
  return client().orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt: `rcpt_${Date.now()}`,
  });
}

// Confirms the payment actually came from Razorpay and wasn't forged by
// the browser — this is the check that makes the payment system trustworthy.
export function verifySignature({ orderId, paymentId, signature }) {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return expected === signature;
}
