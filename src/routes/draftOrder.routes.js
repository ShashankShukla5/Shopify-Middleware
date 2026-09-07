const express = require('express');
const { createDraftOrderFromCart } = require('../services/draftOrder.service');
const {
  queuePractitionerCheckoutEmail,
} = require('../services/practitionerNotify.service');

const router = express.Router();

router.post('/create-draft-order', async (req, res, next) => {
  try {
    console.log('Event for create-draft-order received: ', req.body);
    const result = await createDraftOrderFromCart(req.body);

    res.status(201).json({
      success: true,
      checkoutUrl: result.checkoutUrl,
      invoiceUrl: result.invoiceUrl,
      practitionerEmailQueued: Boolean(result.practitionerEmail),
      draftOrder: result.draftOrder,
    });

    queuePractitionerCheckoutEmail({
      practitionerEmail: result.practitionerEmail,
      draftOrderId: result.draftOrder.id,
      draftOrderName: result.draftOrder.name,
      checkoutUrl: result.checkoutUrl,
      finalTotal: result.draftOrder.finalTotal,
      currency: result.draftOrder.currency,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
