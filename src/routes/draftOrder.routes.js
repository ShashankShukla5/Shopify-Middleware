const express = require('express');
const { createDraftOrderFromCart } = require('../services/draftOrder.service');

const router = express.Router();

router.post('/create-draft-order', async (req, res, next) => {
  try {
    console.log('[draft-order] request received', {
      clientEmail: req.body?.clientEmail,
      practitionerId: req.body?.practitioner?.id,
      cartItemCount: Array.isArray(req.body?.cart?.items)
        ? req.body.cart.items.length
        : 0,
    });

    const result = await createDraftOrderFromCart(req.body);

    return res.status(201).json({
      success: result.emailSent,
      emailSent: result.emailSent,
      draftOrderCreated: result.draftOrderCreated,
      clientEmail: result.clientEmail,
      invoiceSentTo: result.invoiceSentTo,
      invoiceRecipientType: result.invoiceRecipientType,
      checkoutUrl: result.checkoutUrl,
      invoiceUrl: result.invoiceUrl,
      message: result.message,
      draftOrder: result.draftOrder,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
