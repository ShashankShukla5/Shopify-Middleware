const express = require('express');
const { createDraftOrderFromCart } = require('../services/draftOrder.service');

const router = express.Router();

router.post('/create-draft-order', async (req, res, next) => {
  try {
    console.log('Event for create-draft-order received: ', req.body);
    const result = await createDraftOrderFromCart(req.body);
    return res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
