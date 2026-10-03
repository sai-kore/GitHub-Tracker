import crypto from "crypto";


export function verifyGithubSignature(
  rawBody,
  signature
) {
  if (
    !signature ||
    !process.env.GITHUB_WEBHOOK_SECRET
  ) {
    return false;
  }

  const expectedSignature =
    "sha256=" +
    crypto
      .createHmac(
        "sha256",
        process.env.GITHUB_WEBHOOK_SECRET
      )
      .update(rawBody)
      .digest("hex");

  const expectedBuffer =
    Buffer.from(
      expectedSignature,
      "utf8"
    );

  const receivedBuffer =
    Buffer.from(
      signature,
      "utf8"
    );

  if (
    expectedBuffer.length !==
    receivedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    expectedBuffer,
    receivedBuffer
  );
}