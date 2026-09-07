const {
  sendDraftOrderInvoice,
  buildPractitionerDraftInvoiceEmail,
} = require('./invoice.service');

async function notifyPractitionerOfCheckoutLink({
  practitionerEmail,
  draftOrderId,
  draftOrderName,
  checkoutUrl,
  finalTotal,
  currency,
}) {
  if (!practitionerEmail) {
    console.log('[draft-order] No practitioner email provided; skipping invoice email');
    return { sent: false, reason: 'missing_practitioner_email' };
  }

  const email = buildPractitionerDraftInvoiceEmail({
    practitionerEmail,
    draftOrderName,
    checkoutUrl,
    finalTotal,
    currency,
  });

  console.log(
    `[draft-order] Sending checkout link for ${draftOrderName} to practitioner ${practitionerEmail}`
  );

  await sendDraftOrderInvoice({
    draftOrderId,
    email: email.email,
    subject: email.subject,
    customMessage: email.customMessage,
  });

  console.log(
    `[draft-order] Checkout link emailed to practitioner ${practitionerEmail}`
  );

  return { sent: true };
}

function queuePractitionerCheckoutEmail(payload) {
  setImmediate(() => {
    notifyPractitionerOfCheckoutLink(payload).catch((error) => {
      console.error(
        `[draft-order] Failed to email practitioner checkout link for ${payload.draftOrderId}:`,
        error.message
      );
    });
  });
}

module.exports = {
  notifyPractitionerOfCheckoutLink,
  queuePractitionerCheckoutEmail,
};
